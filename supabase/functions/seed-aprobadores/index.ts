import { requireRole } from "../_shared/admin-auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VN_EMP = "Venta Nueva (Empresarios)";
const VN_ALI = "Venta Nueva (Aliados)";
const VC = "Venta Cruzada";

// Cada item: aprobador con su scope (paises[] y operaciones[]).
// Se crean ambos miembros de cada dupla con el MISMO scope.
const APROBADORES = [
  // COL — VN Empresarios
  { nombre: "Veronica Paola Ortiz Zapata", email: "veronica.ortiz@siigo.com", paises: ["COL"], operaciones: [VN_EMP] },
  { nombre: "Maria Garzon",                 email: "maria.garzon@siigo.com",   paises: ["COL"], operaciones: [VN_EMP, VN_ALI] },

  // COL — VN Aliados
  { nombre: "Juan Pablo Buitron Castillo",  email: "juan.buitron@siigo.com",   paises: ["COL"], operaciones: [VN_ALI] },

  // COL — Venta Cruzada
  { nombre: "Angie Natalia Molano Moreno",  email: "angie.molano@siigo.com",   paises: ["COL"], operaciones: [VC] },
  { nombre: "Ana Maria De La Ossa Munoz",   email: "ana.delaossa@siigo.com",   paises: ["COL"], operaciones: [VC] },

  // ECU + URU — VN Empresarios + Aliados
  { nombre: "Laura Fernanda Monroy Blanco", email: "laura.monroy@siigo.com",   paises: ["ECU", "URU"], operaciones: [VN_EMP, VN_ALI] },
  { nombre: "Lorena Avendano Fonseca",      email: "lorena.avendano@siigo.com",paises: ["ECU", "URU"], operaciones: [VN_EMP, VN_ALI] },

  // MEX — VN Empresarios
  { nombre: "Estefania Fajardo Montes",     email: "estefania.fajardo@siigo.com", paises: ["MEX"], operaciones: [VN_EMP] },
  { nombre: "Gina Estefania Melo Sanchez",  email: "estefania.melo@siigo.com",    paises: ["MEX"], operaciones: [VN_EMP, VN_ALI] },

  // MEX — VN Aliados
  { nombre: "Lizeth Yamile Rivera Garcia",  email: "lizeth.rivera@siigo.com",  paises: ["MEX"], operaciones: [VN_ALI] },
];

const PASSWORD = "Siigo2026!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _guard = await requireRole(req, ["admin"]);
  if (_guard.error) return _guard.error;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: any[] = [];

  for (const ap of APROBADORES) {
    try {
      let userId: string | null = null;
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: ap.email,
        email_confirm: true,
        user_metadata: { name: ap.nombre },
      });

      if (createErr && !createErr.message.toLowerCase().includes("already")) {
        results.push({ email: ap.email, error: createErr.message });
        continue;
      }

      if (created?.user) {
        userId = created.user.id;
      } else {
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list.users.find((u) => u.email?.toLowerCase() === ap.email.toLowerCase());
        userId = existing?.id ?? null;
      }

      if (!userId) {
        results.push({ email: ap.email, error: "No se pudo obtener user_id" });
        continue;
      }

      await supabase.from("user_roles").upsert(
        { user_id: userId, role: "aprobador" },
        { onConflict: "user_id,role" },
      );

      await supabase.from("aprobador_permisos").upsert(
        {
          user_id: userId,
          nombre: ap.nombre,
          email: ap.email,
          paises: ap.paises,
          operaciones: ap.operaciones,
        },
        { onConflict: "user_id" },
      );

      results.push({ email: ap.email, user_id: userId, paises: ap.paises, operaciones: ap.operaciones, ok: true });
    } catch (e: any) {
      results.push({ email: ap.email, error: e.message });
    }
  }

  return new Response(JSON.stringify({ count: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
