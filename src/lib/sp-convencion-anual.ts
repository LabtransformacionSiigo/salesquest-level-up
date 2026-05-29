// Single source of truth for SP Convención anual (VN channels).
// FUENTE ÚNICA para metas de gerente: metas_acv_gerentes (origen Databricks
// tbl_brz_cuotas_gerentes), que ya trae meta_fe, meta_nube y meta_total_acv
// agregados a nivel célula/mes.
//   - units FE/Nube: ventas_gerente_mensual (filtered by celula or gerente_normalizado)
//   - ACV total: sum of ventas_gerente_mensual.acv (same filter)
//   - meta FE / meta Nube / meta ACV: metas_acv_gerentes (filtered by celula)
// Formula per month: SP = cap(%FE) + cap(%Nube)*2 + cap(%ACV); cap = min(300, max(0, round(v))).
// Total = sum of monthly SP. NO se usa metas_asesores ni fallback proporcional.

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
  gerente?: string | null;
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
  meta_fe?: number | null;
  meta_nube?: number | null;
  meta_total_acv?: number | null;
  meta_total_und?: number | null;
  archivo?: string | null;
}

export interface SpAnualInputs {
  vgmRows: VgmRow[];
  /** @deprecated kept for back-compat, no longer used by computeSpConvencionAnualForCelula */
  metaAsesorRows?: MetaAsesorRow[];
  metaAcvRows: MetaAcvGerenteRow[];
  year: string; // e.g. "2026"
  /** Primary source: vn_metricas_optimizadas (scope='gerente') rows for this gerente/celula */
  vnMetricasGerenteRows?: Array<{
    periodo?: string | null;
    mes_nro?: number | null;
    asesor?: string | null;
    tipo_producto1?: string | null;
    familia?: string | null;
    ventas?: number | null;
    acv_total?: number | null;
    celula?: string | null;
    gerente_normalizado?: string | null;
    gerente?: string | null;
  }>;
  ventasDiariasRows?: Array<{
    fecha?: string | null;
    tipo_producto?: string | null;
    producto?: string | null;
    unidades?: number | null;
    acv?: number | null;
    celula?: string | null;
    equipo?: string | null;
    director?: string | null;
    pais?: string | null;
  }>;
}

/**
 * Compute SP Convención anual for a single celula (or by gerente_normalizado fallback).
 * Single source for goals: metas_acv_gerentes (meta_fe, meta_nube, meta_total_acv).
 * @returns total SP across all months with data
 */
