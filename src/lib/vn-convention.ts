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

export interface VnConventionManagerSourceRow {
  periodo?: string | null;
  familia?: string | null;
  unidades?: number | null;
  acv?: number | null;
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
  pctTotal: number;
  sp: number;
}

export const normalizeComparableText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const matchesNormalizedPerson = (candidate: string, aliases: Set<string>) => {
  if (!candidate || aliases.size === 0) return false;
  if (aliases.has(candidate)) return true;
  const candidateShort = candidate.slice(0, 28);
  for (const alias of aliases) {
    const aliasShort = alias.slice(0, 28);
    if (candidateShort === aliasShort || candidate.startsWith(aliasShort) || alias.startsWith(candidateShort)) {
      return true;
    }
  }
  return false;
};

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

/**
 * Catálogo oficial de metas ACV por gerente/célula provenientes de
 * `metas_acv_gerentes` (origen: Databricks tbl_brz_cuotas_asesores).
 * Esta es la VERDAD para metas ACV de gerentes de Venta Nueva.
 */
export interface VnAcvCatalogRow {
  pais?: string | null;
  canal?: string | null;
  celula?: string | null;
  mes?: string | null;        // "Mar", "Abr", etc.
  meta_total_acv?: number | null;
  meta_total_und?: number | null;
}

const MES_3_TO_NUM: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
};

const periodToMes3 = (period: string): string => {
  // period viene como YYYYMM o YYYY-MM
  const m = String(period || '').replace(/[^0-9]/g, '').slice(-2);
  const inv: Record<string, string> = {
    '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr', '05': 'may', '06': 'jun',
    '07': 'jul', '08': 'ago', '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic',
  };
  return inv[m] || '';
};

/**
 * Busca la meta ACV oficial de la célula para un periodo dado.
 * Devuelve null si no hay registro en el catálogo (para hacer fallback).
 */
export const getOfficialMetaAcv = (
  period: string,
  celula: string | null | undefined,
  catalog: VnAcvCatalogRow[] | null | undefined,
): number | null => {
  if (!catalog?.length || !celula) return null;
  const mes3 = periodToMes3(period);
  if (!mes3) return null;
  const celulaNorm = normalizeComparableText(celula);
  const match = catalog.find((r) => {
    const rowMes = String(r.mes || '').trim().toLowerCase().slice(0, 3);
    return rowMes === mes3 && normalizeComparableText(r.celula) === celulaNorm;
  });
  if (!match) return null;
  const v = Number(match.meta_total_acv) || 0;
  return v > 0 ? v : null;
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
  acvCatalog,
  celula,
}: {
  productivityRows?: VnConventionProductivityRow[] | null;
  metaRows?: VnConventionMetaRow[] | null;
  ejecRows?: VnConventionEjecRow[] | null;
  acvCatalog?: VnAcvCatalogRow[] | null;
  celula?: string | null;
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
      const periodMetaNames = new Set(
        activeMetas.map((row) => normalizeComparableText(row.nombre_asesor)).filter(Boolean)
      );
      const periodAliases = new Set([...periodTeamNames, ...periodMetaNames]);
      const activeEjecRows = (ejecRows || []).filter(
        (row) =>
          String(row.periodo || '') === period &&
          matchesNormalizedPerson(normalizeComparableText(row.documento_asesor), periodAliases)
      );

      const acv = periodProductivity.reduce((sum, row) => sum + normalizeStoredAcv(row.acv_f), 0);
      // Verdad oficial: metas_acv_gerentes (Databricks). Fallback: suma productividad.
      const officialMetaAcv = getOfficialMetaAcv(period, celula, acvCatalog);
      const metaAcv = officialMetaAcv ?? periodProductivity.reduce((sum, row) => {
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

      // Cap each metric percentage to 300% to prevent runaway SP from
      // corrupted source data (e.g. ACV stored at wrong scale). Same cap is
      // enforced server-side in calcular-sp-semanal.
      const CAP = 300;
      let pctAcv = metaAcv > 0 && acv > 0 ? Math.round((acv / metaAcv) * 100) : 0;
      if (pctAcv > CAP) pctAcv = CAP;
      let pctFe = metaFe > 0 && ventasFe > 0 ? Math.round((ventasFe / metaFe) * 100) : 0;
      if (pctFe > CAP) pctFe = CAP;
      let pctNube = metaNube > 0 && ventasNube > 0 ? Math.round((ventasNube / metaNube) * 100) : 0;
      if (pctNube > CAP) pctNube = CAP;
      let pctTotal = metaTotal > 0 && ventasTotal > 0 ? Math.round((ventasTotal / metaTotal) * 100) : 0;
      if (pctTotal > CAP) pctTotal = CAP;

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
        pctTotal,
        sp: pctAcv + pctFe + pctNube * 2,
      };
    });

  return monthlyRows;
};

