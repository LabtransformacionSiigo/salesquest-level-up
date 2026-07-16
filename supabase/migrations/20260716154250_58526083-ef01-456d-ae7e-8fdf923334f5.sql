SELECT net.http_post(
  url := 'https://vivfrsrgknzhxgbcvzte.supabase.co/functions/v1/sync-databricks',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpdmZyc3Jna256aHhnYmN2enRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc3ODgxMiwiZXhwIjoyMDgwMzU0ODEyfQ.7nMTe2mNciqrDFtq_bChxfAZkixZOiq01v7g-hR3zuk"}'::jsonb,
  body := '{"mode":"sync","table":"metas_gerentes"}'::jsonb
) AS request_id;