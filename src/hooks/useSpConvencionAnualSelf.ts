// FUENTE ÚNICA de SP Convención anual para el usuario logueado.
// Se calcula EXACTAMENTE como el "Total SP Convención 2026" de la tabla
// Historial Mensual en /mi-progreso. Cualquier UI que muestre SP Convención
// (Header, Sidebar, Panel General, Ranking propio, etc.) debe consumir este
// hook o el store `useSpConvencionAnual` que este hook alimenta.
//
// Implementación: reutiliza useGamificationMetrics (que ya produce
// `vcMonthlyCumplimiento`, la misma estructura que renderiza la tabla
// Historial Mensual) y suma su columna `sp`. Así nunca puede haber dos
// totales distintos.

import { useEffect, useMemo } from 'react';
import { useGamificationMetrics } from '@/hooks/useGamificationMetrics';
import { setSpConvencionAnual } from '@/lib/sp-convencion-store';

export function useSpConvencionAnualSelf(profile: any): number | null {
  const canal = profile?.canal;
  const isVN = canal === 'VN_ALIADOS' || canal === 'VN_EMPRESARIOS';

  // Solo activamos useGamificationMetrics cuando es VN — para canales VC no
  // queremos disparar todas las queries de gamificación desde el Header.
  // Pasamos null profile para que el hook salga temprano (early return).
  const metrics = useGamificationMetrics(isVN ? profile : null);


  const total = useMemo(() => {
    if (!isVN) return null;
    const rows = metrics?.vcMonthlyCumplimiento || [];
    if (!rows.length) return null;
    const sum = rows.reduce((s: number, m: any) => s + (Number(m?.sp) || 0), 0);
    return sum;
  }, [isVN, metrics?.vcMonthlyCumplimiento]);

  useEffect(() => {
    if (total != null && total >= 0) setSpConvencionAnual(total);
  }, [total]);

  return total;
}
