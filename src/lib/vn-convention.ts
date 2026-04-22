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
 * Normaliza meta ACV considerando la escala del ACV real del periodo.
 * - COL almacena ACV y meta en COP completos (acv ~ millones, meta ~ 50–70 = 50M–70M).
 * - MEX/ECU/URU almacenan ya en escala "miles" (acv ~ 30k, meta ~ 18 = 18k de la misma escala).
 *
 * Regla: si la meta interpretada como millones (×1.000.000) es coherente con el orden de magnitud
 * del ACV → escalar (caso COL). Si no, asumir que ya está en la misma escala (MEX/ECU/URU).
 */
export const normalizeVnMetaAcv = (
  value: number | null | undefined,
  acvReference?: number | null,
) => {
  const n = Number(value) || 0;
  if (n <= 0) return 0;
  const abs = Math.abs(n);
  // Si ya viene en valor grande (>=100k), no escalar.
  if (abs >= 100_000) return Math.round(n);

  // Comparar contra ACV de referencia para decidir escala.
  const acv = Math.abs(Number(acvReference) || 0);
  if (acv > 0) {
    const scaled = abs * 1_000_000;
    // Si el ACV es mucho menor que la meta escalada (acv < scaled/100), la meta NO debe escalarse:
    // significa que ambos vienen en la misma escala chica (caso MEX/ECU).
    if (acv < scaled / 100) return Math.round(n);
  }
  // Caso COL histórico (sin referencia o ACV grande): escalar a millones.
  return Math.round(n * 1_000_000);
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
        return sum + normalizeVnMetaAcv(row.meta, normalizeStoredAcv(row.acv_f));
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