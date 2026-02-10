import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, Trophy } from 'lucide-react';
import { useRankings } from '@/hooks/useRankings';
import { useCells } from '@/hooks/useCells';
import { cn } from '@/lib/utils';

const COUNTRIES = ['Colombia', 'México', 'Argentina', 'Chile', 'Perú'];
const SEGMENTS = ['Empresarios', 'Aliados', 'B&M', 'Despachos'];

interface MiniLeaderboardProps {
  currentUserId?: string;
}

const MiniLeaderboard = ({ currentUserId }: MiniLeaderboardProps) => {
  const [filters, setFilters] = useState<{ cell_id?: string; country?: string; segment?: string }>({});
  const [showAll, setShowAll] = useState(false);
  const { rankings, loading } = useRankings(filters);
  const { cells } = useCells();

  const topThree = rankings.slice(0, 3);
  const rest = showAll ? rankings.slice(3) : rankings.slice(3, 8);

  // Reorder top 3 for podium: [2nd, 1st, 3rd]
  const podiumOrder = topThree.length >= 3
    ? [topThree[1], topThree[0], topThree[2]]
    : topThree;

  return (
    <Card className="p-5">
      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Select
          value={filters.country || 'all'}
          onValueChange={v => setFilters(f => ({ ...f, country: v === 'all' ? undefined : v }))}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="País" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">País</SelectItem>
            {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={filters.segment || 'all'}
          onValueChange={v => setFilters(f => ({ ...f, segment: v === 'all' ? undefined : v }))}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Segmento</SelectItem>
            {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={filters.cell_id || 'all'}
          onValueChange={v => setFilters(f => ({ ...f, cell_id: v === 'all' ? undefined : v }))}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Canal</SelectItem>
            {cells.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Podium */}
      {!loading && topThree.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-6">
          {podiumOrder.map((entry, idx) => {
            const isFirst = idx === 1;
            const rank = isFirst ? 1 : idx === 0 ? 2 : 3;
            const colors = {
              1: 'bg-accent text-accent-foreground',
              2: 'bg-muted text-muted-foreground',
              3: 'bg-orange/20 text-orange',
            };

            return (
              <div key={entry.id} className="flex flex-col items-center">
                <div className={cn(
                  "rounded-full flex items-center justify-center font-bold mb-1",
                  isFirst ? "w-16 h-16 text-2xl" : "w-12 h-12 text-lg",
                  colors[rank as 1 | 2 | 3]
                )}>
                  {entry.avatar || entry.name?.charAt(0)}
                </div>
                <span className="text-xs font-semibold text-foreground text-center max-w-[80px] truncate">
                  {entry.name?.split(' ')[0]}
                </span>
                <span className="text-[10px] text-muted-foreground">{(entry.xp || 0).toLocaleString()}xp</span>
                {isFirst && <Trophy className="w-4 h-4 text-accent mt-1" />}
                <span className={cn(
                  "text-xs font-bold mt-0.5",
                  rank === 1 ? "text-accent" : "text-muted-foreground"
                )}>
                  {rank}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="space-y-1">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-4">Cargando...</p>
        ) : rest.length === 0 && topThree.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">Sin datos</p>
        ) : (
          rest.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                entry.id === currentUserId ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50"
              )}
            >
              <span className="text-sm font-bold text-muted-foreground w-5 text-center">
                {entry.global_rank}
              </span>
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                {entry.avatar || entry.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{entry.name}</p>
                {entry.nickname && (
                  <p className="text-[10px] text-muted-foreground truncate">{entry.nickname}</p>
                )}
              </div>
              <span className="text-xs font-bold text-muted-foreground">{(entry.xp || 0).toLocaleString()}xp</span>
            </div>
          ))
        )}
      </div>

      {/* Show more */}
      {rankings.length > 8 && (
        <Button
          variant="ghost"
          className="w-full mt-3 text-primary text-sm"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Ver menos' : 'Ver ranking completo'}
          <ChevronDown className={cn("w-4 h-4 ml-1 transition-transform", showAll && "rotate-180")} />
        </Button>
      )}
    </Card>
  );
};

export default MiniLeaderboard;
