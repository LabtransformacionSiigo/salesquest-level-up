import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RankingEntry {
  id: string;
  name: string;
  nickname: string | null;
  avatar: string | null;
  xp: number | null;
  cell_id: string | null;
  country: string | null;
  segment: string | null;
  manager_id: string | null;
  cell_name: string | null;
  role: string | null;
  global_rank: number;
  cell_rank: number;
  country_rank: number;
  segment_rank: number;
}

export interface RankingFilters {
  cell_id?: string | null;
  country?: string | null;
  segment?: string | null;
}

export const useRankings = (filters?: RankingFilters) => {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRankings = async () => {
    try {
      setLoading(true);
      
      // Query the ranking_view directly
      let query = supabase
        .from('ranking_view')
        .select('*')
        .order('global_rank', { ascending: true });

      if (filters?.cell_id) {
        query = query.eq('cell_id', filters.cell_id);
      }
      if (filters?.country) {
        query = query.eq('country', filters.country);
      }
      if (filters?.segment) {
        query = query.eq('segment', filters.segment as any);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRankings((data as unknown as RankingEntry[]) || []);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching rankings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [filters?.cell_id, filters?.country, filters?.segment]);

  const getTopThree = () => {
    return rankings.slice(0, 3);
  };

  const getUserPosition = (userId: string) => {
    return rankings.find(r => r.id === userId);
  };

  return {
    rankings,
    loading,
    error,
    fetchRankings,
    getTopThree,
    getUserPosition,
  };
};
