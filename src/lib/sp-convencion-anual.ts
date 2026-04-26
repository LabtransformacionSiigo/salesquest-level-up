// Single source of truth for SP Convención anual (VN channels).
// Mirrors EquipoMensualGrid + VnHistorialSection exactly:
//   - units FE/Nube/Total: ventas_gerente_mensual (filtered by celula or gerente_normalizado)
//   - meta FE/Nube/Total: metas_asesores (filtered by celula or gerente, "Sin novedad")
//   - ACV total: sum of ventas_gerente_mensual.acv (same filter)
//   - meta ACV: metas_acv_gerentes (filtered by celula)
// Formula per month: SP = cap(%FE) + cap(%Nube)*2 + cap(%ACV); cap = min(300, max(0, round(v))).
// Total = sum of monthly SP.

const MES3_TO_MM: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04',
  may: '05', jun: '06', jul: '07', ago: '08',
  sep: '09', oct: '10', nov: '11', dic: '12',
};

export const normalizeSpText = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const cap = (v: number) => Math.min(300, Math.max(0, Math.round(v || 0)));

export interface VgmRow {
  periodo?: string | null;
  familia?: string | null;
  unidades?: number | null;
  acv?: number | null;
  celula?: string | null;
  gerente_normalizado?: string | null;
}

export interface MetaAsesorRow {
  anio_mes?: string | null;
  novedad?: string | null;
  celula?: string | null;
  gerente?: string | null;
  meta_fe?: number | null;
  meta_nube?: number | null;
  meta_total?: number | null;
}

export interface MetaAcvGerenteRow {
  celula?: string | null;
  mes?: string | null;
  meta_total_acv?: number | null;
}

export interface SpAnualInputs {
  vgmRows: VgmRow[];
  metaAsesorRows: MetaAsesorRow[];
  metaAcvRows: MetaAcvGerenteRow[];
  year: string; // e.g. "2026"
}

/**
 * Compute SP Convención anual for a single celula (or by gerente_normalizado fallback).
 * @returns total SP across all months with data
 */
export function computeSpConvencionAnualForCelula(
  inputs: SpAnualInputs,
  celula: string | null | undefined,
  gerenteNombre?: string | null
): number {
  const celulaNorm = normalizeSpText(celula);
  const gerenteNorm = normalizeSpText(gerenteNombre);
  const { vgmRows, metaAsesorRows, metaAcvRows, year } = inputs;

  // 1) Filter ventas_gerente_mensual by celula or gerente_normalizado
  const vgm = vgmRows.filter((row) => {
    if (celulaNorm && normalizeSpText(row.celula) === celulaNorm) return true;
    if (gerenteNorm && normalizeSpText(row.gerente_normalizado) === gerenteNorm) return true;
    return false;
  });

  // 2) Filter metas_asesores by celula or gerente, exclude novedad
  const metasFiltered = metaAsesorRows.filter((row) => {
    const nov = String(row.novedad ?? '').trim();
    if (nov && nov !== 'Sin novedad') return false;
    if (celulaNorm && normalizeSpText(row.celula) === celulaNorm) return true;
    if (gerenteNorm && normalizeSpText(row.gerente) === gerenteNorm) return true;
    return false;
  });

  const metasPorPeriodo = new Map<string, { meta_fe: number; meta_nube: number; meta_total: number }>();
  metasFiltered.forEach((row) => {
    const p = String(row.anio_mes ?? '');
    if (!/^\d{6}$/.test(p)) return;
    const cur = metasPorPeriodo.get(p) ?? { meta_fe: 0, meta_nube: 0, meta_total: 0 };
    cur.meta_fe += Number(row.meta_fe) || 0;
    cur.meta_nube += Number(row.meta_nube) || 0;
    cur.meta_total += Number(row.meta_total) || 0;
    metasPorPeriodo.set(p, cur);
  });

  // 3) Filter metas_acv_gerentes by celula
  const metasAcvPorPeriodo = new Map<string, number>();
  metaAcvRows
    .filter((row) => celulaNorm && normalizeSpText(row.celula) === celulaNorm)
    .forEach((row) => {
      const mesKey = String(row.mes ?? '').trim().toLowerCase().slice(0, 3);
      const mm = MES3_TO_MM[mesKey];
      if (!mm) return;
      const periodo = `${year}${mm}`;
      metasAcvPorPeriodo.set(periodo, (metasAcvPorPeriodo.get(periodo) ?? 0) + (Number(row.meta_total_acv) || 0));
    });

  // 4) Combine all periods
  const periodSet = new Set<string>();
  vgm.forEach((r) => { if (/^\d{6}$/.test(String(r.periodo))) periodSet.add(String(r.periodo)); });
  metasPorPeriodo.forEach((_, p) => periodSet.add(p));
  metasAcvPorPeriodo.forEach((_, p) => periodSet.add(p));

  let totalSp = 0;
  periodSet.forEach((periodo) => {
    const periodVgm = vgm.filter((r) => String(r.periodo) === periodo);
    const metas = metasPorPeriodo.get(periodo) ?? { meta_fe: 0, meta_nube: 0, meta_total: 0 };
    const metaAcv = metasAcvPorPeriodo.get(periodo) ?? 0;

    let ventas_fe = 0, ventas_nube = 0, acv_total = 0;
    periodVgm.forEach((r) => {
      const u = Math.round(Number(r.unidades) || 0);
      const acv = Number(r.acv) || 0;
      const fam = String(r.familia || '').toUpperCase();
      if (fam === 'FE') ventas_fe += u;
      else if (fam === 'NUBE') ventas_nube += u;
      acv_total += acv;
    });

    const pct_fe = metas.meta_fe > 0 ? cap((ventas_fe / metas.meta_fe) * 100) : 0;
    const pct_nube = metas.meta_nube > 0 ? cap((ventas_nube / metas.meta_nube) * 100) : 0;
    const pct_acv = metaAcv > 0 ? cap((acv_total / metaAcv) * 100) : 0;
    totalSp += pct_fe + pct_nube * 2 + pct_acv;
  });

  return totalSp;
}
