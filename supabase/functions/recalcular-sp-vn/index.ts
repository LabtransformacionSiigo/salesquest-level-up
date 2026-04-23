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
    try {
      const body = await req.json().catch(() => ({}));
      if (body && Array.isArray(body.paises) && body.paises.length > 0) paisFilter = body.paises;
      else if (body && typeof body.pais === 'string') paisFilter = [body.pais];
    } catch (_) {}

    // 1. Cargar todo lo necesario (paginado), filtrado por país si aplica
    const [gerentes, asesores, productividad, metas, vgm, ejec] = await Promise.all([
      fetchAll(supabase, 'gerentes', 'id, nombre, canal, pais, celula',
        (q) => { let x = q.in('canal', ['VN_ALIADOS', 'VN_EMPRESARIOS']); if (paisFilter) x = x.in('pais', paisFilter); return x; }),
      fetchAll(supabase, 'asesores', 'id, nombre, documento, canal, pais, gerente_id, canal_direccion',
        (q) => { let x = q.in('canal', ['VN_ALIADOS', 'VN_EMPRESARIOS']); if (paisFilter) x = x.in('pais', paisFilter); return x; }),
      fetchAll(supabase, 'productividad_asesores', 'anio_mes, asesor, celula, pais, acv_f, meta',
        (q) => { let x = q.gte('anio_mes', yStart).lte('anio_mes', yEnd); if (paisFilter) x = x.in('pais', paisFilter); return x; }),
      fetchAll(supabase, 'metas_asesores', 'anio_mes, nombre_asesor, documento_asesor, gerente, celula, canal_direccion, pais, meta_fe, meta_nube, meta_total, novedad',
        (q) => { let x = q.gte('anio_mes', yStart).lte('anio_mes', yEnd); if (paisFilter) x = x.in('pais', paisFilter); return x; }),
      fetchAll(supabase, 'ventas_gerente_mensual', 'periodo, gerente, gerente_normalizado, celula, familia, unidades, acv',
        (q) => { let x = q.gte('periodo', yStart).lte('periodo', yEnd); if (paisFilter) x = x.in('pais', paisFilter); return x; }),
      fetchAll(supabase, 'ejecucion_asesores', 'periodo, documento_asesor, canal_direccion, ventas_fe, ventas_nube, ventas_total, acv_total, pais',
        (q) => { let x = q.gte('periodo', yStart).lte('periodo', yEnd); if (paisFilter) x = x.in('pais', paisFilter); return x; }),
    ]);

    const isActiveMeta = (m: any) => {
      const n = norm(m.novedad);
      return !n || n === 'sin novedad';
    };

    // ===== GERENTES =====
    const gerenteResults: any[] = [];
    for (const g of gerentes) {
      const gNombreNorm = norm(g.nombre);
      const gCelulaNorm = norm(g.celula);
      const periods = new Set<string>();

      const gMetas = metas.filter((m: any) => norm(m.celula) === gCelulaNorm);
      const gProd = productividad.filter((p: any) => norm(p.celula) === gCelulaNorm);
      const gVgm = vgm.filter((v: any) => v.gerente_normalizado === gNombreNorm);

      gMetas.forEach((m: any) => periods.add(String(m.anio_mes)));
      gProd.forEach((p: any) => periods.add(String(p.anio_mes)));
      gVgm.forEach((v: any) => periods.add(String(v.periodo)));

      let total = 0;
      const monthly: any[] = [];

      for (const period of [...periods].sort()) {
        const pMetas = gMetas.filter((m: any) => String(m.anio_mes) === period);
        const activeMetas = pMetas.filter(isActiveMeta);
        const novedadNames = new Set(pMetas.filter((m: any) => !isActiveMeta(m)).map((m: any) => norm(m.nombre_asesor)));
        const pProd = gProd.filter((p: any) => String(p.anio_mes) === period);
        const pVgm = gVgm.filter((v: any) => String(v.periodo) === period);

        const metaFe = activeMetas.reduce((s: number, r: any) => s + (Number(r.meta_fe) || 0), 0);
        const metaNube = activeMetas.reduce((s: number, r: any) => s + (Number(r.meta_nube) || 0), 0);
        const metaTotal = activeMetas.reduce((s: number, r: any) => s + (Number(r.meta_total) || 0), 0);
        const metaAcv = pProd.reduce((s: number, r: any) => {
          if (novedadNames.has(norm(r.asesor))) return s;
          return s + normMetaAcv(r.meta, r.pais);
        }, 0);

        // Ejecución: priorizar vgm, luego ejecucion_asesores cruzada por nombres del equipo
        let vFe = 0, vNube = 0, vTotal = 0, acv = 0;
        if (pVgm.length > 0) {
          pVgm.forEach((v: any) => {
            const fam = String(v.familia || '').toUpperCase();
            const uds = Number(v.unidades) || 0;
            if (fam === 'FE') vFe += uds;
            else if (fam === 'NUBE') vNube += uds;
            vTotal += uds;
            acv += Number(v.acv) || 0;
          });
          acv = Math.round(acv);
        } else {
          // fallback: cruzar ejecucion por nombres del equipo en metas/productividad
          const teamKeys = new Set<string>();
          activeMetas.forEach((m: any) => { if (m.nombre_asesor) teamKeys.add(norm(m.nombre_asesor)); });
          pProd.forEach((p: any) => { if (p.asesor) teamKeys.add(norm(p.asesor)); });
          ejec.filter((e: any) => String(e.periodo) === period && teamKeys.has(norm(e.documento_asesor)))
            .forEach((e: any) => {
              vFe += Number(e.ventas_fe) || 0;
              vNube += Number(e.ventas_nube) || 0;
              vTotal += Number(e.ventas_total) || 0;
            });
          acv = pProd.reduce((s: number, r: any) => {
            if (novedadNames.has(norm(r.asesor))) return s;
            return s + normAcv(r.acv_f);
          }, 0);
        }

        const pctUds = metaTotal > 0 && vTotal > 0 ? (vTotal / metaTotal) * 100 : 0;
        const pctFe = metaFe > 0 && vFe > 0 ? (vFe / metaFe) * 100 : 0;
        const pctNube = metaNube > 0 && vNube > 0 ? (vNube / metaNube) * 100 : 0;
        const pctAcv = metaAcv > 0 && acv > 0 ? (acv / metaAcv) * 100 : 0;
        const sp = computeSp(pctUds, pctFe, pctNube, pctAcv);
        if (sp > 0 || vTotal > 0 || acv > 0) {
          monthly.push({ period, pctUds: cap(pctUds), pctFe: cap(pctFe), pctNube: cap(pctNube), pctAcv: cap(pctAcv), sp });
        }
        total += sp;
      }

      gerenteResults.push({ id: g.id, nombre: g.nombre, pais: g.pais, canal: g.canal, celula: g.celula, sp_total: total, monthly });
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

    // Sample para validación
    const diana = gerenteResults.find((g: any) => norm(g.nombre).includes('diana maria naranjo'));
    const grace = gerenteResults.find((g: any) => norm(g.nombre).includes('grace alejandra serje'));

    return new Response(JSON.stringify({
      ok: true,
      gerentes_total: gerentes.length,
      gerentes_actualizados: updatedG,
      asesores_total: asesores.length,
      asesores_actualizados: updatedA,
      sample: { diana, grace },
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
