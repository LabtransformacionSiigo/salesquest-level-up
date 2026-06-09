// Limpieza de gerentes duplicados/mal formados.
// 1) Renombra emails 'emp-...' a nombre.apellido@siigo.com en los registros que se conservan.
// 2) Borra los registros duplicados de gerentes y sus auth.users asociados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan derivado del análisis manual con el usuario.
// keep: { id, newEmail? } -> renombrar email si trae newEmail
// remove: ids de gerentes a borrar (también borra auth.users si user_id existe)
const KEEP: Array<{ id: string; newEmail?: string }> = [
  { id: "84259259-49c8-45c3-8c5a-a2da7ab2aebe", newEmail: "juan.giraldo.robledo@siigo.com" }, // Juan Esteban Giraldo Robledo (Equipo B&M Walter)
  { id: "c92fcb7b-450a-45da-8c66-f430927c5217", newEmail: "laura.torres.puentes@siigo.com" }, // Laura Alejandra Torres Puentes (Equipo México Julio)
  { id: "2afb2e3e-637d-4ecf-aaa7-8e6936a97cd9", newEmail: "paula.bohorquez.lozan@siigo.com" }, // Paula Stefania Bohorquez Lozan
  { id: "f2e507b4-7017-45c1-9cde-a826214b63f2", newEmail: "yaneth.bohorquez.oli@siigo.com" }, // Yaneth Alejandra Bohorquez Oli
];

const REMOVE_IDS: string[] = [
  // VC mal formados (nombres tipo "luis.pachon")
  "cdced17d-9f41-4335-bc85-cbea8f945c7c", // luis.pachon
  "0c3c43f3-ca74-40e4-9cac-6b468598e7a4", // maritza.robledo
  "14847742-bfcd-47b7-9bbe-319e6b5666c0", // david.capera
  "f7139b99-36c3-43e5-b44f-8869762d9aed", // karen.puentes
  "1f04d05f-26b0-415a-93ab-c58927df2a3c", // diego.bohorquez
  "97a1f891-cb8d-4b54-b610-2566715f7d01", // viviana.baracaldo
  // Duplicados mismo nombre — los que NO tienen celula
  "cbc3b578-29dd-453d-b195-dc34adf658cc", // Juan Esteban Giraldo Robledo (VC sin celula)
  "03cd41bb-cf50-4ab2-8744-eaf9e27d89ab", // Juan Esteban Giraldo Robledo (VN_EMP sin celula)
  "ac14cafb-520f-493c-b57c-9095a0c95d3c", // Laura Alejandra Torres Puentes (sin celula)
  "246c91d4-386e-44ca-ac10-2ae2a0661e72", // Laura Alejandra Torres Puentes (sin celula)
  "ef217e27-55b5-48b6-be0c-17f74c72bd21", // Paula Stefania Bohorquez Lozan (VC sin celula)
  "de647ca7-1eed-42e6-a2cb-b8aee9a45e43", // Yaneth Alejandra Bohorquez Oli (VC sin celula)
  "8c0ccba7-45f8-45bd-92cf-d0c8efa95ad1", // Yaneth Alejandra Bohorquez Oli (VN_EMP sin celula)
];

