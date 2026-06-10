import { requireRole } from "../_shared/admin-auth.ts";
// Repara el acceso de un gerente o especialista:
// - Busca el usuario en auth.users por email (paginando)
// - Si no existe, lo crea (email_confirm=true)
// - Resetea la contraseña a la que se pase (default SiigoArena2026!)
// - Confirma el email
// - Sincroniza gerentes.user_id al user real
// - Si otro gerente tenía ese user_id, lo libera (NULL)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = "SiigoArena2026!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await requireRole(req, ["admin"]);
  if (_guard.error) return _guard.error;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let body: any = {};
  try { body = await req.json(); } catch {}

  // Modo masivo: { mode: 'especialistas' } o { mode: 'emails', emails: [...] }
  const mode: string = String(body?.mode || "single");
  const password: string = String(body?.password || DEFAULT_PASSWORD);

  const getIdentityEmail = (identity: any) => String(
    identity?.identity_data?.email || identity?.identity_data?.email_normalized || identity?.email || "",
  ).trim().toLowerCase();

  const findAuthUserByEmail = async (email: string): Promise<{ id: string; email: string; foundBy: string } | null> => {
    const target = email.toLowerCase();
    // 1) Intento directo vía REST admin con filter (mucho más confiable que paginar)
    try {
      const url = `${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users?filter=${encodeURIComponent(target)}&per_page=50`;
      const res = await fetch(url, {
        headers: {
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
        },
      });
      if (res.ok) {
        const json: any = await res.json();
        const users: any[] = json?.users || [];
        const found = users.find((u: any) => {
          const primaryEmail = String(u.email || "").trim().toLowerCase();
          const metadataEmail = String(u.user_metadata?.email || u.raw_user_meta_data?.email || "").trim().toLowerCase();
          const identityEmails = (u.identities || []).map(getIdentityEmail);
          return primaryEmail === target || metadataEmail === target || identityEmails.includes(target);
        });
        if (found) return { id: found.id, email: found.email || "", foundBy: "filter" };
      }
    } catch (_) { /* fallback a paginación */ }

    // 2) Fallback: paginación amplia (hasta 50k usuarios)
    for (let page = 1; page <= 50; page++) {
      const { data: list, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const users = list?.users ?? [];
      const found = users.find((u: any) => {
        const primaryEmail = String(u.email || "").trim().toLowerCase();
        const metadataEmail = String(u.user_metadata?.email || u.raw_user_meta_data?.email || "").trim().toLowerCase();
        const identityEmails = (u.identities || []).map(getIdentityEmail);
        return primaryEmail === target || metadataEmail === target || identityEmails.includes(target);
      });
      if (found) return { id: found.id, email: found.email || "", foundBy: String(found.email || "").toLowerCase() === target ? "primary" : "identity_or_metadata" };
      if (users.length < 1000) break;
    }
    return null;
  };

  const repairOne = async (rawEmail: string) => {
    const email = String(rawEmail || "").trim().toLowerCase();
    if (!email) return { email: rawEmail, status: "skip_no_email" };

    let userId: string | null = null;
    const { data: gerenteRow } = await sb
      .from("gerentes")
      .select("id, nombre, canal, celula, pais, user_id")
      .ilike("email", email)
      .order("activo", { ascending: false })
      .limit(1)
      .maybeSingle();

    const found = await findAuthUserByEmail(email);

    if (found) {
      userId = found.id;
      const { error: upErr } = await sb.auth.admin.updateUserById(found.id, {
        email,
        password,
        email_confirm: true,
        user_metadata: {
          email,
          name: gerenteRow?.nombre || email.split("@")[0],
          nombre: gerenteRow?.nombre || email.split("@")[0],
          role: "gerente",
          canal: gerenteRow?.canal ?? null,
          pais: gerenteRow?.pais ?? null,
          celula: gerenteRow?.celula ?? null,
        },
      });
      if (upErr) return { email, status: "error", error: `update: ${upErr.message}` };
    } else {
      const { data: created, error: cErr } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (cErr || !created?.user?.id) {
        // Si Supabase dice "already registered", obtener el user id vía generateLink (recovery)
        const msg = String(cErr?.message || "");
        if (/already.*registered|already.*been.*registered/i.test(msg)) {
          try {
            const { data: linkData, error: linkErr } = await (sb.auth.admin as any).generateLink({
              type: "recovery",
              email,
            });
            const recoveredId = linkData?.user?.id || linkData?.user_id;
            if (recoveredId) {
              const { error: upErr2 } = await sb.auth.admin.updateUserById(recoveredId, {
                email,
                password,
                email_confirm: true,
                user_metadata: {
                  email,
                  name: gerenteRow?.nombre || email.split("@")[0],
                  nombre: gerenteRow?.nombre || email.split("@")[0],
                  role: "gerente",
                  canal: gerenteRow?.canal ?? null,
                  pais: gerenteRow?.pais ?? null,
                  celula: gerenteRow?.celula ?? null,
                },
              });
              if (upErr2) return { email, status: "error", error: `update_recovered: ${upErr2.message}` };
              userId = recoveredId;
            } else {
              return { email, status: "error", error: `create: ${msg}; recovery: ${linkErr?.message || "no user id"}` };
            }
          } catch (e: any) {
            return { email, status: "error", error: `create: ${msg}; recovery_throw: ${e?.message || e}` };
          }
        } else {
          return { email, status: "error", error: `create: ${msg || "no user"}` };
        }
      } else {
        userId = created.user.id;
      }
    }

    if (!userId) return { email, status: "error", error: "no_user_id" };

    if (gerenteRow) {
      // Liberar user_id de otros registros que lo tengan
      await sb.from("gerentes").update({ user_id: null })
        .eq("user_id", userId)
        .neq("id", gerenteRow.id);
      // Asignarlo al gerente correcto
      if (gerenteRow.user_id !== userId) {
        await sb.from("gerentes").update({ user_id: userId }).eq("id", gerenteRow.id);
      }
      await sb.from("user_roles").delete().eq("user_id", userId).neq("role", "gerente");
      await sb.from("user_roles").upsert({ user_id: userId, role: "gerente" }, { onConflict: "user_id,role" });
    }

    return {
      email,
      user_id: userId,
      gerente_id: gerenteRow?.id ?? null,
      nombre: gerenteRow?.nombre ?? null,
      canal: gerenteRow?.canal ?? null,
      celula: gerenteRow?.celula ?? null,
      status: "ok",
      password_reset: true,
    };
  };

  // Resolver lista de emails a reparar
  let emails: string[] = [];
  if (mode === "especialistas") {
    const { data, error } = await sb
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "especialista");
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ids = (data || []).map((r: any) => r.user_id);
    // Traer emails
    const collected: string[] = [];
    for (let page = 1; page <= 50; page++) {
      const { data: list } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      if (!list?.users?.length) break;
      list.users.forEach((u: any) => {
        if (ids.includes(u.id) && u.email) collected.push(u.email.toLowerCase());
      });
      if (list.users.length < 200) break;
    }
    emails = [...new Set(collected)];
  } else if (mode === "emails" && Array.isArray(body?.emails)) {
    emails = body.emails.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean);
  } else {
    const single = String(body?.email || "").trim().toLowerCase();
    if (!single) {
      return new Response(JSON.stringify({ error: "email or mode required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    emails = [single];
  }

  const results: any[] = [];
  for (const e of emails) {
    try { results.push(await repairOne(e)); }
    catch (err: any) { results.push({ email: e, status: "error", error: err?.message || String(err) }); }
  }

  return new Response(JSON.stringify({
    success: true,
    count: results.length,
    ok: results.filter((r) => r.status === "ok").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
