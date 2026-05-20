// Evalúa medallas VC (`catalogo_medallas`) y VN (`medallas_vn_config`),
// otorga SP Canje y registra:
// - VC: medallas + sp_acumulados (MEDALLA / canje) + gerentes.sp_canje (RPC otorgar_medalla_si_aplica)
// - VN: medallas_vn_ganadas + sp_acumulados + gerentes.sp_canje
// Idempotente: si la medalla ya fue otorgada, no la duplica.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const toMonthKey = (d: Date) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

const monthRange = (d: Date) => {
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10),
  };
};

const norm = (s: any) =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const dryRun = body.dry_run === true;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const periodo = toMonthKey(now);
    const { start: monthStart, end: monthEnd } = monthRange(now);

    const isVigente = (it: { fecha_inicio?: string | null; fecha_fin?: string | null }) =>
      (!it.fecha_inicio || today >= it.fecha_inicio) &&
      (!it.fecha_fin || today <= it.fecha_fin);

    // ──────────────── VC ────────────────
    const [catVcRes, gerentesVcRes] = await Promise.all([
      supabase.from("catalogo_medallas").select("*").eq("activo", true),
      supabase.from("gerentes").select("id, nombre, canal, pais").eq("activo", true),
    ]);
    const catVc = (catVcRes.data || []).filter(isVigente);
    const gerentes = gerentesVcRes.data || [];

    // Cargar ventas del mes (cubre todas las condiciones)
    const gerenteIds = gerentes.map((g) => g.id);
    let ventasMes: any[] = [];
    if (gerenteIds.length > 0) {
      const { data: vMes } = await supabase
        .from("ventas")
        .select("gerente_id, fecha_facturacion, acv_plus, valor_producto, producto, meta, documento_factura, canal")
        .in("gerente_id", gerenteIds)
        .gte("fecha_facturacion", monthStart)
        .lt("fecha_facturacion", monthEnd);
      ventasMes = vMes || [];
    }

    // Medallas ya otorgadas (idempotencia VC)
    const { data: medallasYa } = await supabase
      .from("medallas")
      .select("gerente_id, medalla");
    const medallasSet = new Set((medallasYa || []).map((m) => `${m.gerente_id}::${m.medalla}`));

    const ventasByGer = new Map<string, any[]>();
    ventasMes.forEach((v) => {
      if (!v.gerente_id) return;
      const arr = ventasByGer.get(v.gerente_id) || [];
      arr.push(v);
      ventasByGer.set(v.gerente_id, arr);
    });

    const detalle: any[] = [];
    let otorgadasVc = 0;
    let spVc = 0;

    for (const med of catVc) {
      const cond = String(med.condicion_tipo || "").toLowerCase();
      const cantidadReq = Number(med.cantidad_requerida) || 1;
      const sp = Number(med.sp) || 0;
      const productoFiltro = norm(med.producto);
      const paisFiltro = med.pais ? String(med.pais).toUpperCase() : null;
      const canalFiltro = med.canal ? String(med.canal).toUpperCase() : null;
      const gerenteEspecifico = med.gerente_id || null;

      const gerentesElegibles = gerentes.filter((g) => {
        if (gerenteEspecifico && g.id !== gerenteEspecifico) return false;
        if (canalFiltro && String(g.canal || "").toUpperCase() !== canalFiltro) return false;
        if (paisFiltro && String(g.pais || "").toUpperCase() !== paisFiltro) return false;
        return true;
      });

      for (const g of gerentesElegibles) {
        const key = `${g.id}::${med.nombre}`;
        if (medallasSet.has(key)) continue;

        const ventas = ventasByGer.get(g.id) || [];
        const ventasProducto = productoFiltro
          ? ventas.filter((v) => norm(v.producto).includes(productoFiltro))
          : ventas;

        // SUM- = consolidados mensuales; PROD- = transacciones reales
        const sumRows = ventasProducto.filter((v) =>
          typeof v.documento_factura === "string" && v.documento_factura.startsWith("SUM-")
        );
        const prodRows = ventasProducto.filter((v) =>
          typeof v.documento_factura === "string" && v.documento_factura.startsWith("PROD-")
        );

        let valor = 0;
        let cumple = false;

        if (cond === "primera_venta") {
          valor = prodRows.length;
          cumple = valor >= 1;
        } else if (cond === "cantidad") {
          valor = prodRows.length;
          cumple = valor >= cantidadReq;
        } else if (cond === "monto") {
          valor = sumRows.reduce((s, v) => s + (Number(v.acv_plus) || Number(v.valor_producto) || 0), 0);
          cumple = valor >= cantidadReq;
        } else if (cond === "cumplimiento") {
          const acv = sumRows.reduce((s, v) => s + (Number(v.acv_plus) || 0), 0);
          const meta = sumRows.reduce((s, v) => s + (Number(v.meta) || 0), 0);
          valor = meta > 0 ? (acv / meta) * 100 : 0;
          cumple = valor >= cantidadReq;
        }

        detalle.push({
          medalla: med.nombre,
          gerente: g.nombre,
          canal_gerente: g.canal,
          condicion: cond,
          umbral: cantidadReq,
          valor: Math.round(valor * 100) / 100,
          cumple,
          ya_otorgada: false,
        });

        if (!cumple || dryRun) continue;

        const { data: otorgada, error: rpcErr } = await supabase.rpc("otorgar_medalla_si_aplica", {
          p_gerente_id: g.id,
          p_medalla: med.nombre,
          p_sp: sp,
        });
        if (rpcErr) {
          console.error("[medalla VC] RPC error", med.nombre, g.id, rpcErr.message);
          continue;
        }
        if (otorgada === true) {
          otorgadasVc++;
          spVc += sp;
          medallasSet.add(key);
        }
      }
    }

    // ──────────────── VN ────────────────
    const { data: catVnAll } = await supabase
      .from("medallas_vn_config")
      .select("*")
      .eq("activo", true);
    const catVn = (catVnAll || []).filter(isVigente);

    const { data: medVnYa } = await supabase
      .from("medallas_vn_ganadas")
      .select("gerente_id, medalla_id");
    const medVnSet = new Set((medVnYa || []).map((m) => `${m.gerente_id}::${m.medalla_id}`));

    let otorgadasVn = 0;
    let spVn = 0;

    for (const med of catVn) {
      const cond = String(med.condicion_tipo || "").toLowerCase();
      const reqVal = Number(med.condicion_valor) || 1;
      const sp = Number(med.sp_reward) || 0;
      const paises = (med.paises || []).map((p: string) => String(p).toUpperCase());
      const canales = (med.canal || []).map((c: string) => String(c).toUpperCase());

      const elegibles = gerentes.filter((g) => {
        const canalG = String(g.canal || "").toUpperCase();
        if (canales.length > 0 && !canales.includes(canalG)) return false;
        if (paises.length > 0 && !paises.includes(String(g.pais || "").toUpperCase())) return false;
        // Solo VN
        return canalG === "VN_ALIADOS" || canalG === "VN_EMPRESARIOS";
      });

      for (const g of elegibles) {
        const key = `${g.id}::${med.id}`;
        if (medVnSet.has(key)) continue;

        const ventas = ventasByGer.get(g.id) || [];
        // VN trabaja con filas VN- (consolidadas mensuales por asesor en `ventas`).
        const vnRows = ventas.filter((v) =>
          typeof v.documento_factura === "string" && v.documento_factura.startsWith("VN-")
        );

        let valor = 0;
        let cumple = false;

        if (cond === "primera_venta" || cond === "cantidad") {
          valor = vnRows.length;
          cumple = valor >= reqVal;
        } else if (cond === "monto") {
          valor = vnRows.reduce((s, v) => s + (Number(v.acv_plus) || Number(v.valor_producto) || 0), 0);
          cumple = valor >= reqVal;
        } else if (cond === "cumplimiento") {
          const acv = vnRows.reduce((s, v) => s + (Number(v.acv_plus) || 0), 0);
          const meta = vnRows.reduce((s, v) => s + (Number(v.meta) || 0), 0);
          valor = meta > 0 ? (acv / meta) * 100 : 0;
          cumple = valor >= reqVal;
        }

        detalle.push({
          medalla: med.nombre,
          gerente: g.nombre,
          canal_gerente: g.canal,
          condicion: cond,
          umbral: reqVal,
          valor: Math.round(valor * 100) / 100,
          cumple,
          ya_otorgada: false,
          tipo: "VN",
        });

        if (!cumple || dryRun) continue;

        // Insertar medalla ganada
        const { error: insErr } = await supabase.from("medallas_vn_ganadas").insert({
          medalla_id: med.id,
          gerente_id: g.id,
          sp_otorgados: sp,
        });
        if (insErr) {
          console.error("[medalla VN] insert error", med.nombre, g.id, insErr.message);
          continue;
        }

        // sp_acumulados (canje)
        await supabase.from("sp_acumulados").upsert({
          gerente_id: g.id,
          fuente: "MEDALLA",
          sp,
          periodo,
          detalle: med.nombre,
          tipo_sp: "canje",
        }, { onConflict: "gerente_id,fuente,periodo" });

        // incrementar sp_canje
        await supabase.rpc("increment_sp_canje", { p_gerente_id: g.id, p_amount: sp });

        otorgadasVn++;
        spVn += sp;
        medVnSet.add(key);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: dryRun,
        vc: { medallas_catalog: catVc.length, otorgadas: otorgadasVc, sp_total: spVc },
        vn: { medallas_catalog: catVn.length, otorgadas: otorgadasVn, sp_total: spVn },
        detalle: detalle.slice(0, 200),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[evaluate-medals] error", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
