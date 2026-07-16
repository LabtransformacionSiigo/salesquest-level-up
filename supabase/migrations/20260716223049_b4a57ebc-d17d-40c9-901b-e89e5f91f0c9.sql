
CREATE TABLE IF NOT EXISTS public._backfill_vn_junio (
  orden int PRIMARY KEY,
  fecha text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  disparado_at timestamptz
);

GRANT ALL ON public._backfill_vn_junio TO service_role;

INSERT INTO public._backfill_vn_junio(orden, fecha) VALUES
  (1,'2026-06-07'),(2,'2026-06-14'),(3,'2026-06-21'),(4,'2026-06-30'),(5,'2026-06-28')
ON CONFLICT (orden) DO NOTHING;

CREATE OR REPLACE FUNCTION public.procesar_backfill_vn_junio()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r FROM public._backfill_vn_junio
   WHERE NOT done ORDER BY orden LIMIT 1;

  IF NOT FOUND THEN
    PERFORM cron.unschedule('backfill-vn-junio');
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://vivfrsrgknzhxgbcvzte.supabase.co/functions/v1/evaluar-retos-vn',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpdmZyc3Jna256aHhnYmN2enRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc3ODgxMiwiZXhwIjoyMDgwMzU0ODEyfQ.7nMTe2mNciqrDFtq_bChxfAZkixZOiq01v7g-hR3zuk"}'::jsonb,
    body := jsonb_build_object('fecha', r.fecha)
  );

  UPDATE public._backfill_vn_junio
     SET done = true, disparado_at = now()
   WHERE orden = r.orden;
END;
$$;

SELECT cron.schedule(
  'backfill-vn-junio',
  '*/2 * * * *',
  $$SELECT public.procesar_backfill_vn_junio();$$
);
