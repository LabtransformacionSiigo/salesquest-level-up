import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile, AuthUser } from './useSupabaseAuth';

export const useProfiles = () => {
  const [profiles, setProfiles] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const combinedProfiles = (profilesData || []).map(profile => {
        const roleRecord = rolesData?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: roleRecord?.role || 'EJECUTIVO',
        } as AuthUser;
      });

      setProfiles(combinedProfiles);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const getManagers = () => {
    return profiles.filter(p => p.role === 'GERENTE');
  };

  const getTeamMembers = (managerId: string) => {
    return profiles.filter(p => p.manager_id === managerId && p.role === 'EJECUTIVO');
  };

  const updateUserProfile = async (userId: string, updates: Partial<Profile>) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (!error && data) {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, ...data } : p));
    }

    return { data, error };
  };

  const createUserWithAuth = async (userData: {
    email: string;
    password: string;
    name: string;
    role: 'ADMINISTRADOR' | 'GERENTE' | 'EJECUTIVO';
    avatar?: string;
    manager_id?: string;
    cell_id?: string;
    country?: string;
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          email: userData.email,
          password: userData.password,
          name: userData.name,
          role: userData.role,
          avatar: userData.avatar || '👤',
          country: userData.country,
          cell_id: userData.cell_id,
          manager_id: userData.manager_id,
        },
      });

      if (response.error) {
        return { data: null, error: response.error };
      }

      const result = response.data;
      if (result.error) {
        return { data: null, error: new Error(result.error) };
      }

      // Refresh profiles
      await fetchProfiles();
      return { data: result.data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  const deleteUserProfile = async (userId: string) => {
    try {
      const response = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          userId,
        },
      });

      if (response.error) {
        return { error: response.error };
      }

      const result = response.data;
      if (result.error) {
        return { error: new Error(result.error) };
      }

      setProfiles(prev => prev.filter(p => p.id !== userId));
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  return {
    profiles,
    loading,
    error,
    fetchProfiles,
    getManagers,
    getTeamMembers,
    updateUserProfile,
    createUserWithAuth,
    deleteUserProfile,
  };
};
