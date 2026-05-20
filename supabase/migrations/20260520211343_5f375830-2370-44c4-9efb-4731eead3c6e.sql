
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-vn-historico-diario') THEN
    PERFORM cron.unschedule('sync-vn-historico-diario');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-vn-historico-diario',
  '15 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vivfrsrgknzhxgbcvzte.supabase.co/functions/v1/sync-vn-historico',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
