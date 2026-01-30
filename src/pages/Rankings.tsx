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
import { Trophy, Medal, Award, Star, Filter, RefreshCw } from 'lucide-react';

const COUNTRIES = ['Colombia', 'México', 'Argentina', 'Chile', 'Perú'];
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

  const clearFilters = () => {
    setFilters({});
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Badge className="bg-yellow-500 text-yellow-950">🥇 1°</Badge>;
      case 2:
        return <Badge className="bg-gray-400 text-gray-950">🥈 2°</Badge>;
      case 3:
        return <Badge className="bg-amber-700 text-white">🥉 3°</Badge>;
      default:
        return <Badge variant="outline">{rank}°</Badge>;
    }
  };

  return (
    <Layout title="Rankings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              Rankings de Gamificación
            </h1>
            <p className="text-muted-foreground mt-2">
              Competencia sana y reconocimiento continuo
            </p>
          </div>
          <Button variant="outline" onClick={() => fetchRankings()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Top 3 Podium */}
        <Card className="p-6 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Top 3 del Ranking
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {/* 2nd Place */}
            <div className="flex flex-col items-center justify-end">
              {topThree[1] && (
                <div className="text-center">
                  <div className="text-5xl mb-2">{topThree[1].avatar || '👤'}</div>
                  <p className="font-bold text-lg">{topThree[1].nickname || topThree[1].name}</p>
                  <p className="text-sm text-muted-foreground">{topThree[1].xp || 0} XP</p>
                  <div className="mt-2 bg-gray-400 text-white px-4 py-2 rounded-t-lg">
                    <Medal className="w-6 h-6 mx-auto" />
                    <span className="font-bold">2°</span>
                  </div>
                  <div className="h-16 bg-gray-300 dark:bg-gray-700 rounded-b-lg w-full" />
                </div>
              )}
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center justify-end">
              {topThree[0] && (
                <div className="text-center">
                  <div className="text-6xl mb-2">{topThree[0].avatar || '👤'}</div>
                  <p className="font-bold text-xl">{topThree[0].nickname || topThree[0].name}</p>
                  <p className="text-sm text-muted-foreground">{topThree[0].xp || 0} XP</p>
                  <div className="mt-2 bg-yellow-500 text-yellow-950 px-4 py-3 rounded-t-lg">
                    <Trophy className="w-8 h-8 mx-auto" />
                    <span className="font-bold text-lg">1°</span>
                  </div>
                  <div className="h-24 bg-yellow-400 dark:bg-yellow-600 rounded-b-lg w-full" />
                </div>
              )}
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center justify-end">
              {topThree[2] && (
                <div className="text-center">
                  <div className="text-5xl mb-2">{topThree[2].avatar || '👤'}</div>
                  <p className="font-bold text-lg">{topThree[2].nickname || topThree[2].name}</p>
                  <p className="text-sm text-muted-foreground">{topThree[2].xp || 0} XP</p>
                  <div className="mt-2 bg-amber-700 text-white px-4 py-2 rounded-t-lg">
                    <Award className="w-6 h-6 mx-auto" />
                    <span className="font-bold">3°</span>
                  </div>
                  <div className="h-12 bg-amber-600 dark:bg-amber-800 rounded-b-lg w-full" />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* My Position */}
        {myPosition && (
          <Card className="p-4 border-2 border-primary">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{profile?.avatar || '👤'}</span>
                <div>
                  <p className="font-bold">Tu Posición</p>
                  <p className="text-sm text-muted-foreground">{profile?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{myPosition.xp || 0} XP</p>
                  <p className="text-sm text-muted-foreground">Experiencia total</p>
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
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Filtros:</span>
            </div>
            <Select
              value={filters.cell_id || ''}
              onValueChange={v => setFilters({ ...filters, cell_id: v || undefined })}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas las células" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las células</SelectItem>
                {cells.map(cell => (
                  <SelectItem key={cell.id} value={cell.id}>{cell.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.country || ''}
              onValueChange={v => setFilters({ ...filters, country: v || undefined })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Todos los países" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los países</SelectItem>
                {COUNTRIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.segment || ''}
              onValueChange={v => setFilters({ ...filters, segment: v || undefined })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Todos los segmentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los segmentos</SelectItem>
                {SEGMENTS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filters.cell_id || filters.country || filters.segment) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </Card>

        {/* Full Ranking Table */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Ranking General</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Posición</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Célula</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead className="text-right">XP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Cargando rankings...
                    </TableCell>
                  </TableRow>
                ) : rankings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay datos de ranking disponibles
                    </TableCell>
                  </TableRow>
                ) : (
                  rankings.map((entry, index) => (
                    <TableRow 
                      key={entry.id}
                      className={entry.id === profile?.id ? 'bg-primary/10' : ''}
                    >
                      <TableCell>{getRankBadge(entry.global_rank)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{entry.avatar || '👤'}</span>
                          <div>
                            <p className="font-medium">{entry.name}</p>
                            {entry.nickname && (
                              <p className="text-xs text-muted-foreground">"{entry.nickname}"</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{entry.cell_name || '-'}</TableCell>
                      <TableCell>{entry.country || '-'}</TableCell>
                      <TableCell>
                        {entry.segment ? (
                          <Badge variant="secondary">{entry.segment}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold">{entry.xp || 0} XP</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Strategic Message */}
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-2">
          <p className="text-center text-lg font-medium">
            "Impulsando el éxito comercial a través del reconocimiento, 
            la competencia sana y el crecimiento continuo"
          </p>
        </Card>
      </div>
    </Layout>
  );
};

export default Rankings;