export const buildVnConventionMonthlyRowsFromManagerSources = ({
  productivityRows,
  metaRows,
  managerRows,
  acvCatalog,
  celula,
}: {
  productivityRows?: VnConventionProductivityRow[] | null;
  metaRows?: VnConventionMetaRow[] | null;
  managerRows?: VnConventionManagerSourceRow[] | null;
  acvCatalog?: VnAcvCatalogRow[] | null;
  celula?: string | null;
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

  (managerRows || []).forEach((row) => {
    const period = String(row.periodo || '');
    if (period) periodSet.add(period);
  });

  return [...periodSet]
    .sort((a, b) => a.localeCompare(b))
    .map((period) => {
      const periodProductivity = (productivityRows || []).filter((row) => String(row.anio_mes || '') === period);
      const periodMetas = (metaRows || []).filter((row) => String(row.anio_mes || '') === period);
      const activeMetas = periodMetas.filter(isActiveMetaRow);
      const novedadNames = new Set(
        periodMetas
          .filter((row) => !isActiveMetaRow(row))
          .map((row) => normalizeComparableText(row.nombre_asesor))
          .filter(Boolean)
      );
      const periodManagerRows = (managerRows || []).filter((row) => String(row.periodo || '') === period);

      const acv = periodManagerRows.reduce((sum, row) => sum + (Number(row.acv) || 0), 0);
      // Verdad oficial: metas_acv_gerentes (Databricks). Fallback: suma productividad.
      const officialMetaAcv = getOfficialMetaAcv(period, celula, acvCatalog);
      const metaAcv = officialMetaAcv ?? periodProductivity.reduce((sum, row) => {
        const advisorName = normalizeComparableText(row.asesor);
        if (advisorName && novedadNames.has(advisorName)) return sum;
        return sum + normalizeVnMetaAcv(row.meta, row.pais);
      }, 0);
      const metaFe = activeMetas.reduce((sum, row) => sum + (Number(row.meta_fe) || 0), 0);
      const metaNube = activeMetas.reduce((sum, row) => sum + (Number(row.meta_nube) || 0), 0);
      const metaTotal = activeMetas.reduce((sum, row) => sum + (Number(row.meta_total) || 0), 0);
      const ventasFe = periodManagerRows.reduce((sum, row) => sum + (String(row.familia || '').toUpperCase() === 'FE' ? (Number(row.unidades) || 0) : 0), 0);
      const ventasNube = periodManagerRows.reduce((sum, row) => sum + (String(row.familia || '').toUpperCase() === 'NUBE' ? (Number(row.unidades) || 0) : 0), 0);
      const ventasTotal = periodManagerRows.reduce((sum, row) => sum + (Number(row.unidades) || 0), 0);

      const CAP = 300;
      let pctAcv = metaAcv > 0 && acv > 0 ? Math.round((acv / metaAcv) * 100) : 0;
      if (pctAcv > CAP) pctAcv = CAP;
      let pctFe = metaFe > 0 && ventasFe > 0 ? Math.round((ventasFe / metaFe) * 100) : 0;
      if (pctFe > CAP) pctFe = CAP;
      let pctNube = metaNube > 0 && ventasNube > 0 ? Math.round((ventasNube / metaNube) * 100) : 0;
      if (pctNube > CAP) pctNube = CAP;
      let pctTotal = metaTotal > 0 && ventasTotal > 0 ? Math.round((ventasTotal / metaTotal) * 100) : 0;
      if (pctTotal > CAP) pctTotal = CAP;

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
        pctTotal,
        sp: pctAcv + pctFe + pctNube * 2,
      };
    });
};

export const sumVnConventionMonthlyRows = (rows: VnConventionMonthlyRow[] | null | undefined) =>
  (rows || []).reduce((total, row) => total + (Number(row.sp) || 0), 0);