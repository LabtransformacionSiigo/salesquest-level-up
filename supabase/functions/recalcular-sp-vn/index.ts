// Recalcula SP Convención VN (Aliados/Empresarios) para COL/MEX/ECU/URU
// y persiste el total anual 2026 en gerentes.sp_convencion y asesores.sp_convencion.
// Fórmula mensual: SP = %Uds + %FE + (%Nube × 2) + %ACV. Cada componente cap 300%.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCALE: Record<string, number> = { COL: 1_000_000, MEX: 1_000, ECU: 100, URU: 100 };
const CAP = 300;

const norm = (v: unknown) => String(v ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();

const resolveCountry = (p?: string | null) => {
  const n = String(p || '').trim().toUpperCase();
  if (!n) return null;
  if (n === 'MX' || n.startsWith('MEX')) return 'MEX';
  if (n === 'CO' || n.startsWith('COL')) return 'COL';
  if (n === 'EC' || n.startsWith('ECU')) return 'ECU';
  if (n === 'UY' || n.startsWith('URU')) return 'URU';
  return n;
};

const normMetaAcv = (v: any, pais?: string | null) => {
  const n = Number(v) || 0;
  if (n <= 0) return 0;
  if (Math.abs(n) >= 100_000) return Math.round(n);
  const c = resolveCountry(pais);
  return Math.round(n * ((c && SCALE[c]) || 1_000_000));
};

const normAcv = (v: any) => {
  const n = Number(v) || 0;
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) >= 1_000_000_000_000) return Math.round(n / 1_000_000_000);
  return Math.round(n);
};

const cap = (v: number) => Math.min(CAP, Math.max(0, Math.round(v || 0)));

const computeSp = (pctUds: number, pctFe: number, pctNube: number, pctAcv: number) =>
  cap(pctUds) + cap(pctFe) + cap(pctNube) * 2 + cap(pctAcv);

