import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { useRankings } from '@/hooks/useRankings';
import { cn } from '@/lib/utils';
import { getCountryFlag } from '@/utils/countryFlags';

type TabType = 'country' | 'segment' | 'cell';

interface MiniLeaderboardProps {
  currentUserId?: string;
}

const MiniLeaderboard = ({ currentUserId }: MiniLeaderboardProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('country');
  const [showAll, setShowAll] = useState(false);
  const { rankings, loading } = useRankings({});

  const hasPodium = rankings.length >= 3;
  const topThree = hasPodium ? rankings.slice(0, 3) : [];
  const listEntries = hasPodium
    ? (showAll ? rankings.slice(3) : rankings.slice(3, 8))
    : (showAll ? rankings : rankings.slice(0, 8));

  // Reorder top 3 for podium: [2nd, 1st, 3rd]
  const podiumOrder = hasPodium
    ? [topThree[1], topThree[0], topThree[2]]
    : [];

  const tabs: { key: TabType; label: string }[] = [
    { key: 'country', label: 'País' },
    { key: 'segment', label: 'Segmento' },
    { key: 'cell', label: 'Canal' },
  ];

  return (
    <Card className="p-5 border border-border shadow-none">
      {/* Tabs */}
      <div className="flex gap-0 mb-5 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px",
              activeTab === tab.key
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Podium */}
      {!loading && topThree.length >= 3 && (
        <div className="flex items-end justify-center gap-4 mb-6">
          {podiumOrder.map((entry, idx) => {
            const isFirst = idx === 1;
            const rank = isFirst ? 1 : idx === 0 ? 2 : 3;

            return (
              <div key={entry.id} className="flex flex-col items-center">
                <span className={cn(
                  "text-sm font-bold mb-1",
                  rank === 1 ? "text-accent" : "text-muted-foreground"
                )}>
                  {rank}
                </span>
                <div className="relative">
                  <div className={cn(
                    "rounded-full bg-muted flex items-center justify-center font-bold",
                    isFirst
                      ? "w-16 h-16 text-2xl ring-3 ring-accent ring-offset-2"
                      : "w-12 h-12 text-lg"
                  )}>
                    {entry.avatar || entry.name?.charAt(0)}
                  </div>
                  {getCountryFlag(entry.country) && (
                    <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">{getCountryFlag(entry.country)}</span>
                  )}
                  {isFirst && (
                    <div className="absolute -top-2 -right-1">
                      <span className="material-icons-outlined text-accent text-base">emoji_events</span>
                    </div>
                  )}
                </div>
                <span className="text-xs font-semibold text-foreground mt-1.5 text-center max-w-[80px] truncate">
                  {entry.name?.split(' ')[0]}
                </span>
                <span className="text-[11px] font-bold text-primary">{(entry.xp || 0).toLocaleString()}xp</span>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      <div className="space-y-0.5">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-4">Cargando...</p>
        ) : listEntries.length === 0 && topThree.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">Sin datos</p>
        ) : (
          listEntries.map((entry) => (
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
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {entry.avatar || entry.name?.charAt(0)}
                </div>
                {getCountryFlag(entry.country) && (
                  <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">{getCountryFlag(entry.country)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{entry.name}</p>
                {entry.nickname && (
                  <p className="text-[10px] text-muted-foreground truncate">{entry.nickname}</p>
                )}
              </div>
              <span className="text-xs font-bold text-primary">{(entry.xp || 0).toLocaleString()}xp</span>
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
          <span className="material-icons-outlined text-sm ml-1">keyboard_arrow_down</span>
        </Button>
      )}
    </Card>
  );
};

export default MiniLeaderboard;
