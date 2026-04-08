import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { filterVcAdvisorSales, getVcAdvisorDerivedMetrics } from '@/lib/vc-advisor-metrics';

export interface Gerente {
  id: string;
  user_id: string;
  gerente_id?: string | null;
  nombre: string;
  email: string;
  canal: string | null;
  pais: string | null;
  lider: string | null;
  activo: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthUser extends Gerente {
  sp_totales: number;
  nivel: string;
  sp_nivel_actual: number;
  sp_siguiente_nivel: number | null;
  role: string | null;
  puntos_canjeables: number;
  canal_direccion?: string | null;
}

const NIVELES = [
  { nombre: 'Cuarzo', min: 0, max: 1500 },
  { nombre: 'Rubí', min: 1501, max: 3000 },
  { nombre: 'Zafiro', min: 3001, max: 4500 },
  { nombre: 'Esmeralda', min: 4501, max: 6000 },
  { nombre: 'Diamante', min: 6001, max: Number.MAX_SAFE_INTEGER },
];

const getNivelData = (spTotales: number) => {
  const nivelActual = NIVELES.find((nivel) => spTotales >= nivel.min && spTotales <= nivel.max) || NIVELES[0];
  const siguienteNivel = NIVELES[NIVELES.indexOf(nivelActual) + 1] ?? null;

  return {
    nivel: nivelActual.nombre,
    sp_nivel_actual: Math.max(0, spTotales - nivelActual.min),
    sp_siguiente_nivel: siguienteNivel?.min ?? null,
  };
};

export const useSupabaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const roleRes = await supabase.from('user_roles').select('role').eq('user_id', userId);
      const roles = (roleRes.data || []).map((r: any) => r.role);
      const userRole = roles.includes('admin') ? 'admin' : roles.includes('gerente') ? 'gerente' : roles[0] ?? 'gerente';

      // Admins don't compete — simplified profile
      if (userRole === 'admin') {
        const { data: gerenteData } = await supabase
          .from('gerentes')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        setProfile({
          id: gerenteData?.id || userId,
          user_id: userId,
          gerente_id: null,
          nombre: gerenteData?.nombre || 'Administrador',
          email: gerenteData?.email || '',
          canal: gerenteData?.canal || null,
          pais: gerenteData?.pais || null,
          lider: null,
          activo: true,
          avatar_url: gerenteData?.avatar_url || null,
          created_at: gerenteData?.created_at || '',
          sp_totales: 0,
          nivel: 'Admin',
          sp_nivel_actual: 0,
          sp_siguiente_nivel: null,
          role: 'admin',
          puntos_canjeables: 0,
        });
        setLoading(false);
        return;
      }

      if (userRole === 'asesor') {
        const asesorRes = await supabase
          .from('asesores')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (asesorRes.error) throw asesorRes.error;

        if (asesorRes.data) {
          const asesor = asesorRes.data;
          let spTotales = 0;

          if (asesor.canal === 'VC' && asesor.gerente_id) {
            const ventasRes = await supabase
              .from('ventas')
              .select('fecha_facturacion, valor_producto, acv_plus, comercial, gerente_id')
              .eq('gerente_id', asesor.gerente_id);

            if (ventasRes.error) throw ventasRes.error;
            const advisorSales = filterVcAdvisorSales(ventasRes.data || [], asesor.nombre, asesor.gerente_id);
            spTotales = getVcAdvisorDerivedMetrics(advisorSales).totalSp;
          } else {
            const spRes = await supabase.from('sp_acumulados').select('sp').eq('gerente_id', asesor.id).eq('fuente', 'CUMPLIMIENTO_META');
            if (spRes.error) throw spRes.error;
            spTotales = (spRes.data || []).reduce((total: number, row: any) => total + (Number(row.sp) || 0), 0);
          }

          const nivelData = getNivelData(spTotales);

          setProfile({
            id: asesor.id,
            user_id: asesor.user_id ?? userId,
            gerente_id: asesor.gerente_id,
            nombre: asesor.nombre,
            email: asesor.email,
            canal: asesor.canal,
            pais: asesor.pais,
            lider: null,
            activo: asesor.activo ?? true,
            avatar_url: asesor.avatar_url,
            created_at: asesor.created_at ?? '',
            sp_totales: spTotales,
            nivel: nivelData.nivel,
            sp_nivel_actual: nivelData.sp_nivel_actual,
            sp_siguiente_nivel: nivelData.sp_siguiente_nivel,
            role: 'asesor',
            puntos_canjeables: asesor.puntos_canjeables ?? 0,
          });
        } else {
          setProfile(null);
        }
      } else {
        const [profileRes, gerenteRes] = await Promise.all([
          supabase.from('sp_totales_gerente').select('*').eq('user_id', userId).maybeSingle(),
          supabase.from('gerentes').select('puntos_canjeables').eq('user_id', userId).maybeSingle(),
        ]);

        if (profileRes.error) throw profileRes.error;

        if (profileRes.data) {
          const data = profileRes.data;
          setProfile({
            id: data.id,
            user_id: data.user_id ?? userId,
            gerente_id: null,
            nombre: data.nombre,
            email: '',
            canal: data.canal,
            pais: data.pais,
            lider: data.lider,
            activo: data.activo ?? true,
            avatar_url: data.avatar_url,
            created_at: '',
            sp_totales: data.sp_totales ?? 0,
            nivel: data.nivel ?? 'Cuarzo',
            sp_nivel_actual: data.sp_nivel_actual ?? 0,
            sp_siguiente_nivel: data.sp_siguiente_nivel,
            role: userRole,
            puntos_canjeables: (gerenteRes.data as any)?.puntos_canjeables ?? 0,
          });
        } else {
          setProfile(null);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { error };
    }
    return { data, error: null };
  };

  const signUp = async (email: string, password: string, metadata?: { name?: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: metadata,
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setProfile(null);
      setUser(null);
      setSession(null);
    }
    return { error };
  };

  const updateProfile = async (updates: Partial<Gerente>) => {
    if (!user || !profile) return { error: new Error('No user logged in') };
    const { data, error } = await supabase
      .from('gerentes')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();
    if (!error && data) {
      setProfile(prev => prev ? { ...prev, ...data } : null);
    }
    return { data, error };
  };

  return {
    user,
    session,
    profile,
    loading,
    isAuthenticated: !!session && !!profile,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile: () => user && fetchUserProfile(user.id),
  };
};
