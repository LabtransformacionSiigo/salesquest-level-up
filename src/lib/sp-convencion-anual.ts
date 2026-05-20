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
    mes_nro?: number | null;
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

  // PRIMARY source: vn_metricas_optimizadas (scope='gerente') — same as useGamificationMetrics.
  // Takes precedence over ventas_gerente_mensual for any period it covers.
  const yearNum = Number(year);
  const vmgPrimary = new Map<string, { fe: number; nube: number; acv: number }>();
  if (inputs.vnMetricasGerenteRows && inputs.vnMetricasGerenteRows.length > 0) {
    const vmgFamMax = new Map<string, { uds: number; acv: number }>();
    inputs.vnMetricasGerenteRows.forEach((r) => {
      const rowCelula = normalizeSpText(r.celula);
      const rowGerente = normalizeSpText(r.gerente_normalizado || r.gerente);
      // Si tenemos celula, EXIGIR match exacto por celula (evita que un gerente
      // que lidera más de una celula sume ventas de células ajenas).
      // Solo cuando NO hay celula se permite match por gerente.
      const include = celulaNorm
        ? rowCelula === celulaNorm
        : !!(gerenteNorm && rowGerente === gerenteNorm);
      if (!include) return;
      const mesNro = Number(r.mes_nro);
      if (!mesNro || mesNro < 1 || mesNro > 12) return;
      const period = `${yearNum}${String(mesNro).padStart(2, '0')}`;
      const rawFam = String(r.familia || r.tipo_producto1 || '').toUpperCase().trim();
      const fam = rawFam === 'CAMPANA' || rawFam === 'CAMPAÑA' ? 'NUBE'
                : (rawFam === 'FE' || rawFam === 'NUBE' || rawFam === 'CONTADOR') ? rawFam
                : 'OTRO';
      const k = `${period}::${fam}`;
      const uds = Math.round(Number(r.ventas) || 0);
      const acvV = Math.round(Number(r.acv_total) || 0);
      const prev = vmgFamMax.get(k);
      if (!prev || uds > prev.uds) vmgFamMax.set(k, { uds, acv: acvV });
    });
    vmgFamMax.forEach((val, k) => {
      const [period, fam] = k.split('::');
      const cur = vmgPrimary.get(period) || { fe: 0, nube: 0, acv: 0 };
      if (fam === 'FE') cur.fe += val.uds;
      else if (fam === 'NUBE') cur.nube += val.uds;
      cur.acv += val.acv;
      vmgPrimary.set(period, cur);
    });
  }

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

  // Ventas reales desde ventas_gerente_mensual.
  // Si tenemos gerente, esa es la fuente precisa (MiPerformance usa este mismo criterio).
  // El match por célula queda solo como fallback porque Databricks puede traer aliases
  // duplicados para la misma célula (ej. nombre corto + nombre completo), lo que inflaba
  // Ranking/Header al sumar la misma ejecución dos veces.
  // Si tenemos celula, EXIGIR filtro por celula. Solo si no hay celula se permite
  // filtrar por gerente (caso de configuración sin celula asignada). Esto evita
  // que un gerente que lidera más de una celula sume ventas de células ajenas.
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

  // Períodos a calcular: ventas reales + períodos con meta.
  const ventasDiariasByPeriod = new Map<string, { fe: number; nube: number; acv: number }>();
  (inputs.ventasDiariasRows || []).forEach((row) => {
    const rowCelula = normalizeSpText(row.celula || row.equipo);
    const rowDirector = normalizeSpText(row.director);
    if (!(celulaNorm && rowCelula === celulaNorm) && !(gerenteNorm && rowDirector === gerenteNorm)) return;
    const fecha = String(row.fecha || '');
    const periodo = fecha.length >= 7 ? fecha.slice(0, 7).replace('-', '') : '';
    if (!/^\d{6}$/.test(periodo)) return;
    const rawFam = String(row.tipo_producto || row.producto || '').toUpperCase().trim();
    const fam = rawFam === 'CAMPANA' || rawFam === 'CAMPAÑA' ? 'NUBE'
              : rawFam === 'FE' || rawFam === 'NUBE' ? rawFam
              : 'OTRO';
    const cur = ventasDiariasByPeriod.get(periodo) || { fe: 0, nube: 0, acv: 0 };
    if (fam === 'FE') cur.fe += Math.round(Number(row.unidades) || 0);
    if (fam === 'NUBE') cur.nube += Math.round(Number(row.unidades) || 0);
    cur.acv += Math.round(Number(row.acv) || 0);
    ventasDiariasByPeriod.set(periodo, cur);
  });

  const periodSet = new Set<string>();
  vmgPrimary.forEach((_, p) => periodSet.add(p));
  vgmFiltrados.forEach((r) => { if (/^\d{6}$/.test(String(r.periodo))) periodSet.add(String(r.periodo)); });
  ventasDiariasByPeriod.forEach((_, p) => periodSet.add(p));
  metasPorPeriodo.forEach((_, p) => periodSet.add(p));

  let totalSp = 0;
  periodSet.forEach((periodo) => {
    if (!periodo.startsWith(String(year))) return;
    const metas = metasPorPeriodo.get(periodo) ?? { meta_fe: 0, meta_nube: 0, meta_acv: 0 };

    let ventas_fe = 0, ventas_nube = 0, acv_total = 0;
    const primaryData = vmgPrimary.get(periodo);
    if (primaryData) {
      ventas_fe = primaryData.fe;
      ventas_nube = primaryData.nube;
      acv_total = primaryData.acv;
    } else if (ventasDiariasByPeriod.has(periodo)) {
      const vd = ventasDiariasByPeriod.get(periodo)!;
      ventas_fe = vd.fe;
      ventas_nube = vd.nube;
      acv_total = vd.acv;
    } else {
      vgmFiltrados.filter((r) => String(r.periodo) === periodo).forEach((r) => {
        const u = Math.round(Number(r.unidades) || 0);
        const acv = Number(r.acv) || 0;
        const fam = String(r.familia || '').toUpperCase();
        if (fam === 'FE') ventas_fe += u;
        else if (fam === 'NUBE') ventas_nube += u;
        acv_total += acv;
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

export interface VnMetricaRow {
  pais?:           string | null;
  mes_nro?:        number | null;
  asesor?:         string | null;
  tipo_producto1?: string | null;
  ventas?:         number | null;
  total_productos?: number | null;
  acv_total?:      number | null;
}

export interface SpAnualAsesorInputs {
  metaAsesorRows: MetaAsesorFullRow[];
  ejecAsesorRows: EjecAsesorRow[];
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

  // Fallback México: ventas desde vn_metricas_optimizadas (CAMPANA = NUBE)
  const YEAR_NUM = Number(year);
  (inputs.vnMetricasRows || [])
    .filter((r) => normalizeSpText(r.asesor) === asesorNorm && resolveCountryCode(r.pais) === 'MEX')
    .forEach((r) => {
      const mm = String(r.mes_nro ?? '').padStart(2, '0');
      const p = `${YEAR_NUM}${mm}`;
      if (!/^\d{6}$/.test(p)) return;
      const tipo = String(r.tipo_producto1 ?? '').toUpperCase().trim();
      const v = Math.round(Number(r.ventas ?? r.total_productos) || 0);
      const acv = Math.round(Number(r.acv_total) || 0);
      const cur = ejecPorPeriodo.get(p) ?? { fe: 0, nube: 0, acv: 0 };
      if (tipo === 'FE') cur.fe += v;
      if (tipo === 'CAMPANA' || tipo === 'CAMPAÑA' || tipo === 'NUBE') cur.nube += v;
      cur.acv += acv;
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
