export interface VnConventionProductivityRow {
  anio_mes?: string | null;
  asesor?: string | null;
  acv_f?: number | null;
  meta?: number | null;
  pais?: string | null;
}

export interface VnConventionMetaRow {
  anio_mes?: string | null;
  nombre_asesor?: string | null;
  meta_fe?: number | null;
  meta_nube?: number | null;
  meta_total?: number | null;
  novedad?: string | null;
}

export interface VnConventionEjecRow {
  periodo?: string | null;
  documento_asesor?: string | null;
  ventas_fe?: number | null;
  ventas_nube?: number | null;
  ventas_total?: number | null;
}

export interface VnConventionMonthlyRow {
  period: string;
  acv: number;
  metaAcv: number;
  metaFe: number;
  metaNube: number;
  metaTotal: number;
  ventasFe: number;
  ventasNube: number;
  ventasTotal: number;
  pctAcv: number;
  pctFe: number;
  pctNube: number;
  sp: number;
}

export const normalizeComparableText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Factor de escala de meta ACV por país, alineado al modelo de Databricks:
 * - COL: meta entera = millones de COP. Factor 1.000.000.
 * - MEX: meta entera = miles de MXN. Factor 1.000.
 * - ECU/URU: meta entera = centenas de USD. Factor 100.
 * Si meta ya viene en escala grande (>=100k), no se escala.
 */
export const META_ACV_SCALE_BY_COUNTRY: Record<string, number> = {
  COL: 1_000_000,
  MEX: 1_000,
  ECU: 100,
  URU: 100,
};

const resolveCountryCode = (pais?: string | null): string | null => {
  if (!pais) return null;
  const normalized = String(pais).trim().toUpperCase();
  if (!normalized) return null;
  // Mapear variantes comunes
  if (normalized === 'MX' || normalized.startsWith('MEX')) return 'MEX';
  if (normalized === 'CO' || normalized.startsWith('COL')) return 'COL';
  if (normalized === 'EC' || normalized.startsWith('ECU')) return 'ECU';
  if (normalized === 'UY' || normalized.startsWith('URU')) return 'URU';
  return normalized;
};

export const normalizeVnMetaAcv = (
  value: number | null | undefined,
  pais?: string | null,
) => {
  const n = Number(value) || 0;
  if (n <= 0) return 0;
  const abs = Math.abs(n);
  // Si ya viene en valor grande (>=100k), asumimos escala completa.
  if (abs >= 100_000) return Math.round(n);
  const country = resolveCountryCode(pais);
  const factor = (country && META_ACV_SCALE_BY_COUNTRY[country]) || 1_000_000;
  return Math.round(n * factor);
};

export const normalizeStoredAcv = (value: number | null | undefined) => {
  const n = Number(value) || 0;
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) >= 1_000_000_000_000) return Math.round(n / 1_000_000_000);
  return Math.round(n);
};

const isActiveMetaRow = (row: VnConventionMetaRow) => {
  const novedad = normalizeComparableText(row.novedad);
  return !novedad || novedad === 'sin novedad';
};

export const buildVnConventionMonthlyRows = ({
  productivityRows,
  metaRows,
  ejecRows,
}: {
  productivityRows?: VnConventionProductivityRow[] | null;
  metaRows?: VnConventionMetaRow[] | null;
  ejecRows?: VnConventionEjecRow[] | null;
}) => {
  const periodSet = new Set<string>();

  (productivityRows || []).forEach((row) => {
    const period = String(row.anio_mes || '');
    if (period) periodSet.add(period);
  });

  (metaRows || []).forEach((row) => {
    const period = String(row.anio_mes || '');
    if (period) periodSet.add(period);
  });

  const monthlyRows: VnConventionMonthlyRow[] = [...periodSet]
    .sort((a, b) => a.localeCompare(b))
    .map((period) => {
      const periodProductivity = (productivityRows || []).filter((row) => String(row.anio_mes || '') === period);
      const periodMetas = (metaRows || []).filter((row) => String(row.anio_mes || '') === period);
      const periodTeamNames = new Set(
        periodProductivity.map((row) => normalizeComparableText(row.asesor)).filter(Boolean)
      );
      const novedadNames = new Set(
        periodMetas
          .filter((row) => !isActiveMetaRow(row))
          .map((row) => normalizeComparableText(row.nombre_asesor))
          .filter(Boolean)
      );
      const activeMetas = periodMetas.filter(isActiveMetaRow);
      const activeEjecRows = (ejecRows || []).filter(
        (row) =>
          String(row.periodo || '') === period &&
          periodTeamNames.has(normalizeComparableText(row.documento_asesor))
      );

      const acv = periodProductivity.reduce((sum, row) => sum + normalizeStoredAcv(row.acv_f), 0);
      const metaAcv = periodProductivity.reduce((sum, row) => {
        const advisorName = normalizeComparableText(row.asesor);
        if (advisorName && novedadNames.has(advisorName)) return sum;
        return sum + normalizeVnMetaAcv(row.meta, row.pais);
      }, 0);
      const metaFe = activeMetas.reduce((sum, row) => sum + (Number(row.meta_fe) || 0), 0);
      const metaNube = activeMetas.reduce((sum, row) => sum + (Number(row.meta_nube) || 0), 0);
      const metaTotal = activeMetas.reduce((sum, row) => sum + (Number(row.meta_total) || 0), 0);
      const ventasFe = activeEjecRows.reduce((sum, row) => sum + (Number(row.ventas_fe) || 0), 0);
      const ventasNube = activeEjecRows.reduce((sum, row) => sum + (Number(row.ventas_nube) || 0), 0);
      const ventasTotal = activeEjecRows.reduce((sum, row) => sum + (Number(row.ventas_total) || 0), 0);

      const pctAcv = metaAcv > 0 && acv > 0 ? Math.round((acv / metaAcv) * 100) : 0;
      const pctFe = metaFe > 0 && ventasFe > 0 ? Math.round((ventasFe / metaFe) * 100) : 0;
      const pctNube = metaNube > 0 && ventasNube > 0 ? Math.round((ventasNube / metaNube) * 100) : 0;

      return {
        period,
        acv,
        metaAcv,
        metaFe,
        metaNube,
        metaTotal,
        ventasFe,
        ventasNube,
        ventasTotal,
        pctAcv,
        pctFe,
        pctNube,
        sp: pctAcv + pctFe + pctNube * 2,
      };
    });

  return monthlyRows;
};

export const sumVnConventionMonthlyRows = (rows: VnConventionMonthlyRow[] | null | undefined) =>
  (rows || []).reduce((total, row) => total + (Number(row.sp) || 0), 0);