export function computeSpConvencionAnualForCelula(
  inputs: SpAnualInputs,
  celula: string | null | undefined,
  gerenteNombre?: string | null
): number {
  const celulaNorm = normalizeSpText(celula);
  const gerenteNorm = normalizeSpText(gerenteNombre);
  const { vgmRows, metaAcvRows, year } = inputs;

  // FUENTE ÚNICA: metas_acv_gerentes contiene meta_fe, meta_nube y meta_total_acv.
  // NUNCA usar metas_asesores para metas de gerentes (causaría duplicación).
  // Prioridad Cierre > Inicio: si existe fila Cierre para un periodo, esa gana
  // y reemplaza la de Inicio. NUNCA se suman ambas.
  const metasAcvTemp = new Map<string, { meta_fe: number; meta_nube: number; meta_acv: number; archivo: string }>();
  metaAcvRows
    .filter((row) => celulaNorm && normalizeSpText(row.celula) === celulaNorm)
    .forEach((row) => {
      const mesKey = String(row.mes ?? '').trim().toLowerCase().slice(0, 3);
      const mm = MES3_TO_MM[mesKey];
      if (!mm) return;
      const periodo = `${year}${mm}`;
      const archivo = String((row as any).archivo ?? '').toLowerCase();
      const existing = metasAcvTemp.get(periodo);
      const isCierre = archivo.includes('cierre');
      const existingIsCierre = existing?.archivo.includes('cierre') ?? false;
      // Solo reemplazar si:
      //  - no había nada, o
      //  - la nueva es Cierre y la existente NO es Cierre.
      // NUNCA acumular: siempre se reemplaza el valor, nunca se suma.
      if (!existing || (isCierre && !existingIsCierre)) {
        metasAcvTemp.set(periodo, {
          meta_fe: Number((row as any).meta_fe) || 0,
          meta_nube: Number((row as any).meta_nube) || 0,
          meta_acv: Number(row.meta_total_acv) || 0,
          archivo,
        });
      }
    });
  const metasPorPeriodo = new Map<string, { meta_fe: number; meta_nube: number; meta_acv: number }>();
  metasAcvTemp.forEach((v, p) => metasPorPeriodo.set(p, { meta_fe: v.meta_fe, meta_nube: v.meta_nube, meta_acv: v.meta_acv }));

  // Ventas reales desde fuente mensual oficial. México no siempre replica filas en
  // ventas_gerente_mensual; cuando no existen para la célula, usamos el consolidado
  // Databricks vn_metricas_optimizadas recibido por el ranking/historial mensual.
  const vgmBase = celulaNorm
    ? vgmRows.filter((row) => normalizeSpText(row.celula) === celulaNorm)
    : (gerenteNorm
        ? vgmRows.filter((row) => normalizeSpText(row.gerente_normalizado || row.gerente) === gerenteNorm)
        : []);
  const seenVgm = new Set<string>();
  const vgmFiltrados = vgmBase.filter((row) => {
    const key = [
      String(row.periodo || ''),
      normalizeSpText(row.familia),
      Math.round(Number(row.unidades) || 0),
      Math.round(Number(row.acv) || 0),
    ].join('|');
    if (seenVgm.has(key)) return false;
    seenVgm.add(key);
    return true;
  });

  const metricBase = (inputs.vnMetricasGerenteRows || []).filter((row) => {
    if (celulaNorm && normalizeSpText(row.celula) === celulaNorm) return true;
    if (!celulaNorm && gerenteNorm && normalizeSpText(row.gerente_normalizado || row.gerente) === gerenteNorm) return true;
    return false;
  });
  const metricRowsByPeriodFamily = new Map<string, { periodo: string; familia: string; unidades: number; acv: number }>();
  const metricHasAdvisorDetail = metricBase.some((row) => Boolean(String(row.asesor || '').trim()));
  metricBase.forEach((row) => {
    const periodo = String(row.periodo || (row.mes_nro ? `${year}${String(row.mes_nro).padStart(2, '0')}` : ''));
    if (!/^\d{6}$/.test(periodo)) return;
    const familiaRaw = String(row.familia || '').toUpperCase().trim();
    const tipoRaw = String(row.tipo_producto1 || '').toUpperCase().trim();
    const fam = (familiaRaw && familiaRaw !== 'OTRO' ? familiaRaw : tipoRaw) === 'CAMPANA' ||
      (familiaRaw && familiaRaw !== 'OTRO' ? familiaRaw : tipoRaw) === 'CAMPAÑA'
      ? 'NUBE'
      : (familiaRaw && familiaRaw !== 'OTRO' ? familiaRaw : tipoRaw);
    if (fam !== 'FE' && fam !== 'NUBE') return;
    const key = `${periodo}|${fam}`;
    const unidades = Math.round(Number(row.ventas) || 0);
    const acv = Math.round(Number(row.acv_total) || 0);
    const prev = metricRowsByPeriodFamily.get(key);
    if (metricHasAdvisorDetail) {
      metricRowsByPeriodFamily.set(key, {
        periodo,
        familia: fam,
        unidades: (prev?.unidades || 0) + unidades,
        acv: (prev?.acv || 0) + acv,
      });
    } else if (!prev || unidades > prev.unidades) {
      metricRowsByPeriodFamily.set(key, { periodo, familia: fam, unidades, acv });
    }
  });
  const ventasOficiales = vgmFiltrados.length > 0
    ? vgmFiltrados
    : Array.from(metricRowsByPeriodFamily.values());

  // Períodos a calcular: solo ventas oficiales de gerente mensual + metas oficiales.
  const periodSet = new Set<string>();
  ventasOficiales.forEach((r) => { if (/^\d{6}$/.test(String(r.periodo))) periodSet.add(String(r.periodo)); });
  metasPorPeriodo.forEach((_, p) => periodSet.add(p));

  let totalSp = 0;
  periodSet.forEach((periodo) => {
    if (!periodo.startsWith(String(year))) return;
    const metas = metasPorPeriodo.get(periodo) ?? { meta_fe: 0, meta_nube: 0, meta_acv: 0 };

    let ventas_fe = 0, ventas_nube = 0, acv_total = 0;
    const periodVgmRows = ventasOficiales.filter((r) => String(r.periodo) === periodo);
    if (periodVgmRows.length > 0) {
      periodVgmRows.forEach((r) => {
        const u = Math.round(Number(r.unidades) || 0);
        const acv = Number(r.acv) || 0;
        const fam = String(r.familia || '').toUpperCase();
        if (fam === 'FE') {
          ventas_fe += u;
          acv_total += acv;
        } else if (fam === 'NUBE') {
          ventas_nube += u;
          acv_total += acv;
        }
      });
    }

    const pct_fe = metas.meta_fe > 0 ? cap((ventas_fe / metas.meta_fe) * 100) : 0;
    const pct_nube = metas.meta_nube > 0 ? cap((ventas_nube / metas.meta_nube) * 100) : 0;
    const pct_acv = metas.meta_acv > 0 ? cap((acv_total / metas.meta_acv) * 100) : 0;
    totalSp += pct_fe + pct_nube * 2 + pct_acv;
  });

  return totalSp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-asesor SP Convención anual (VN). Source tables:
//  - metas_asesores (FE/Nube goals + novedad)
//  - ventas_diarias (FE/Nube execution by asesor)
// Formula asesores VN: cap(%FE) + cap(%Nube)*2. Sin ACV y sin fuentes fallback.
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

export interface VnMetricaRow {
  pais?:           string | null;
  periodo?:        string | null;
  mes_nro?:        number | null;
  asesor?:         string | null;
  familia?:        string | null;
  tipo_producto1?: string | null;
  ventas?:         number | null;
  total_productos?: number | null;
  acv_total?:      number | null;
}

export interface SpAnualAsesorInputs {
  metaAsesorRows: MetaAsesorFullRow[];
  ventasDiariasRows?: Array<{
    fecha?: string | null;
    asesor?: string | null;
    tipo_producto?: string | null;
    producto?: string | null;
    unidades?: number | null;
  }>;
  /** @deprecated no longer used for VN asesor convention points */
  ejecAsesorRows: EjecAsesorRow[];
  /** @deprecated no longer used for VN asesor convention points */
  productividadRows: ProductividadAsesorRow[];
  vnMetricasRows?: VnMetricaRow[];
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
  const { metaAsesorRows, year } = inputs;

  // Metas FE/Nube por periodo del asesor individual.
  const metasPorPeriodo = new Map<string, { fe: number; nube: number }>();
  metaAsesorRows.forEach((row) => {
    if (normalizeSpText(row.nombre_asesor) !== asesorNorm) return;
    const p = String(row.anio_mes ?? '');
    if (!/^\d{6}$/.test(p)) return;
    const cur = metasPorPeriodo.get(p) ?? { fe: 0, nube: 0 };
    cur.fe += Number(row.meta_fe) || 0;
    cur.nube += Number(row.meta_nube) || 0;
    metasPorPeriodo.set(p, cur);
  });

  // Ejecución FE/Nube por periodo desde la tabla consolidada por asesor.
  const metricasPorPeriodo = new Map<string, { fe: number; nube: number }>();
  (inputs.vnMetricasRows || []).forEach((row) => {
    if (normalizeSpText(row.asesor) !== asesorNorm) return;
    const p = String(row.periodo || (row.mes_nro ? `${year}${String(row.mes_nro).padStart(2, '0')}` : ''));
    if (!/^\d{6}$/.test(p)) return;
    const tipo = String(row.familia || row.tipo_producto1 || '').toUpperCase().trim();
    const fam = tipo === 'CAMPANA' || tipo === 'CAMPAÑA' ? 'NUBE' : tipo;
    if (fam !== 'FE' && fam !== 'NUBE') return;
    const cur = metricasPorPeriodo.get(p) ?? { fe: 0, nube: 0 };
    const unidades = Math.round(Number(row.ventas ?? row.total_productos) || 0);
    if (fam === 'FE') cur.fe += unidades;
    if (fam === 'NUBE') cur.nube += unidades;
    metricasPorPeriodo.set(p, cur);
  });

  // Ejecución FE/Nube por periodo desde ventas_diarias cuando no exista consolidado.
  const ventasDiariasPorPeriodo = new Map<string, { fe: number; nube: number }>();
  (inputs.ventasDiariasRows || []).forEach((row) => {
    if (normalizeSpText(row.asesor) !== asesorNorm) return;
    const fecha = String(row.fecha ?? '');
    const p = fecha.length >= 7 ? fecha.slice(0, 7).replace('-', '') : '';
    if (!/^\d{6}$/.test(p)) return;
    const tipo = String(row.tipo_producto || row.producto || '').toUpperCase().trim();
    const fam = tipo === 'CAMPANA' || tipo === 'CAMPAÑA' ? 'NUBE' : tipo;
    if (fam !== 'FE' && fam !== 'NUBE') return;
    const cur = ventasDiariasPorPeriodo.get(p) ?? { fe: 0, nube: 0 };
    if (fam === 'FE') cur.fe += Math.round(Number(row.unidades) || 0);
    if (fam === 'NUBE') cur.nube += Math.round(Number(row.unidades) || 0);
    ventasDiariasPorPeriodo.set(p, cur);
  });

  const periodos = new Set<string>([
    ...metasPorPeriodo.keys(),
    ...metricasPorPeriodo.keys(),
    ...ventasDiariasPorPeriodo.keys(),
  ]);

  // FÓRMULA SP CONVENCIÓN — ASESORES VN (todos los países)
  // Los asesores NO tienen meta ACV: SP_mes = cap(%FE) + cap(%NUBE) * 2.
  // Los gerentes VN siguen usando la fórmula completa (FE + NUBE*2 + ACV) en
  // computeSpConvencionAnualForCelula — esto NO los afecta.
  let totalSp = 0;
  periodos.forEach((periodo) => {
    if (!periodo.startsWith(year)) return;
    const metas = metasPorPeriodo.get(periodo) ?? { fe: 0, nube: 0 };
    const ejec = metricasPorPeriodo.get(periodo) ?? ventasDiariasPorPeriodo.get(periodo) ?? { fe: 0, nube: 0 };

    const pct_fe = metas.fe > 0 ? cap((ejec.fe / metas.fe) * 100) : 0;
    const pct_nube = metas.nube > 0 ? cap((ejec.nube / metas.nube) * 100) : 0;
    totalSp += pct_fe + pct_nube * 2;
  });

  return totalSp;
}
