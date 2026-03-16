import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Gerente {
  id: string;
  user_id: string;
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
}

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
      const roleRes = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
      const userRole = roleRes.data?.role ?? 'gerente';

      if (userRole === 'asesor') {
        // Fetch asesor profile
        const asesorRes = await supabase
          .from('asesores')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (asesorRes.error) throw asesorRes.error;

        if (asesorRes.data) {
          const a = asesorRes.data;
          setProfile({
            id: a.id,
            user_id: a.user_id ?? userId,
            nombre: a.nombre,
            email: a.email,
            canal: a.canal,
            pais: a.pais,
            lider: null,
            activo: a.activo ?? true,
            avatar_url: a.avatar_url,
            created_at: a.created_at ?? '',
            sp_totales: 0,
            nivel: 'Prospecto',
            sp_nivel_actual: 0,
            sp_siguiente_nivel: null,
            role: 'asesor',
          });
        } else {
          setProfile(null);
        }
      } else {
        // Fetch gerente profile
        const profileRes = await supabase
          .from('sp_totales_gerente')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (profileRes.error) throw profileRes.error;

        if (profileRes.data) {
          const data = profileRes.data;
          setProfile({
            id: data.id,
            user_id: data.user_id ?? userId,
            nombre: data.nombre,
            email: '',
            canal: data.canal,
            pais: data.pais,
            lider: data.lider,
            activo: data.activo ?? true,
            avatar_url: data.avatar_url,
            created_at: '',
            sp_totales: data.sp_totales ?? 0,
            nivel: data.nivel ?? 'Prospecto',
            sp_nivel_actual: data.sp_nivel_actual ?? 0,
            sp_siguiente_nivel: data.sp_siguiente_nivel,
            role: userRole,
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
