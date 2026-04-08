import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Gerente {
  id: string;
  user_id: string;
  gerente_id?: string | null;
  nombre: string;
  email: string;
  canal: string | null;
  pais: string | null;
  lider: string | null;
  celula: string | null;
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
  sp_canje: number;
  sp_convencion: number;
  canal_direccion?: string | null;
}

const NIVELES = [
  { nombre: 'Cuarzo', min: 0, max: 1500 },
  { nombre: 'Rubí', min: 1501, max: 3000 },
  { nombre: 'Zafiro', min: 3001, max: 4500 },
  { nombre: 'Esmeralda', min: 4501, max: 6000 },
  { nombre: 'Diamante', min: 6001, max: Number.MAX_SAFE_INTEGER },
];

const MONTH_NUMBERS_ES: Record<string, string> = {
  Enero: '01',
  Febrero: '02',
  Marzo: '03',
  Abril: '04',
  Mayo: '05',
  Junio: '06',
  Julio: '07',
  Agosto: '08',
  Septiembre: '09',
  Octubre: '10',
  Noviembre: '11',
  Diciembre: '12',
};

const getNivelData = (spTotales: number) => {
  const nivelActual = NIVELES.find((nivel) => spTotales >= nivel.min && spTotales <= nivel.max) || NIVELES[0];
  const siguienteNivel = NIVELES[NIVELES.indexOf(nivelActual) + 1] ?? null;

  return {
    nivel: nivelActual.nombre,
    sp_nivel_actual: Math.max(0, spTotales - nivelActual.min),
    sp_siguiente_nivel: siguienteNivel?.min ?? null,
  };
};

const getCurrentConventionYear = () => new Date().getFullYear();

const sumConventionRows = (rows: Array<{ sp?: number | null }> | null | undefined) =>
  (rows || []).reduce((total, row) => total + (Number(row.sp) || 0), 0);

const getVcMonthlyConventionTotal = (rows: Array<{ anio?: number | null; mes?: string | null; acv_plus?: number | null; meta?: number | null }> | null | undefined) => {
  const monthly = new Map<string, { acv: number; meta: number }>();

  (rows || []).forEach((row) => {
    const year = Number(row.anio) || 0;
    const month = row.mes ? MONTH_NUMBERS_ES[row.mes] : null;
    if (!year || !month) return;

    const period = `${year}${month}`;
    const current = monthly.get(period) || { acv: 0, meta: 0 };
    current.acv += Number(row.acv_plus) || 0;
    current.meta += Number(row.meta) || 0;
    monthly.set(period, current);
  });

  return [...monthly.values()].reduce((total, row) => {
    if (row.meta <= 0 || row.acv <= 0) return total;
    return total + Math.round((row.acv / row.meta) * 100);
  }, 0);
};

