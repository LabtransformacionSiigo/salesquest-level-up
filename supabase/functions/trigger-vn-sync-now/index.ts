import { requireRole } from "../_shared/admin-auth.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const _guard = await requireRole(req, ["admin","especialista"], { allowCronSecret: true });
  if (_guard.error) return _guard.error;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const dispatch = (path: string, body: any = {}) =>
    fetch(`${supabaseUrl}/functions/v1${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify(body),
    })
      .then(async (r) => ({ path, status: r.status, body: await r.text().then((t) => t.slice(0, 500)) }))
      .catch((e) => ({ path, error: String(e) }));

  // Lanzar todas en paralelo
  const results = await Promise.all([
    dispatch('/sync-databricks', { mode: 'sync', table: 'all_new' }),
    dispatch('/sync-vn-metricas', {}),
    dispatch('/sync-vn-mexico', {}),
  ]);

  return new Response(JSON.stringify({ success: true, results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
