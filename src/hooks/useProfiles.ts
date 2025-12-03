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
      
      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
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
    segment?: 'Empresarios' | 'Aliados' | 'B&M' | 'Despachos';
  }) => {
    // Create auth user with metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          name: userData.name,
          role: userData.role,
          avatar: userData.avatar || '👤',
        },
      },
    });

    if (authError) {
      return { data: null, error: authError };
    }

    // Wait a bit for the trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update additional profile fields
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          manager_id: userData.manager_id || null,
          cell_id: userData.cell_id || null,
          country: userData.country || null,
          segment: userData.segment || null,
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      // Refresh profiles
      await fetchProfiles();
    }

    return { data: authData, error: null };
  };

  const deleteUserProfile = async (userId: string) => {
    // Note: Deleting from auth.users will cascade to profiles due to FK
    // This requires admin access, so for now we just update the profile
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (!error) {
      setProfiles(prev => prev.filter(p => p.id !== userId));
    }

    return { error };
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
