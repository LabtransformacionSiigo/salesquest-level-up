CREATE OR REPLACE FUNCTION public.backfill_metas_acv_mex_vn()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ratios AS (
    SELECT canal, SUM(meta_total_acv)::numeric / NULLIF(SUM(meta_total_und),0) AS acv_per_und
    FROM metas_acv_gerentes
    WHERE pais='MEX' AND archivo='Cierre' AND meta_total_acv > 0 AND meta_total_und > 0
    GROUP BY canal
  )
  UPDATE metas_acv_gerentes m
  SET meta_total_acv = ROUND(r.acv_per_und * m.meta_total_und),
      updated_at = now()
  FROM ratios r
  WHERE m.pais='MEX'
    AND (m.meta_total_acv IS NULL OR m.meta_total_acv = 0)
    AND m.meta_total_und > 0
    AND m.canal = r.canal;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('backfill_metas_acv_mex_vn_every_5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'backfill_metas_acv_mex_vn_every_5min',
  '*/5 * * * *',
  $$ SELECT public.backfill_metas_acv_mex_vn(); $$
);