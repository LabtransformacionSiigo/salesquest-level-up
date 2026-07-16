CREATE OR REPLACE FUNCTION public.backfill_metas_acv_mex_vn()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  WITH agg AS (
    SELECT celula, anio_mes,
      SUM(COALESCE(meta_fe,0))::int   AS sum_fe,
      SUM(COALESCE(meta_nube,0))::int AS sum_nube
    FROM metas_asesores
    WHERE pais = 'MEXICO'
      AND celula IS NOT NULL AND celula <> ''
      AND documento_asesor IS NOT NULL
      AND documento_asesor NOT LIKE 'CEL_%'
      AND LOWER(TRIM(COALESCE(aplica_cuota_lider,''))) IN ('si','sí')
    GROUP BY celula, anio_mes
  ),
  mapped AS (
    SELECT a.celula,
      CASE a.anio_mes
        WHEN '202601' THEN 'Ene' WHEN '202602' THEN 'Feb' WHEN '202603' THEN 'Mar'
        WHEN '202604' THEN 'Abr' WHEN '202605' THEN 'May' WHEN '202606' THEN 'Jun'
        WHEN '202607' THEN 'Jul' WHEN '202608' THEN 'Ago' WHEN '202609' THEN 'Sep'
        WHEN '202610' THEN 'Oct' WHEN '202611' THEN 'Nov' WHEN '202612' THEN 'Dic'
      END AS mes,
      a.sum_fe, a.sum_nube
    FROM agg a
  )
  UPDATE metas_acv_gerentes m
  SET meta_fe        = CASE WHEN x.sum_fe   > 0 THEN x.sum_fe   ELSE m.meta_fe   END,
      meta_nube      = CASE WHEN x.sum_nube > 0 THEN x.sum_nube ELSE m.meta_nube END,
      meta_total_und = (CASE WHEN x.sum_fe > 0 THEN x.sum_fe ELSE m.meta_fe END)
                     + (CASE WHEN x.sum_nube > 0 THEN x.sum_nube ELSE COALESCE(m.meta_nube,0) END),
      updated_at     = now()
  FROM mapped x
  WHERE m.pais = 'MEX'
    AND m.canal = 'VN_ALIADOS'
    AND m.celula = x.celula
    AND m.mes = x.mes
    AND x.sum_fe > 0;

  WITH ratios AS (
    SELECT canal,
           SUM(meta_total_acv)::numeric / NULLIF(SUM(meta_total_und),0) AS acv_per_und
    FROM metas_acv_gerentes
    WHERE pais='MEX' AND archivo='Cierre'
      AND meta_total_acv > 0 AND meta_total_und > 0
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
$function$;