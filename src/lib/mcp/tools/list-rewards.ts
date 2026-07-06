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
  name: "list_rewards",
  title: "List available rewards",
  description:
    "Returns the active rewards (premios) catalog available to redeem with SP Canje. Optionally filter by country and operation.",
  inputSchema: {
    pais: z.enum(["COL", "MEX", "ECU", "URU"]).optional().describe("Country code filter."),
    operacion: z.string().optional().describe("Operation filter (e.g. 'Venta Cruzada')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ pais, operacion }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("premios")
      .select("id, nombre, descripcion, costo_puntos, stock, pais, operacion, imagen_url")
      .eq("activo", true)
      .order("costo_puntos", { ascending: true });
    if (pais) q = q.eq("pais", pais);
    if (operacion) q = q.eq("operacion", operacion);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { rewards: data ?? [] },
    };
  },
});
