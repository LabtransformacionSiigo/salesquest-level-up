
-- Schedule daily sync of VN metas for all 2026 months (all countries).
-- Order: first historicas (asesores + CEL aggregates filtered by aplica_cuota_lider=Si),
-- then ACV gerentes which overrides FE/NUBE from metas_asesores.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing jobs with same name to make this idempotent
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobname FROM cron.job
           WHERE jobname IN ('sync_metas_historicas_2026_daily','sync_metas_acv_2026_daily')
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

-- 05:30 UTC: sync histórico Ene–Abr 2026 (metas_asesores + CEL_ aggregates)
SELECT cron.schedule(
  'sync_metas_historicas_2026_daily',
  '30 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vivfrsrgknzhxgbcvzte.supabase.co/functions/v1/sync-metas-historicas',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('source','cron')
  );
  $$
);

-- 06:00 UTC: sync metas_acv_gerentes para TODOS los meses 2026 (Ene..mes actual), todos los países
SELECT cron.schedule(
  'sync_metas_acv_2026_daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vivfrsrgknzhxgbcvzte.supabase.co/functions/v1/sync-metas-acv-databricks',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('all_2026', true)
  );
  $$
);
