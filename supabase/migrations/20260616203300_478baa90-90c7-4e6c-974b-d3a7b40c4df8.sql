-- PASO 0b: índices faltantes en gerente_id (causa raíz del costo)
CREATE INDEX IF NOT EXISTS idx_retos_vn_progreso_diario_gerente
  ON public.retos_vn_progreso_diario (gerente_id);
CREATE INDEX IF NOT EXISTS idx_retos_vn_progreso_semanal_gerente
  ON public.retos_vn_progreso_semanal (gerente_id);
CREATE INDEX IF NOT EXISTS idx_retos_vn_progreso_mensual_gerente
  ON public.retos_vn_progreso_mensual (gerente_id);
CREATE INDEX IF NOT EXISTS idx_rachas_vn_estado_gerente
  ON public.rachas_vn_estado (gerente_id);
CREATE INDEX IF NOT EXISTS idx_medallas_vn_ganadas_gerente
  ON public.medallas_vn_ganadas (gerente_id);

-- PASO 1: cron jobs de retención
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Limpiar jobs previos por si ya existen (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('purge-retos-vn-diario')        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='purge-retos-vn-diario');
  PERFORM cron.unschedule('purge-sync-jobs')              WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='purge-sync-jobs');
  PERFORM cron.unschedule('purge-streak-daily-progress')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='purge-streak-daily-progress');
  PERFORM cron.unschedule('purge-notificaciones-leidas')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='purge-notificaciones-leidas');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-retos-vn-diario',
  '0 3 * * *',
  $$ DELETE FROM public.retos_vn_progreso_diario
     WHERE fecha < (CURRENT_DATE - INTERVAL '90 days') $$
);

SELECT cron.schedule(
  'purge-sync-jobs',
  '30 3 * * *',
  $$ DELETE FROM public.sync_jobs
     WHERE created_at < (NOW() - INTERVAL '30 days') $$
);

SELECT cron.schedule(
  'purge-streak-daily-progress',
  '0 4 * * *',
  $$ DELETE FROM public.streak_daily_progress
     WHERE progress_date < (CURRENT_DATE - INTERVAL '90 days') $$
);

SELECT cron.schedule(
  'purge-notificaciones-leidas',
  '30 2 * * *',
  $$ DELETE FROM public.notificaciones
     WHERE leida = true
       AND created_at < (NOW() - INTERVAL '90 days') $$
);