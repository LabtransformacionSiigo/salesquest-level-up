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
  meta_total_und?: number | null;
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

  // 3.5) Fallback proporcional: si un periodo tiene meta_total_und (de metas_acv_gerentes)
  // pero no tiene meta_fe/meta_nube en metas_asesores, derivar usando el feRatio del primer
  // periodo con metas reales. Replica la lógica de useGamificationMetrics.
  const metaTotalUndPorPeriodo = new Map<string, number>();
  metaAcvRows
    .filter((row) => celulaNorm && normalizeSpText(row.celula) === celulaNorm)
    .forEach((row) => {
      const mesKey = String(row.mes ?? '').trim().toLowerCase().slice(0, 3);
      const mm = MES3_TO_MM[mesKey];
      if (!mm) return;
      const periodo = `${year}${mm}`;
      const v = Number(row.meta_total_und) || 0;
      if (v > 0) metaTotalUndPorPeriodo.set(periodo, v);
    });

  // Buscar feRatio: primero ideal (FE+Nube+Total), luego sólo con meta_total>0 (algún FE),
  // y como último recurso 0.5 (split simétrico). Esto cubre países como MEX Aliados / URU
  // donde Abril tiene meta_nube=0 o meta_fe=0 y se necesitan estimar Ene/Feb/Mar.
  let feRatio: number | null = null;
  metasPorPeriodo.forEach(({ meta_fe, meta_nube, meta_total }) => {
    if (feRatio !== null) return;
    if (meta_fe > 0 && meta_nube > 0 && meta_total > 0) feRatio = meta_fe / meta_total;
  });
  if (feRatio === null) {
    metasPorPeriodo.forEach(({ meta_fe, meta_total }) => {
      if (feRatio !== null) return;
      if (meta_fe > 0 && meta_total > 0) feRatio = meta_fe / meta_total;
    });
  }
  if (feRatio === null && metaTotalUndPorPeriodo.size > 0) {
    feRatio = 0.5; // fallback simétrico cuando no hay ningún mes con desglose FE
  }

  if (feRatio !== null) {
    metaTotalUndPorPeriodo.forEach((totalUnd, periodo) => {
      const existing = metasPorPeriodo.get(periodo) ?? { meta_fe: 0, meta_nube: 0, meta_total: 0 };
      if (existing.meta_fe === 0 || existing.meta_nube === 0) {
        const fe = existing.meta_fe > 0 ? existing.meta_fe : Math.round(totalUnd * feRatio!);
        const nube = existing.meta_nube > 0 ? existing.meta_nube : Math.max(0, totalUnd - fe);
        metasPorPeriodo.set(periodo, {
          meta_fe: fe,
          meta_nube: nube,
          meta_total: totalUnd,
        });
      }
    });
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// Per-asesor SP Convención anual (VN). Source tables:
//  - metas_asesores (FE/Nube goals + documento + novedad)
//  - ejecucion_asesores (ventas_fe, ventas_nube, acv_total) keyed by documento_asesor
//  - productividad_asesores (acv_f + meta as fallback ACV) keyed by asesor name
// Formula identical to celula version: cap(%FE) + cap(%Nube)*2 + cap(%ACV).
// ─────────────────────────────────────────────────────────────────────────────

export interface EjecAsesorRow {
  periodo?: string | null;
  documento_asesor?: string | null;
  ventas_fe?: number | null;
  ventas_nube?: number | null;
  ventas_total?: number | null;
  acv_total?: number | null;
}

export interface ProductividadAsesorRow {
  anio_mes?: string | null;
  asesor?: string | null;
  meta?: number | null;
  acv_f?: number | null;
  pais?: string | null;
}

export interface MetaAsesorFullRow extends MetaAsesorRow {
  nombre_asesor?: string | null;
  documento_asesor?: string | null;
}

export interface SpAnualAsesorInputs {
  metaAsesorRows: MetaAsesorFullRow[];
  ejecAsesorRows: EjecAsesorRow[];
  productividadRows: ProductividadAsesorRow[];
  year: string;
}

const META_ACV_SCALE_BY_COUNTRY: Record<string, number> = {
  COL: 1_000_000, MEX: 1_000, ECU: 100, URU: 100,
};

const resolveCountryCode = (pais?: string | null): string | null => {
  if (!pais) return null;
  const n = String(pais).trim().toUpperCase();
  if (!n) return null;
  if (n === 'MX' || n.startsWith('MEX')) return 'MEX';
  if (n === 'CO' || n.startsWith('COL')) return 'COL';
  if (n === 'EC' || n.startsWith('ECU')) return 'ECU';
  if (n === 'UY' || n.startsWith('URU')) return 'URU';
  return n;
};

const normalizeMetaAcv = (value: number | null | undefined, pais?: string | null) => {
  const n = Number(value) || 0;
  if (n <= 0) return 0;
  if (Math.abs(n) >= 100_000) return Math.round(n);
  const country = resolveCountryCode(pais);
  const factor = (country && META_ACV_SCALE_BY_COUNTRY[country]) || 1_000_000;
  return Math.round(n * factor);
};

export function computeSpConvencionAnualForAsesor(
  inputs: SpAnualAsesorInputs,
  nombreAsesor: string | null | undefined,
): number {
  const asesorNorm = normalizeSpText(nombreAsesor);
  if (!asesorNorm) return 0;
  const { metaAsesorRows, ejecAsesorRows, productividadRows, year } = inputs;

  // Identify documento(s) for this asesor from metas_asesores.
  const documentos = new Set<string>();
  metaAsesorRows.forEach((row) => {
    if (normalizeSpText(row.nombre_asesor) === asesorNorm && row.documento_asesor) {
      documentos.add(String(row.documento_asesor).trim());
    }
  });

  // Metas FE/Nube por periodo (sólo "Sin novedad").
  const metasPorPeriodo = new Map<string, { fe: number; nube: number }>();
  metaAsesorRows.forEach((row) => {
    if (normalizeSpText(row.nombre_asesor) !== asesorNorm) return;
    const nov = String(row.novedad ?? '').trim();
    if (nov && nov !== 'Sin novedad') return;
    const p = String(row.anio_mes ?? '');
    if (!/^\d{6}$/.test(p)) return;
    const cur = metasPorPeriodo.get(p) ?? { fe: 0, nube: 0 };
    cur.fe += Number(row.meta_fe) || 0;
    cur.nube += Number(row.meta_nube) || 0;
    metasPorPeriodo.set(p, cur);
  });

  // Ejecución FE/Nube/ACV por periodo (por documento).
  const ejecPorPeriodo = new Map<string, { fe: number; nube: number; acv: number }>();
  ejecAsesorRows.forEach((row) => {
    const doc = String(row.documento_asesor ?? '').trim();
    if (!doc || !documentos.has(doc)) return;
    const p = String(row.periodo ?? '');
    if (!/^\d{6}$/.test(p)) return;
    const cur = ejecPorPeriodo.get(p) ?? { fe: 0, nube: 0, acv: 0 };
    cur.fe += Number(row.ventas_fe) || 0;
    cur.nube += Number(row.ventas_nube) || 0;
    cur.acv += Number(row.acv_total) || 0;
    ejecPorPeriodo.set(p, cur);
  });

  // Productividad: ACV real (acv_f) y meta ACV (meta escalada) por periodo.
  const acvPorPeriodo = new Map<string, number>();
  const metaAcvPorPeriodo = new Map<string, number>();
  productividadRows.forEach((row) => {
    if (normalizeSpText(row.asesor) !== asesorNorm) return;
    const p = String(row.anio_mes ?? '');
    if (!/^\d{6}$/.test(p)) return;
    acvPorPeriodo.set(p, (acvPorPeriodo.get(p) ?? 0) + (Number(row.acv_f) || 0));
    metaAcvPorPeriodo.set(p, (metaAcvPorPeriodo.get(p) ?? 0) + normalizeMetaAcv(row.meta, row.pais));
  });

  const periodos = new Set<string>([
    ...metasPorPeriodo.keys(),
    ...ejecPorPeriodo.keys(),
    ...metaAcvPorPeriodo.keys(),
  ]);

  let totalSp = 0;
  periodos.forEach((periodo) => {
    if (!periodo.startsWith(year)) return;
    const metas = metasPorPeriodo.get(periodo) ?? { fe: 0, nube: 0 };
    const ejec = ejecPorPeriodo.get(periodo) ?? { fe: 0, nube: 0, acv: 0 };
    const acv = acvPorPeriodo.get(periodo) ?? ejec.acv;
    const metaAcv = metaAcvPorPeriodo.get(periodo) ?? 0;

    const pct_fe = metas.fe > 0 ? cap((ejec.fe / metas.fe) * 100) : 0;
    const pct_nube = metas.nube > 0 ? cap((ejec.nube / metas.nube) * 100) : 0;
    const pct_acv = metaAcv > 0 ? cap((acv / metaAcv) * 100) : 0;
    totalSp += pct_fe + pct_nube * 2 + pct_acv;
  });

  return totalSp;
}