const norm = (v: unknown) => String(v ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ").trim().toLowerCase();

const moveSpCanjeHistory = async (sb: any, source: any, dryRun: boolean, log: any[]) => {
  const { data: keepRows } = await sb
    .from("gerentes")
    .select("id, nombre")
    .in("id", KEEP.map((k) => k.id));
  const target = (keepRows || []).find((k: any) => k.id !== source.id && norm(k.nombre) === norm(source.nombre));
  if (!target) {
    log.push({ op: "preserve_sp", id: source.id, skip: "no_target_keep" });
    return;
  }

  const { data: rows } = await sb
    .from("sp_acumulados")
    .select("id, fuente, sp, periodo, detalle, tipo_sp")
    .eq("gerente_id", source.id);

  for (const row of rows || []) {
    const marker = `TRANSFERIDO_DESDE:${source.id}:${row.id}`;
    if (dryRun) {
      log.push({ op: "move_sp", from: source.id, to: target.id, fuente: row.fuente, periodo: row.periodo, sp: row.sp });
      continue;
    }

    const { data: existing } = await sb
      .from("sp_acumulados")
      .select("id, sp, detalle")
      .eq("gerente_id", target.id)
      .eq("fuente", row.fuente)
      .eq("periodo", row.periodo)
      .maybeSingle();

    if (existing) {
      const detail = String(existing.detalle || "");
      if (!detail.includes(marker)) {
        await sb.from("sp_acumulados").update({
          sp: (Number(existing.sp) || 0) + (Number(row.sp) || 0),
          detalle: `${detail}${detail ? " | " : ""}${row.detalle || "SP transferido"} · ${marker}`,
          tipo_sp: existing.tipo_sp || row.tipo_sp || "canje",
        }).eq("id", existing.id);
      }
      await sb.from("sp_acumulados").delete().eq("id", row.id);
    } else {
      await sb.from("sp_acumulados").insert({
        gerente_id: target.id,
        fuente: row.fuente,
        sp: row.sp,
        periodo: row.periodo,
        detalle: `${row.detalle || "SP transferido"} · ${marker}`,
        tipo_sp: row.tipo_sp || "canje",
      });
      await sb.from("sp_acumulados").delete().eq("id", row.id);
    }
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let body: any = {};
  try { body = await req.json(); } catch {}
  const dryRun: boolean = body?.dryRun === true;

  const log: any[] = [];
  let renamed = 0, deletedGerentes = 0, deletedAuth = 0, errors = 0;

  // 1) RENOMBRAR emails de los KEEP (y actualizar auth.users si hay user_id)
  for (const k of KEEP) {
    if (!k.newEmail) continue;
    const { data: g } = await sb.from("gerentes").select("id, email, user_id, nombre").eq("id", k.id).maybeSingle();
    if (!g) { errors++; log.push({ op: "rename", id: k.id, error: "not_found" }); continue; }
    if (g.email === k.newEmail) { log.push({ op: "rename", id: k.id, skip: "same_email" }); continue; }
    if (dryRun) { log.push({ op: "rename", id: k.id, from: g.email, to: k.newEmail }); renamed++; continue; }

    // Si hay otro gerente con ese email destino → no podemos colisionar.
    const { data: collide } = await sb.from("gerentes").select("id").eq("email", k.newEmail).neq("id", k.id).maybeSingle();
    if (collide) { errors++; log.push({ op: "rename", id: k.id, error: `email_collision:${k.newEmail}` }); continue; }

    const { error: upErr } = await sb.from("gerentes").update({ email: k.newEmail }).eq("id", k.id);
    if (upErr) { errors++; log.push({ op: "rename", id: k.id, error: upErr.message }); continue; }

    if (g.user_id) {
      const { error: aErr } = await sb.auth.admin.updateUserById(g.user_id, {
        email: k.newEmail,
        email_confirm: true,
        password: "SiigoArena2026!",
      });
      if (aErr) log.push({ op: "rename_auth", id: k.id, warning: aErr.message });
    }
    renamed++;
    log.push({ op: "rename", id: k.id, from: g.email, to: k.newEmail, ok: true });
  }

  // 2) BORRAR gerentes duplicados + sus auth.users
  for (const id of REMOVE_IDS) {
    const { data: g } = await sb.from("gerentes").select("id, email, user_id, nombre").eq("id", id).maybeSingle();
    if (!g) { log.push({ op: "delete", id, skip: "not_found" }); continue; }
    if (dryRun) { log.push({ op: "delete", id, email: g.email, user_id: g.user_id }); continue; }

    await moveSpCanjeHistory(sb, g, dryRun, log);

    // Borrar dependencias en cascada manual. sp_acumulados NO se borra en bloque:
    // primero se reasigna de forma idempotente al registro conservado o se preserva.
    const tables = [
      "notificaciones", "medallas", "canjes", "rachas",
      "retos_completados", "kpis_mensuales",
    ];
    for (const t of tables) {
      await sb.from(t).delete().eq("gerente_id", id);
    }
    await sb.from("reconocimientos").delete().or(`de_gerente_id.eq.${id},para_gerente_id.eq.${id}`);
    await sb.from("asesores").delete().eq("gerente_id", id);

    const { error: dErr } = await sb.from("gerentes").delete().eq("id", id);
    if (dErr) { errors++; log.push({ op: "delete", id, error: dErr.message }); continue; }
    deletedGerentes++;

    if (g.user_id) {
      const { error: aErr } = await sb.auth.admin.deleteUser(g.user_id);
      if (aErr) {
        log.push({ op: "delete_auth", id, user_id: g.user_id, warning: aErr.message });
      } else {
        deletedAuth++;
      }
    }
    log.push({ op: "delete", id, email: g.email, ok: true });
  }

  return new Response(JSON.stringify({
    success: true,
    dryRun,
    renamed,
    deletedGerentes,
    deletedAuth,
    errors,
    log,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
