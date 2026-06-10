import { requireRole } from "../_shared/admin-auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ESPECIALISTAS = [
  { nombre: "Juan Camilo Chavez", email: "juan.chavez@siigo.com", paises: ["COL"], operaciones: ["Venta Nueva (Empresarios)"] },
  { nombre: "Dayanna Alejandra Pinilla", email: "dayanna.pinilla@siigo.com", paises: ["COL"], operaciones: ["Venta Nueva (Aliados)"] },
  { nombre: "Said Nicolás Gómez", email: "said.gomez@siigo.com", paises: ["COL"], operaciones: ["Venta Cruzada"] },
  { nombre: "Juan Sebastián Arce", email: "juan.arce@siigo.com", paises: ["ECU", "URU"], operaciones: ["Venta Nueva (Empresarios)", "Venta Nueva (Aliados)"] },
  { nombre: "Wilmer Alexis Hernández Jara", email: "wilmer.hernandez@siigo.com", paises: ["MEX"], operaciones: ["Venta Nueva (Empresarios)"] },
  { nombre: "Angela Patricia Hernández", email: "angela.hernandez@siigo.com", paises: ["MEX"], operaciones: ["Venta Nueva (Aliados)"] },
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

  for (const esp of ESPECIALISTAS) {
    try {
      // 1. Crear o recuperar usuario auth
      let userId: string | null = null;
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: esp.email,
        email_confirm: true,
        user_metadata: { name: esp.nombre },
      });

      if (createErr && !createErr.message.toLowerCase().includes("already")) {
        results.push({ email: esp.email, error: createErr.message });
        continue;
      }

      if (created?.user) {
        userId = created.user.id;
      } else {
        // Buscar usuario existente
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list.users.find((u) => u.email === esp.email);
        userId = existing?.id ?? null;
      }

      if (!userId) {
        results.push({ email: esp.email, error: "No se pudo obtener user_id" });
        continue;
      }

      // 2. Asignar rol especialista
      await supabase.from("user_roles").upsert(
        { user_id: userId, role: "especialista" },
        { onConflict: "user_id,role" },
      );

      // 3. Upsert permisos
      await supabase.from("especialista_permisos").upsert(
        {
          user_id: userId,
          nombre: esp.nombre,
          email: esp.email,
          paises: esp.paises,
          operaciones: esp.operaciones,
        },
        { onConflict: "user_id" },
      );

      results.push({ email: esp.email, user_id: userId, ok: true });
    } catch (e: any) {
      results.push({ email: esp.email, error: e.message });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
