DO $$
DECLARE
  v_url_meta_acv text := 'https://vivfrsrgknzhxgbcvzte.supabase.co/functions/v1/sync-metas-acv-databricks';
  v_url_sync     text := 'https://vivfrsrgknzhxgbcvzte.supabase.co/functions/v1/sync-databricks';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  PERFORM net.http_post(
    url := v_url_meta_acv,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body := '{"all_2026": true}'::jsonb
  );

  PERFORM net.http_post(
    url := v_url_sync,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body := '{"mode":"sync","table":"metas_gerentes"}'::jsonb
  );
END $$;