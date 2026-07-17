
-- Paso 2: cron 39 async, cron 41 desactivado
SELECT cron.alter_job(
  39,
  command := $CMD$
  SELECT net.http_post(
    url := 'https://vivfrsrgknzhxgbcvzte.supabase.co/functions/v1/evaluar-retos-vn',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpdmZyc3Jna256aHhnYmN2enRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc3ODgxMiwiZXhwIjoyMDgwMzU0ODEyfQ.7nMTe2mNciqrDFtq_bChxfAZkixZOiq01v7g-hR3zuk"}'::jsonb,
    body := '{"async":true}'::jsonb
  );
  $CMD$
);
SELECT cron.alter_job(41, active := false);

-- Paso 3: re-armar cola con orden explícito
TRUNCATE public._backfill_vn_junio;

WITH jun_early AS (
  SELECT ROW_NUMBER() OVER (ORDER BY d) AS orden, to_char(d,'YYYY-MM-DD') AS fecha
  FROM generate_series('2026-06-01'::date, '2026-06-27'::date, '1 day') AS d
),
jun_tail AS (
  SELECT * FROM (VALUES
    (28, '2026-06-29'),
    (29, '2026-06-30'),
    (30, '2026-06-28')
  ) AS t(orden, fecha)
),
jul AS (
  SELECT (30 + ROW_NUMBER() OVER (ORDER BY d))::int AS orden, to_char(d,'YYYY-MM-DD') AS fecha
  FROM generate_series('2026-07-01'::date, CURRENT_DATE, '1 day') AS d
)
INSERT INTO public._backfill_vn_junio(orden, fecha)
SELECT orden, fecha FROM jun_early
UNION ALL SELECT orden, fecha FROM jun_tail
UNION ALL SELECT orden, fecha FROM jul;

-- Actualizar la función para enviar async:true
CREATE OR REPLACE FUNCTION public.procesar_backfill_vn_junio()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    body := jsonb_build_object('fecha', r.fecha, 'async', true)
  );

  UPDATE public._backfill_vn_junio
     SET done = true, disparado_at = now()
   WHERE orden = r.orden;
END;
$function$;

-- Paso 4: reprogramar cron (si ya existe, unschedule primero)
DO $$
BEGIN
  PERFORM cron.unschedule('backfill-vn-junio');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('backfill-vn-junio', '*/2 * * * *', $$SELECT public.procesar_backfill_vn_junio();$$);
