declare const process: { env: Record<string, string | undefined> };
import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_my_sp_history",
  title: "Get my Siigo Points history",
  description:
    "Returns the signed-in user's Siigo Points entries (sp_acumulados) grouped by period, with type (convencion/canje) and source. Optionally filter by period (YYYYMM) or tipo_sp.",
  inputSchema: {
    periodo: z
      .string()
      .regex(/^\d{6}$/)
      .optional()
      .describe("Period in YYYYMM format (e.g. 202606). Optional."),
    tipo_sp: z
      .enum(["convencion", "canje"])
      .optional()
      .describe("Filter by SP type. Optional."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ periodo, tipo_sp, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: gerente, error: gErr } = await sb
      .from("gerentes")
      .select("id")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (gErr || !gerente) {
      return { content: [{ type: "text", text: "No profile linked." }], isError: true };
    }
    let q = sb
      .from("sp_acumulados")
      .select("periodo, tipo_sp, sp, fuente, detalle, created_at")
      .eq("gerente_id", gerente.id)
      .order("periodo", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (periodo) q = q.eq("periodo", periodo);
    if (tipo_sp) q = q.eq("tipo_sp", tipo_sp);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { entries: data ?? [] },
    };
  },
});