const getVnMonthlyConventionTotal = (rows: Array<{ anio_mes?: string | null; ventas?: number | null; meta?: number | null }> | null | undefined) => {
  const monthly = new Map<string, { ventas: number; meta: number }>();

  (rows || []).forEach((row) => {
    const period = String(row.anio_mes || '');
    if (!period) return;

    const current = monthly.get(period) || { ventas: 0, meta: 0 };
    current.ventas += Number(row.ventas) || 0;
    current.meta += Number(row.meta) || 0;
    monthly.set(period, current);
  });

  return [...monthly.values()].reduce((total, row) => {
    if (row.meta <= 0 || row.ventas <= 0) return total;
    return total + Math.round((row.ventas / row.meta) * 100);
  }, 0);
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
      const currentConventionYear = getCurrentConventionYear();
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
          celula: null,
          activo: true,
          avatar_url: gerenteData?.avatar_url || null,
          created_at: gerenteData?.created_at || '',
          sp_totales: 0,
          nivel: 'Admin',
          sp_nivel_actual: 0,
          sp_siguiente_nivel: null,
          role: 'admin',
           sp_canje: 0,
           sp_convencion: 0,
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
          const conventionQuery = supabase
            .from('sp_acumulados')
            .select('sp')
            .eq('gerente_id', asesor.id)
            .eq('fuente', 'CUMPLIMIENTO_META')
            .eq('tipo_sp', 'convencion')
            .gte('periodo', `${currentConventionYear}01`)
            .lte('periodo', `${currentConventionYear}12`);

          const fallbackQuery = asesor.canal === 'VC'
            ? supabase
                .from('ventas')
                .select('anio, mes, acv_plus, meta')
                .eq('canal', 'VC')
                .eq('anio', currentConventionYear)
                .eq('gerente_id', asesor.gerente_id)
                .eq('comercial', asesor.nombre)
                .like('documento_factura', 'SUM-%')
            : (() => {
                let query = supabase
                  .from('productividad_asesores')
                  .select('anio_mes, ventas, meta, pais')
                  .eq('asesor', asesor.nombre)
                  .gte('anio_mes', `${currentConventionYear}01`)
                  .lte('anio_mes', `${currentConventionYear}12`);

                if (asesor.pais) query = query.eq('pais', asesor.pais);
                return query;
              })();

          const [spRes, fallbackRes] = await Promise.all([conventionQuery, fallbackQuery]);
          if (spRes.error) throw spRes.error;
          if (fallbackRes.error) throw fallbackRes.error;

          let spTotales = sumConventionRows(spRes.data);
          if (spTotales === 0) {
            spTotales = asesor.canal === 'VC'
              ? getVcMonthlyConventionTotal(fallbackRes.data as any[])
              : getVnMonthlyConventionTotal(fallbackRes.data as any[]);
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
            celula: null,
            activo: asesor.activo ?? true,
            avatar_url: asesor.avatar_url,
            created_at: asesor.created_at ?? '',
            sp_totales: spTotales,
            nivel: nivelData.nivel,
            sp_nivel_actual: nivelData.sp_nivel_actual,
            sp_siguiente_nivel: nivelData.sp_siguiente_nivel,
            role: 'asesor',
             sp_canje: asesor.sp_canje ?? 0,
             sp_convencion: spTotales,
            canal_direccion: (asesor as any).canal_direccion ?? null,
          });
        } else {
          setProfile(null);
        }
      } else {
        const [profileRes, gerenteRes] = await Promise.all([
          supabase.from('sp_totales_gerente').select('*').eq('user_id', userId).maybeSingle(),
          supabase.from('gerentes').select('id, sp_canje, celula').eq('user_id', userId).maybeSingle(),
        ]);

        if (profileRes.error) throw profileRes.error;

        if (profileRes.data) {
          const data = profileRes.data;
          const gerenteId = data.id || (gerenteRes.data as any)?.id;
          const spRes = gerenteId
            ? await supabase
                .from('sp_acumulados')
                .select('sp')
                .eq('gerente_id', gerenteId)
                .eq('fuente', 'CUMPLIMIENTO_META')
                .eq('tipo_sp', 'convencion')
                .gte('periodo', `${currentConventionYear}01`)
                .lte('periodo', `${currentConventionYear}12`)
            : { data: [], error: null };

          if (spRes.error) throw spRes.error;

          const spTotales = sumConventionRows(spRes.data as any[]);
          const nivelData = getNivelData(spTotales);

          setProfile({
            id: data.id,
            user_id: data.user_id ?? userId,
            gerente_id: null,
            nombre: data.nombre,
            email: '',
            canal: data.canal,
            pais: data.pais,
            lider: data.lider,
            celula: (gerenteRes.data as any)?.celula ?? null,
            activo: data.activo ?? true,
            avatar_url: data.avatar_url,
            created_at: '',
            sp_totales: spTotales,
            nivel: nivelData.nivel,
            sp_nivel_actual: nivelData.sp_nivel_actual,
            sp_siguiente_nivel: nivelData.sp_siguiente_nivel,
            role: userRole,
             sp_canje: (gerenteRes.data as any)?.sp_canje ?? 0,
              sp_convencion: spTotales,
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
