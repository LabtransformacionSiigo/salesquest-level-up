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
  name: "get_ranking",
  title: "Get Siigo Arena ranking",
  description:
    "Returns the top managers ranking for a channel and country in Siigo Arena. Use segment='vc' for Venta Cruzada or 'vn' for Venta Nueva.",
  inputSchema: {
    segment: z.enum(["vc", "vn"]).describe("Ranking segment: 'vc' (Venta Cruzada) or 'vn' (Venta Nueva)."),
    pais: z.enum(["COL", "MEX", "ECU", "URU"]).describe("Country code."),
    mes: z
      .string()
      .regex(/^\d{6}$/)
      .optional()
      .describe("Month in YYYYMM. Defaults to the latest available."),
    limit: z.number().int().min(1).max(50).optional().describe("Top N rows (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ segment, pais, mes, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const table = segment === "vc" ? "ranking_vc_gerentes" : "ranking_vn_gerentes";
    const monthCol = segment === "vc" ? "mes" : "mes_periodo";
    let targetMes = mes;
    if (!targetMes) {
      const { data: latest } = await sb
        .from(table)
        .select(monthCol)
        .eq("pais", pais)
        .order(monthCol, { ascending: false })
        .limit(1);
      targetMes = (latest?.[0] as any)?.[monthCol] ?? undefined;
    }
    if (!targetMes) {
      return { content: [{ type: "text", text: "No ranking data available." }], isError: true };
    }
    const { data, error } = await sb
      .from(table)
      .select("*")
      .eq("pais", pais)
      .eq(monthCol, targetMes)
      .order("posicion", { ascending: true })
      .limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ mes: targetMes, ranking: data }) }],
      structuredContent: { mes: targetMes, ranking: data ?? [] },
    };
  },
});
