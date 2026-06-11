CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE j text;
BEGIN
  FOREACH j IN ARRAY ARRAY['purge-retos-vn-diario','purge-sync-jobs','purge-streak-daily-progress','purge-notificaciones-leidas']
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN
      PERFORM cron.unschedule(j);
    END IF;
  END LOOP;
END $$;

SELECT cron.schedule(
  'purge-retos-vn-diario',
  '0 3 * * *',
  $$ DELETE FROM public.retos_vn_progreso_diario WHERE fecha_evaluacion < (CURRENT_DATE - INTERVAL '90 days') $$
);

SELECT cron.schedule(
  'purge-sync-jobs',
  '30 3 * * *',
  $$ DELETE FROM public.sync_jobs WHERE created_at < (NOW() - INTERVAL '30 days') $$
);

SELECT cron.schedule(
  'purge-streak-daily-progress',
  '0 4 * * *',
  $$ DELETE FROM public.streak_daily_progress WHERE progress_date < (CURRENT_DATE - INTERVAL '90 days') $$
);

SELECT cron.schedule(
  'purge-notificaciones-leidas',
  '30 2 * * *',
  $$ DELETE FROM public.notificaciones WHERE leida = true AND created_at < (NOW() - INTERVAL '90 days') $$
);

DROP TABLE IF EXISTS
  public.advisor_badges,
  public.gamification_badges,
  public.gamification_challenges,
  public.gamification_streaks,
  public.challenge_thresholds,
  public.streak_thresholds,
  public.advisor_challenge_completions,
  public.reward_redemptions,
  public.rewards_catalog,
  public.wallet_sp_canje,
  public.sp_transactions
CASCADE;

DELETE FROM public.retos_vn_progreso_diario WHERE fecha_evaluacion < (CURRENT_DATE - INTERVAL '90 days');