DO $$
BEGIN
  PERFORM cron.unschedule('purge-retos-vn-diario')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='purge-retos-vn-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-retos-vn-diario',
  '0 3 * * *',
  $$ DELETE FROM public.retos_vn_progreso_diario
     WHERE fecha_evaluacion < (CURRENT_DATE - INTERVAL '90 days') $$
);