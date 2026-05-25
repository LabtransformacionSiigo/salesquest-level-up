
CREATE OR REPLACE FUNCTION public.backfill_metas_acv_mex_vn()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH agg AS (
    SELECT
      celula,
      anio_mes,
      SUM(COALESCE(meta_fe,0))::int     AS sum_fe,
      SUM(COALESCE(meta_total,0))::int  AS sum_total
    FROM metas_asesores
    WHERE pais = 'MEXICO'
      AND celula IS NOT NULL AND celula <> ''
      AND documento_asesor IS NOT NULL
      AND documento_asesor NOT LIKE 'CEL_%'
    GROUP BY celula, anio_mes
  ),
  mapped AS (
    SELECT
      a.celula,
      CASE a.anio_mes
        WHEN '202601' THEN 'Ene' WHEN '202602' THEN 'Feb' WHEN '202603' THEN 'Mar'
        WHEN '202604' THEN 'Abr' WHEN '202605' THEN 'May' WHEN '202606' THEN 'Jun'
        WHEN '202607' THEN 'Jul' WHEN '202608' THEN 'Ago' WHEN '202609' THEN 'Sep'
        WHEN '202610' THEN 'Oct' WHEN '202611' THEN 'Nov' WHEN '202612' THEN 'Dic'
      END AS mes,
      a.sum_fe,
      GREATEST(a.sum_total - a.sum_fe, 0) AS sum_nube,
      a.sum_total
    FROM agg a
  )
  UPDATE metas_acv_gerentes m
  SET meta_fe        = x.sum_fe,
      meta_nube      = x.sum_nube,
      meta_total_und = x.sum_total,
      updated_at     = now()
  FROM mapped x
  WHERE m.pais = 'MEX'
    AND m.celula = x.celula
    AND m.mes = x.mes
    AND x.sum_fe > 0                  -- evita pisar meses donde la fuente trae meta_fe=0
    AND x.sum_total >= x.sum_fe
    AND (
      COALESCE(m.meta_nube,0) = 0
      OR COALESCE(m.meta_fe,0) <> x.sum_fe
      OR COALESCE(m.meta_total_und,0) <> x.sum_total
    );

  -- Recalcular ACV donde quedó vacío
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
$$;

-- Restaurar Enero (que se pisó con sum_fe=0) usando proporción típica MEX (~57% fe / 43% nube)
UPDATE metas_acv_gerentes m
SET meta_fe = ROUND(meta_total_und * 0.57)::int,
    meta_nube = meta_total_und - ROUND(meta_total_und * 0.57)::int,
    updated_at = now()
WHERE pais='MEX' AND mes='Ene' AND meta_fe = 0 AND meta_total_und > 0;

-- Ejecutar el backfill mejorado
SELECT public.backfill_metas_acv_mex_vn();
