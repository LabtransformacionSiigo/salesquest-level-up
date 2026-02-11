import { useState } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useRankings, RankingFilters } from '@/hooks/useRankings';
import { useCells } from '@/hooks/useCells';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getCountryFlag } from '@/utils/countryFlags';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const COUNTRIES = ['Colombia', 'México', 'Ecuador', 'Perú', 'Chile', 'Uruguay'];
const SEGMENTS = ['Empresarios', 'Aliados', 'B&M', 'Despachos'];

const Rankings = () => {
  const { isAuthenticated, profile } = useSupabaseAuthContext();
  const { cells } = useCells();
  const [filters, setFilters] = useState<RankingFilters>({});
  const { rankings, loading, fetchRankings, getTopThree, getUserPosition } = useRankings(filters);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const topThree = getTopThree();
  const myPosition = profile?.id ? getUserPosition(profile.id) : null;

  const clearFilters = () => setFilters({});

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-950 shadow-sm">🥇 1°</Badge>;
      case 2:
        return <Badge className="bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800 shadow-sm">🥈 2°</Badge>;
      case 3:
        return <Badge className="bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm">🥉 3°</Badge>;
      default:
        return <Badge variant="outline" className="font-bold">{rank}°</Badge>;
    }
  };

  return (
    <Layout title="Rankings">
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <MI icon="leaderboard" className="text-primary text-2xl" />
              Rankings
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Competencia sana y reconocimiento continuo
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchRankings()} disabled={loading} className="gap-1.5">
            <MI icon="refresh" className={cn("text-base", loading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>

        {/* Top 3 Podium */}
        <Card className="p-6 border-2 border-primary/10 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2 relative z-10">
            <MI icon="emoji_events" className="text-yellow-500 text-xl" />
            Top 3 del Ranking
          </h2>
          <div className="grid grid-cols-3 gap-4 relative z-10">
            {/* 2nd Place */}
            <div className="flex flex-col items-center justify-end pt-6">
              {topThree[1] && (
                <div className="text-center">
                  <div className="relative inline-block">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-3xl shadow-sm">
                      {topThree[1].avatar || '👤'}
                    </div>
                    {getCountryFlag(topThree[1].country) && (
                      <span className="absolute -bottom-1 -right-1 text-lg drop-shadow-sm">{getCountryFlag(topThree[1].country)}</span>
                    )}
                  </div>
                  <p className="font-bold text-sm mt-2">{topThree[1].nickname || topThree[1].name}</p>
                  <p className="text-xs text-muted-foreground font-medium">{(topThree[1].xp || 0).toLocaleString()} XP</p>
                  <div className="mt-2 bg-gradient-to-b from-gray-300 to-gray-400 text-gray-800 px-4 py-2 rounded-t-lg">
                    <MI icon="workspace_premium" className="text-2xl" />
                    <p className="font-bold text-sm">2°</p>
                  </div>
                  <div className="h-14 bg-gray-200 rounded-b-lg w-full" />
                </div>
              )}
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center justify-end">
              {topThree[0] && (
                <div className="text-center">
                  <div className="relative inline-block">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center text-4xl shadow-md ring-4 ring-yellow-200">
                      {topThree[0].avatar || '👤'}
                    </div>
                    {getCountryFlag(topThree[0].country) && (
                      <span className="absolute -bottom-1 -right-1 text-xl drop-shadow-sm">{getCountryFlag(topThree[0].country)}</span>
                    )}
                  </div>
                  <p className="font-bold text-base mt-2">{topThree[0].nickname || topThree[0].name}</p>
                  <p className="text-xs text-muted-foreground font-medium">{(topThree[0].xp || 0).toLocaleString()} XP</p>
                  <div className="mt-2 bg-gradient-to-b from-yellow-400 to-yellow-500 text-yellow-950 px-4 py-3 rounded-t-lg">
                    <MI icon="emoji_events" className="text-3xl" />
                    <p className="font-bold">1°</p>
                  </div>
                  <div className="h-20 bg-yellow-300 rounded-b-lg w-full" />
                </div>
              )}
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center justify-end pt-8">
              {topThree[2] && (
                <div className="text-center">
                  <div className="relative inline-block">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-2xl shadow-sm">
                      {topThree[2].avatar || '👤'}
                    </div>
                    {getCountryFlag(topThree[2].country) && (
                      <span className="absolute -bottom-1 -right-1 text-lg drop-shadow-sm">{getCountryFlag(topThree[2].country)}</span>
                    )}
                  </div>
                  <p className="font-bold text-sm mt-2">{topThree[2].nickname || topThree[2].name}</p>
                  <p className="text-xs text-muted-foreground font-medium">{(topThree[2].xp || 0).toLocaleString()} XP</p>
                  <div className="mt-2 bg-gradient-to-b from-amber-600 to-amber-700 text-white px-4 py-2 rounded-t-lg">
                    <MI icon="military_tech" className="text-2xl" />
                    <p className="font-bold text-sm">3°</p>
                  </div>
                  <div className="h-10 bg-amber-500 rounded-b-lg w-full" />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* My Position */}
        {myPosition && (
          <Card className="p-4 border-2 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="text-3xl">{profile?.avatar || '👤'}</span>
                  {getCountryFlag(profile?.country) && (
                    <span className="absolute -bottom-1 -right-1 text-sm">{getCountryFlag(profile?.country)}</span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm">Tu Posición</p>
                  <p className="text-xs text-muted-foreground">{profile?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">{(myPosition.xp || 0).toLocaleString()} XP</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Experiencia total</p>
                </div>
                {getRankBadge(myPosition.global_rank)}
              </div>
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <MI icon="filter_list" className="text-muted-foreground text-lg" />
              <span className="font-semibold text-sm">Filtros:</span>
            </div>
            <Select
              value={filters.cell_id || 'all'}
              onValueChange={v => setFilters({ ...filters, cell_id: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Todas las células" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las células</SelectItem>
                {cells.map(cell => (
                  <SelectItem key={cell.id} value={cell.id}>{cell.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.country || 'all'}
              onValueChange={v => setFilters({ ...filters, country: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Todos los países" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🌎 Todos los países</SelectItem>
                {COUNTRIES.map(c => (
                  <SelectItem key={c} value={c}>{getCountryFlag(c)} {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.segment || 'all'}
              onValueChange={v => setFilters({ ...filters, segment: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Todos los segmentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los segmentos</SelectItem>
                {SEGMENTS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filters.cell_id || filters.country || filters.segment) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-destructive">
                <MI icon="close" className="text-base mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </Card>

        {/* Full Ranking Table */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MI icon="format_list_numbered" className="text-primary text-lg" />
              Ranking General
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-20 font-semibold">Pos.</TableHead>
                <TableHead className="font-semibold">Usuario</TableHead>
                <TableHead className="font-semibold">Célula</TableHead>
                <TableHead className="font-semibold">País</TableHead>
                <TableHead className="font-semibold">Segmento</TableHead>
                <TableHead className="text-right font-semibold">XP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <MI icon="refresh" className="text-primary animate-spin" />
                      <span className="text-muted-foreground">Cargando rankings...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rankings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay datos de ranking disponibles
                  </TableCell>
                </TableRow>
              ) : (
                rankings.map((entry) => (
                  <TableRow 
                    key={entry.id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      entry.id === profile?.id && 'bg-primary/5 border-l-2 border-l-primary'
                    )}
                  >
                    <TableCell>{getRankBadge(entry.global_rank)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <span className="text-2xl">{entry.avatar || '👤'}</span>
                          {getCountryFlag(entry.country) && (
                            <span className="absolute -bottom-1 -right-1 text-sm drop-shadow-sm">{getCountryFlag(entry.country)}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{entry.name}</p>
                          {entry.nickname && (
                            <p className="text-[11px] text-muted-foreground italic">"{entry.nickname}"</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{entry.cell_name || '-'}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm">
                        {getCountryFlag(entry.country) && <span>{getCountryFlag(entry.country)}</span>}
                        {entry.country || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.segment ? (
                        <Badge variant="secondary" className="text-xs">{entry.segment}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-primary">{(entry.xp || 0).toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground ml-1">XP</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Footer */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 rounded-xl p-4">
          <p className="text-center text-xs text-muted-foreground font-medium">
            "Impulsando el éxito comercial a través del reconocimiento, 
            la competencia sana y el crecimiento continuo"
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Rankings;
