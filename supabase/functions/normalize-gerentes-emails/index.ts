// Normaliza emails de gerentes a nombre.apellido@siigo.com, crea/sincroniza
// usuarios en Auth, resetea contraseña a SiigoArena2026! y maneja colisiones.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = "SiigoArena2026!";

// Quita acentos y caracteres no [a-z0-9]
function slug(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]/g, "");
}

// Devuelve una lista ordenada de candidatos de email para un nombre.
// Para "Maritza Cristina Robledo Piñeros" => 
//   maritza.robledo, maritza.cristina.robledo, maritza.robledo.pineros, maritza.cristina.robledo.pineros
function buildEmailCandidates(nombre: string): string[] {
  const tokens = nombre.trim().split(/\s+/).filter(Boolean).map(slug).filter(Boolean);
  if (tokens.length === 0) return [];
  if (tokens.length === 1) return [`${tokens[0]}@siigo.com`];
  if (tokens.length === 2) return [`${tokens[0]}.${tokens[1]}@siigo.com`];

  const first = tokens[0];
  const second = tokens[1];
  // Asumimos: 3 tokens => N AP1 AP2 ; 4+ tokens => N1 N2 AP1 AP2
  const ap1 = tokens.length >= 4 ? tokens[2] : tokens[1];
  const ap2 = tokens.length >= 4 ? tokens[3] : tokens[2];

  const cands = new Set<string>();
  cands.add(`${first}.${ap1}@siigo.com`);
  if (tokens.length >= 4) cands.add(`${first}.${second}.${ap1}@siigo.com`);
  cands.add(`${first}.${ap1}.${ap2}@siigo.com`);
  if (tokens.length >= 4) cands.add(`${first}.${second}.${ap1}.${ap2}@siigo.com`);
  // último fallback con sufijo numérico se gestiona en el llamador
  return Array.from(cands);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let body: any = {};
  try { body = await req.json(); } catch { /* default */ }
  const dryRun: boolean = body?.dryRun === true;
  const offset: number = Number(body?.offset || 0);
  const limit: number = Math.min(Number(body?.limit || 100), 200);

  // 1) Cargar lote de gerentes "reales" (sin placeholder emp-xxx)
  const { data: gerentes, error: gErr } = await supabase
    .from("gerentes")
    .select("id, nombre, email, user_id")
    .not("email", "like", "emp-%")
    .order("nombre", { ascending: true })
    .range(offset, offset + limit - 1);

  if (gErr) {
    return new Response(JSON.stringify({ error: gErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Set de emails ocupados (incluye placeholders emp- para no chocar)
  const { data: allEmails } = await supabase.from("gerentes").select("email").range(0, 4999);
  const usedEmails = new Set<string>((allEmails || []).map((r: any) => (r.email || "").toLowerCase()));

  const log: any[] = [];
  let renamed = 0, sameEmail = 0, authCreated = 0, authUpdated = 0, pwdReset = 0, errors = 0;

  for (const g of gerentes || []) {
    try {
      const currentEmail = (g.email || "").toLowerCase();
      const candidates = buildEmailCandidates(g.nombre || "");
      if (candidates.length === 0) continue;

      // Elegir primer candidato disponible (o el que ya tiene asignado)
      let target = "";
      for (const c of candidates) {
        if (c === currentEmail) { target = c; break; }
        if (!usedEmails.has(c)) { target = c; break; }
      }
      if (!target) {
        // Sufijo numérico como último recurso
        const base = candidates[0].replace("@siigo.com", "");
        for (let i = 2; i < 50; i++) {
          const c = `${base}${i}@siigo.com`;
          if (!usedEmails.has(c)) { target = c; break; }
        }
      }
      if (!target) { errors++; log.push({ id: g.id, nombre: g.nombre, error: "no_target_email" }); continue; }

      // Liberar el email actual del set, ocupar el nuevo
      if (currentEmail) usedEmails.delete(currentEmail);
      usedEmails.add(target);

      const emailChanged = target !== currentEmail;

      if (dryRun) {
        log.push({ id: g.id, nombre: g.nombre, from: currentEmail, to: target, emailChanged });
        if (emailChanged) renamed++; else sameEmail++;
        continue;
      }

      // 2) Manejar usuario en Auth
      let userId = g.user_id as string | null;

      if (userId) {
        // Actualizar email + password del usuario existente
        const updates: any = { password: DEFAULT_PASSWORD, email_confirm: true };
        if (emailChanged) updates.email = target;
        const { error: uErr } = await supabase.auth.admin.updateUserById(userId, updates);
        if (uErr) {
          // Si falla por colisión en auth (otro user con ese email), buscar y enlazar
          const msg = uErr.message || "";
          if (msg.toLowerCase().includes("email") && emailChanged) {
            const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
            const existing = list?.users?.find((u: any) => (u.email || "").toLowerCase() === target);
            if (existing) {
              userId = existing.id;
              await supabase.auth.admin.updateUserById(existing.id, { password: DEFAULT_PASSWORD, email_confirm: true });
              authUpdated++;
            } else {
              errors++; log.push({ id: g.id, nombre: g.nombre, error: msg });
              continue;
            }
          } else {
            errors++; log.push({ id: g.id, nombre: g.nombre, error: msg });
            continue;
          }
        } else {
          authUpdated++;
        }
        pwdReset++;
      } else {
        // Crear nuevo usuario en Auth
        const { data: created, error: cErr } = await supabase.auth.admin.createUser({
          email: target,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { name: g.nombre },
        });
        if (cErr) {
          // Si ya existe un user con ese email, enlazar
          const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
          const existing = list?.users?.find((u: any) => (u.email || "").toLowerCase() === target);
          if (existing) {
            userId = existing.id;
            await supabase.auth.admin.updateUserById(existing.id, { password: DEFAULT_PASSWORD, email_confirm: true });
            authUpdated++;
          } else {
            errors++; log.push({ id: g.id, nombre: g.nombre, error: cErr.message });
            continue;
          }
        } else {
          userId = created.user.id;
          authCreated++;
        }
        pwdReset++;
      }

      // 3) Sincronizar gerentes (email + user_id)
      const { error: upErr } = await supabase
        .from("gerentes")
        .update({ email: target, user_id: userId })
        .eq("id", g.id);
      if (upErr) {
        errors++; log.push({ id: g.id, nombre: g.nombre, error: `db_update: ${upErr.message}` });
        continue;
      }

      if (emailChanged) renamed++; else sameEmail++;
    } catch (e: any) {
      errors++;
      log.push({ id: g.id, nombre: g.nombre, error: e?.message || String(e) });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    dryRun,
    offset,
    limit,
    processed: (gerentes || []).length,
    nextOffset: (gerentes || []).length === limit ? offset + limit : null,
    renamed,
    sameEmail,
    authCreated,
    authUpdated,
    pwdReset,
    errors,
    sample: log.slice(0, 20),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
