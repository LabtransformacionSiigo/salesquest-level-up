-- Recreate ranking_vn_gerentes from ejecucion_asesores (canonical FE/NUBE source)
DROP VIEW IF EXISTS public.ranking_vn_gerentes CASCADE;

CREATE OR REPLACE VIEW public.ranking_vn_gerentes AS
WITH mes_actual AS (
  SELECT TO_CHAR(CURRENT_DATE, 'YYYYMM') AS periodo
),
ejec_celula AS (
  SELECT 
    pa.celula,
    ma.canal_direccion,
    SUM(COALESCE(ea.ventas_fe, 0))::numeric AS total_fe,
    SUM(COALESCE(ea.ventas_nube, 0))::numeric AS total_nube,
    SUM(COALESCE(ea.ventas_total, 0))::numeric AS total_unidades,
    SUM(COALESCE(ea.acv_total, 0))::numeric AS total_acv,
    SUM(COALESCE(ea.cant_recomendados, 0))::numeric AS total_recomendados
  FROM ejecucion_asesores ea
  JOIN metas_asesores ma 
    ON ma.documento_asesor = ea.documento_asesor 
   AND ma.canal_direccion = ea.canal_direccion 
   AND ma.anio_mes = (SELECT periodo FROM mes_actual)
  LEFT JOIN productividad_asesores pa 
    ON pa.asesor = ma.nombre_asesor 
   AND pa.anio_mes = (SELECT periodo FROM mes_actual)
  WHERE ea.periodo = (SELECT periodo FROM mes_actual)
    AND (ma.novedad IS NULL OR LOWER(TRIM(ma.novedad)) IN ('', 'sin novedad', 'no aplica'))
  GROUP BY pa.celula, ma.canal_direccion
),
meta_celula AS (
  SELECT 
    celula,
    canal_direccion,
    SUM(COALESCE(meta_fe, 0))::numeric AS meta_fe,
    SUM(COALESCE(meta_nube, 0))::numeric AS meta_nube,
    SUM(COALESCE(meta_total, 0))::numeric AS meta_total
  FROM metas_asesores
  WHERE anio_mes = (SELECT periodo FROM mes_actual)
    AND (novedad IS NULL OR LOWER(TRIM(novedad)) IN ('', 'sin novedad', 'no aplica'))
  GROUP BY celula, canal_direccion
),
meta_acv_celula AS (
  SELECT celula, canal_direccion, 
         MAX(meta_total_acv) AS meta_total_acv, 
         MAX(meta_total_und) AS meta_total_und
  FROM metas_gerentes
  GROUP BY celula, canal_direccion
)
SELECT
  g.id AS gerente_id,
  g.nombre,
  g.canal,
  g.pais,
  TO_CHAR(CURRENT_DATE, 'YYYYMM') AS mes_periodo,
  COALESCE(ec.total_unidades, 0)::integer AS unidades_logradas,
  COALESCE(mc.meta_total, 0)::integer AS meta_unidades,
  COALESCE(ec.total_fe, 0)::integer AS ventas_fe,
  COALESCE(mc.meta_fe, 0)::integer AS meta_fe,
  COALESCE(ec.total_nube, 0)::integer AS ventas_nube,
  COALESCE(mc.meta_nube, 0)::integer AS meta_nube,
  COALESCE(ec.total_acv, 0)::numeric AS acv_total,
  CASE WHEN COALESCE(mac.meta_total_acv, 0) > 0 
    THEN ROUND(COALESCE(ec.total_acv, 0)::numeric / mac.meta_total_acv * 100, 2) 
    ELSE 0 END AS pct_cumplimiento,
  COALESCE(ec.total_recomendados, 0)::integer AS cant_recomendados,
  COALESCE(ec.total_unidades, 0)::integer AS sc_creados,
  ROW_NUMBER() OVER (
    PARTITION BY g.canal, g.pais
    ORDER BY 
      CASE WHEN COALESCE(mac.meta_total_acv, 0) > 0 
        THEN COALESCE(ec.total_acv, 0)::numeric / mac.meta_total_acv 
        ELSE 0 END DESC,
      COALESCE(ec.total_acv, 0) DESC
  )::integer AS posicion
FROM gerentes g
LEFT JOIN ejec_celula ec 
  ON ec.celula = g.celula 
 AND ec.canal_direccion = CASE 
    WHEN g.canal = 'VN_ALIADOS' THEN 'Aliados'
    WHEN g.canal = 'VN_EMPRESARIOS' THEN 'Empresarios'
    ELSE g.canal 
  END
LEFT JOIN meta_celula mc 
  ON mc.celula = g.celula 
 AND mc.canal_direccion = CASE 
    WHEN g.canal = 'VN_ALIADOS' THEN 'Aliados'
    WHEN g.canal = 'VN_EMPRESARIOS' THEN 'Empresarios'
    ELSE g.canal 
  END
LEFT JOIN meta_acv_celula mac 
  ON mac.celula = g.celula 
 AND mac.canal_direccion = CASE 
    WHEN g.canal = 'VN_ALIADOS' THEN 'Aliados'
    WHEN g.canal = 'VN_EMPRESARIOS' THEN 'Empresarios'
    ELSE g.canal 
  END
WHERE g.canal IN ('VN_ALIADOS', 'VN_EMPRESARIOS')
  AND g.activo = true;