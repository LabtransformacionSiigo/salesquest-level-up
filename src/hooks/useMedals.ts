import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DbMedal {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  condition_type: string;
  condition_value: number;
  xp_reward: number | null;
  active: boolean;
  created_at: string;
}

export const useMedals = () => {
  const [medals, setMedals] = useState<DbMedal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMedals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('medals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedals(data || []);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching medals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedals();
  }, []);

  const addMedal = async (medal: Omit<DbMedal, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('medals')
      .insert(medal)
      .select()
      .single();

    if (!error && data) {
      setMedals(prev => [data, ...prev]);
    }

    return { data, error };
  };

  const updateMedal = async (id: string, updates: Partial<DbMedal>) => {
    const { data, error } = await supabase
      .from('medals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      setMedals(prev => prev.map(m => m.id === id ? data : m));
    }

    return { data, error };
  };

  const deleteMedal = async (id: string) => {
    const { error } = await supabase
      .from('medals')
      .delete()
      .eq('id', id);

    if (!error) {
      setMedals(prev => prev.filter(m => m.id !== id));
    }

    return { error };
  };

  const toggleMedalActive = async (id: string, active: boolean) => {
    return updateMedal(id, { active });
  };

  return {
    medals,
    loading,
    error,
    fetchMedals,
    addMedal,
    updateMedal,
    deleteMedal,
    toggleMedalActive,
  };
};
