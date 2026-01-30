import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ManagerCell {
  id: string;
  manager_id: string;
  cell_id: string;
  assigned_at: string;
}

export const useManagerCells = (managerId?: string) => {
  const [assignments, setAssignments] = useState<ManagerCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('manager_cells')
        .select('*')
        .order('assigned_at', { ascending: false });

      if (managerId) {
        query = query.eq('manager_id', managerId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAssignments(data || []);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching manager cells:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [managerId]);

  const assignCell = async (manager_id: string, cell_id: string) => {
    const { data, error } = await supabase
      .from('manager_cells')
      .insert({ manager_id, cell_id })
      .select()
      .single();

    if (!error && data) {
      setAssignments(prev => [data, ...prev]);
    }

    return { data, error };
  };

  const unassignCell = async (id: string) => {
    const { error } = await supabase
      .from('manager_cells')
      .delete()
      .eq('id', id);

    if (!error) {
      setAssignments(prev => prev.filter(a => a.id !== id));
    }

    return { error };
  };

  const getManagerCells = (managerId: string) => {
    return assignments.filter(a => a.manager_id === managerId);
  };

  const getCellManagers = (cellId: string) => {
    return assignments.filter(a => a.cell_id === cellId);
  };

  return {
    assignments,
    loading,
    error,
    fetchAssignments,
    assignCell,
    unassignCell,
    getManagerCells,
    getCellManagers,
  };
};
