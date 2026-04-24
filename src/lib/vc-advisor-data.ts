import { supabase } from '@/integrations/supabase/client';
import {
  filterVcAdvisorSales,
  getUnlockedVcAdvisorMedals,
  getVcAdvisorBlockTotals,
  getVcAdvisorDerivedMetrics,
  type MedalLike,
} from '@/lib/vc-advisor-metrics';
import { filterCatalogByScope } from '@/lib/catalog-scope';

export interface VcAdvisorProfileLike {
  id?: string | null;
  nombre?: string | null;
  gerente_id?: string | null;
  canal?: string | null;
  role?: string | null;
}

export interface VcAdvisorSnapshot {
  sales: any[];
  catalog: (MedalLike & { id?: string; descripcion?: string | null })[];
  metrics: ReturnType<typeof getVcAdvisorDerivedMetrics>;
  blockTotals: ReturnType<typeof getVcAdvisorBlockTotals>;
  medals: Array<{
    gerente_id?: string | null;
    medalla: string;
    fecha_desbloqueo: string | null;
    sp_otorgados: number | null;
  }>;
}

export const isVcAdvisorProfile = (profile?: VcAdvisorProfileLike | null) => (
  profile?.canal === 'VC' &&
  profile?.role === 'asesor' &&
  !!profile?.gerente_id &&
  !!profile?.nombre
);

export const getVcAdvisorSnapshot = async (profile?: VcAdvisorProfileLike | null): Promise<VcAdvisorSnapshot | null> => {
  if (!isVcAdvisorProfile(profile)) return null;

  const [salesRes, catalogRes, medalsRes] = await Promise.all([
    supabase
      .from('ventas')
      .select('fecha_facturacion, valor_producto, acv_plus, producto, comercial, gerente_id')
      .eq('gerente_id', profile.gerente_id)
      .order('fecha_facturacion', { ascending: false }),
    supabase
      .from('catalogo_medallas')
      .select('*')
      .eq('activo', true)
      .order('condicion_tipo')
      .order('nombre'),
    supabase
      .from('medallas')
      .select('*')
      .eq('gerente_id', profile.id || ''),
  ]);

  if (salesRes.error) throw salesRes.error;
  if (catalogRes.error) throw catalogRes.error;
  if (medalsRes.error) throw medalsRes.error;

  const sales = filterVcAdvisorSales(salesRes.data || [], profile.nombre, profile.gerente_id);
  const catalog = filterCatalogByScope(
    (catalogRes.data || []) as (MedalLike & { id?: string; descripcion?: string | null })[],
    profile,
  );
  const unlockedCatalog = getUnlockedVcAdvisorMedals(catalog, sales);
  const persistedMedals = medalsRes.data || [];
  const persistedNames = new Set(persistedMedals.map((medal) => medal.medalla));

  const mergedMedals = [
    ...persistedMedals,
    ...unlockedCatalog
      .filter((medal) => !persistedNames.has(medal.nombre))
      .map((medal) => ({
        gerente_id: profile.id,
        medalla: medal.nombre,
        fecha_desbloqueo: null,
        sp_otorgados: medal.sp,
      })),
  ].sort((a, b) => {
    const dateA = a.fecha_desbloqueo ? new Date(a.fecha_desbloqueo).getTime() : 0;
    const dateB = b.fecha_desbloqueo ? new Date(b.fecha_desbloqueo).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return (Number(b.sp_otorgados) || 0) - (Number(a.sp_otorgados) || 0);
  });

  return {
    sales,
    catalog,
    metrics: getVcAdvisorDerivedMetrics(sales),
    blockTotals: getVcAdvisorBlockTotals(sales),
    medals: mergedMedals,
  };
};