async function fetchAll(supabase: any, table: string, select: string, build?: (q: any) => any) {
  const all: any[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 200_000; from += pageSize) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (build) q = build(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const year = 2026;
    const yStart = `${year}01`;
    const yEnd = `${year}12`;

    let paisFilter: string[] | null = null;
    let canalFilter: string[] = ['VN_ALIADOS', 'VN_EMPRESARIOS'];
    try {
      const body = await req.json().catch(() => ({}));
      if (body && Array.isArray(body.paises) && body.paises.length > 0) paisFilter = body.paises;
      else if (body && typeof body.pais === 'string') paisFilter = [body.pais];
      if (body && Array.isArray(body.canales) && body.canales.length > 0) canalFilter = body.canales;
      else if (body && typeof body.canal === 'string') canalFilter = [body.canal];
    } catch (_) {}

    // 1. Cargar todo lo necesario (paginado), filtrado por país si aplica
    const [gerentes, asesores, productividad, metas, vgm, ejec] = await Promise.all([
      fetchAll(supabase, 'gerentes', 'id, nombre, canal, pais, celula',
        (q) => { let x = q.in('canal', canalFilter); if (paisFilter) x = x.in('pais', paisFilter); return x; }),
      fetchAll(supabase, 'asesores', 'id, nombre, documento, canal, pais, gerente_id, canal_direccion',
        (q) => { let x = q.in('canal', canalFilter); if (paisFilter) x = x.in('pais', paisFilter); return x; }),
      fetchAll(supabase, 'productividad_asesores', 'anio_mes, asesor, celula, pais, acv_f, meta',
        (q) => { let x = q.gte('anio_mes', yStart).lte('anio_mes', yEnd); if (paisFilter) x = x.in('pais', paisFilter); return x; }),
      fetchAll(supabase, 'metas_asesores', 'anio_mes, nombre_asesor, documento_asesor, gerente, celula, canal_direccion, pais, meta_fe, meta_nube, meta_total, novedad',
        (q) => {
          let x = q.gte('anio_mes', yStart).lte('anio_mes', yEnd);
          if (paisFilter) x = x.in('pais', paisFilter);
          const canalDireccionFilter = canalFilter.map((c) => c === 'VN_ALIADOS' ? 'Aliados' : c === 'VN_EMPRESARIOS' ? 'Empresarios' : c);
          if (canalDireccionFilter.length > 0) x = x.in('canal_direccion', canalDireccionFilter);
          return x;
        }),
      fetchAll(supabase, 'ventas_gerente_mensual', 'periodo, gerente, gerente_normalizado, celula, familia, unidades, acv, pais, canal_direccion',
        (q) => {
          let x = q.gte('periodo', yStart).lte('periodo', yEnd);
          if (paisFilter) x = x.in('pais', paisFilter);
          const canalDireccionFilter = canalFilter.map((c) => c === 'VN_ALIADOS' ? 'Aliados' : c === 'VN_EMPRESARIOS' ? 'Empresarios' : c);
          if (canalDireccionFilter.length > 0) x = x.in('canal_direccion', canalDireccionFilter);
          return x;
        }),
      fetchAll(supabase, 'ejecucion_asesores', 'periodo, documento_asesor, canal_direccion, ventas_fe, ventas_nube, ventas_total, acv_total, pais',
        (q) => {
          let x = q.gte('periodo', yStart).lte('periodo', yEnd);
          if (paisFilter) x = x.in('pais', paisFilter);
          const canalDireccionFilter = canalFilter.map((c) => c === 'VN_ALIADOS' ? 'Aliados' : c === 'VN_EMPRESARIOS' ? 'Empresarios' : c);
          if (canalDireccionFilter.length > 0) x = x.in('canal_direccion', canalDireccionFilter);
          return x;
        }),
    ]);

    const isActiveMeta = (m: any) => {
      const n = norm(m.novedad);
      return !n || n === 'sin novedad';
    };

    // Pre-indexar para evitar O(N×M)
    const metasByCelula = new Map<string, any[]>();
    for (const m of metas) {
      const k = norm(m.celula);
      if (!metasByCelula.has(k)) metasByCelula.set(k, []);
      metasByCelula.get(k)!.push(m);
    }
    const prodByCelula = new Map<string, any[]>();
    for (const p of productividad) {
      const k = norm(p.celula);
      if (!prodByCelula.has(k)) prodByCelula.set(k, []);
      prodByCelula.get(k)!.push(p);
    }
    const vgmByGerente = new Map<string, any[]>();
    for (const v of vgm) {
      const k = String(v.gerente_normalizado || '');
      if (!vgmByGerente.has(k)) vgmByGerente.set(k, []);
      vgmByGerente.get(k)!.push(v);
    }
    const ejecByPeriod = new Map<string, any[]>();
    for (const e of ejec) {
      const k = String(e.periodo);
      if (!ejecByPeriod.has(k)) ejecByPeriod.set(k, []);
      ejecByPeriod.get(k)!.push(e);
    }

    // ===== GERENTES =====
    const gerenteResults: { id: string; sp_total: number }[] = [];
    let sampleDiana: any = null, sampleGrace: any = null;
    for (const g of gerentes) {
      const gNombreNorm = norm(g.nombre);
      const gCelulaNorm = norm(g.celula);
      const gMetas = metasByCelula.get(gCelulaNorm) || [];
      const gProd = prodByCelula.get(gCelulaNorm) || [];
      const gVgm = vgmByGerente.get(gNombreNorm) || [];

      const periods = new Set<string>();
      gMetas.forEach((m: any) => periods.add(String(m.anio_mes)));
      gProd.forEach((p: any) => periods.add(String(p.anio_mes)));
      gVgm.forEach((v: any) => periods.add(String(v.periodo)));

      let total = 0;
      const monthlyDbg: any[] = [];
      const isDiana = gNombreNorm.includes('diana maria naranjo');
      const isGrace = gNombreNorm.includes('grace alejandra serje');

      for (const period of periods) {
        const pMetas = gMetas.filter((m: any) => String(m.anio_mes) === period);
        const activeMetas = pMetas.filter(isActiveMeta);
        const novedadNames = new Set(pMetas.filter((m: any) => !isActiveMeta(m)).map((m: any) => norm(m.nombre_asesor)));
        const pProd = gProd.filter((p: any) => String(p.anio_mes) === period);
        const pVgm = gVgm.filter((v: any) => String(v.periodo) === period);

        let metaFe = 0, metaNube = 0, metaTotal = 0;
        for (const r of activeMetas) {
          metaFe += Number(r.meta_fe) || 0;
          metaNube += Number(r.meta_nube) || 0;
          metaTotal += Number(r.meta_total) || 0;
        }
        let metaAcv = 0;
        for (const r of pProd) {
          if (novedadNames.has(norm(r.asesor))) continue;
          metaAcv += normMetaAcv(r.meta, r.pais);
        }

        let vFe = 0, vNube = 0, vTotal = 0, acv = 0;
        if (pVgm.length > 0) {
          for (const v of pVgm) {
            const fam = String(v.familia || '').toUpperCase();
            const uds = Number(v.unidades) || 0;
            if (fam === 'FE') vFe += uds;
            else if (fam === 'NUBE') vNube += uds;
            vTotal += uds;
            acv += Number(v.acv) || 0;
          }
          acv = Math.round(acv);
        } else {
          const teamKeys = new Set<string>();
          for (const m of activeMetas) if (m.nombre_asesor) teamKeys.add(norm(m.nombre_asesor));
          for (const p of pProd) if (p.asesor) teamKeys.add(norm(p.asesor));
          const periodEjec = ejecByPeriod.get(period) || [];
          for (const e of periodEjec) {
            if (!teamKeys.has(norm(e.documento_asesor))) continue;
            vFe += Number(e.ventas_fe) || 0;
            vNube += Number(e.ventas_nube) || 0;
            vTotal += Number(e.ventas_total) || 0;
          }
          for (const r of pProd) {
            if (novedadNames.has(norm(r.asesor))) continue;
            acv += normAcv(r.acv_f);
          }
        }

        const pctUds = metaTotal > 0 && vTotal > 0 ? (vTotal / metaTotal) * 100 : 0;
        const pctFe = metaFe > 0 && vFe > 0 ? (vFe / metaFe) * 100 : 0;
        const pctNube = metaNube > 0 && vNube > 0 ? (vNube / metaNube) * 100 : 0;
        const pctAcv = metaAcv > 0 && acv > 0 ? (acv / metaAcv) * 100 : 0;
        const sp = computeSp(pctUds, pctFe, pctNube, pctAcv);
        total += sp;
        if (isDiana || isGrace) {
          monthlyDbg.push({ period, pctUds: cap(pctUds), pctFe: cap(pctFe), pctNube: cap(pctNube), pctAcv: cap(pctAcv), sp });
        }
      }

      gerenteResults.push({ id: g.id, sp_total: total });
      if (isDiana) sampleDiana = { nombre: g.nombre, sp_total: total, monthly: monthlyDbg };
      if (isGrace) sampleGrace = { nombre: g.nombre, sp_total: total, monthly: monthlyDbg };
    }

    // ===== ASESORES =====
    const asesorResults: any[] = [];
    for (const a of asesores) {
      const aNombreNorm = norm(a.nombre);
      const aDoc = String(a.documento || '').trim().toLowerCase();
      const aCanalDir = a.canal_direccion;

      const aProd = productividad.filter((p: any) => norm(p.asesor) === aNombreNorm);
      const aMetas = metas.filter((m: any) => {
        if (aDoc && String(m.documento_asesor || '').trim().toLowerCase() === aDoc) return true;
        return norm(m.nombre_asesor) === aNombreNorm;
      });
      const aEjec = ejec.filter((e: any) => {
        if (aCanalDir && e.canal_direccion !== aCanalDir) return false;
        if (aDoc && String(e.documento_asesor || '').trim().toLowerCase() === aDoc) return true;
        return norm(e.documento_asesor) === aNombreNorm;
      });

      const periods = new Set<string>();
      aProd.forEach((p: any) => periods.add(String(p.anio_mes)));
      aMetas.forEach((m: any) => periods.add(String(m.anio_mes)));
      aEjec.forEach((e: any) => periods.add(String(e.periodo)));

      let total = 0;
      for (const period of periods) {
        const pProd = aProd.filter((p: any) => String(p.anio_mes) === period);
        const pMetas = aMetas.filter((m: any) => String(m.anio_mes) === period && isActiveMeta(m));
        const pEjec = aEjec.filter((e: any) => String(e.periodo) === period);
        if (pMetas.length === 0 && pProd.length === 0) continue;

        const metaFe = pMetas.reduce((s: number, r: any) => s + (Number(r.meta_fe) || 0), 0);
        const metaNube = pMetas.reduce((s: number, r: any) => s + (Number(r.meta_nube) || 0), 0);
        const metaTotal = pMetas.reduce((s: number, r: any) => s + (Number(r.meta_total) || 0), 0);
        const metaAcv = pProd.reduce((s: number, r: any) => s + normMetaAcv(r.meta, r.pais), 0);
        const acv = pProd.reduce((s: number, r: any) => s + normAcv(r.acv_f), 0);
        const vFe = pEjec.reduce((s: number, r: any) => s + (Number(r.ventas_fe) || 0), 0);
        const vNube = pEjec.reduce((s: number, r: any) => s + (Number(r.ventas_nube) || 0), 0);
        const vTotal = pEjec.reduce((s: number, r: any) => s + (Number(r.ventas_total) || 0), 0);

        const pctUds = metaTotal > 0 && vTotal > 0 ? (vTotal / metaTotal) * 100 : 0;
        const pctFe = metaFe > 0 && vFe > 0 ? (vFe / metaFe) * 100 : 0;
        const pctNube = metaNube > 0 && vNube > 0 ? (vNube / metaNube) * 100 : 0;
        const pctAcv = metaAcv > 0 && acv > 0 ? (acv / metaAcv) * 100 : 0;
        total += computeSp(pctUds, pctFe, pctNube, pctAcv);
      }

      asesorResults.push({ id: a.id, nombre: a.nombre, sp_total: total });
    }

    // ===== PERSISTIR =====
    let updatedG = 0;
    for (const r of gerenteResults) {
      const { error } = await supabase.from('gerentes').update({ sp_convencion: r.sp_total }).eq('id', r.id);
      if (!error) updatedG++;
    }
    let updatedA = 0;
    for (const r of asesorResults) {
      const { error } = await supabase.from('asesores').update({ sp_convencion: r.sp_total }).eq('id', r.id);
      if (!error) updatedA++;
    }

    return new Response(JSON.stringify({
      ok: true,
      pais: paisFilter,
      gerentes_total: gerentes.length,
      gerentes_actualizados: updatedG,
      asesores_total: asesores.length,
      asesores_actualizados: updatedA,
      sample: { diana: sampleDiana, grace: sampleGrace },
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e: any) {
    console.error('recalcular-sp-vn error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
