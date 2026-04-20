
ALTER TABLE public.catalogo_medallas ADD COLUMN IF NOT EXISTS pais text DEFAULT NULL;

DROP VIEW IF EXISTS public.ranking_vn_gerentes;

CREATE VIEW public.ranking_vn_gerentes AS
WITH mes_actual AS (
  SELECT TO_CHAR(CURRENT_DATE, 'YYYYMM') AS periodo
),
ejec_celula AS (
  SELECT 
    pa.celula,
    ma.canal_direccion,
    SUM(ea.ventas_fe) AS total_fe,
    SUM(ea.ventas_nube) AS total_nube,
    SUM(ea.ventas_total) AS total_unidades,
    SUM(ea.acv_total) AS total_acv,
    SUM(ea.cant_recomendados) AS total_recomendados
  FROM ejecucion_asesores ea
  JOIN metas_asesores ma ON ma.documento_asesor = ea.documento_asesor 
    AND ma.canal_direccion = ea.canal_direccion 
    AND ma.anio_mes = (SELECT periodo FROM mes_actual)
  LEFT JOIN productividad_asesores pa ON pa.asesor = ma.nombre_asesor 
    AND pa.anio_mes = (SELECT periodo FROM mes_actual)
  WHERE ea.periodo = (SELECT periodo FROM mes_actual)
    AND (ma.novedad IS NULL OR LOWER(TRIM(ma.novedad)) IN ('', 'sin novedad'))
  GROUP BY pa.celula, ma.canal_direccion
),
meta_celula AS (
  SELECT 
    celula,
    canal_direccion,
    SUM(CASE WHEN (novedad IS NULL OR LOWER(TRIM(novedad)) IN ('', 'sin novedad')) THEN meta_fe ELSE 0 END) AS meta_fe,
    SUM(CASE WHEN (novedad IS NULL OR LOWER(TRIM(novedad)) IN ('', 'sin novedad')) THEN meta_nube ELSE 0 END) AS meta_nube,
    SUM(CASE WHEN (novedad IS NULL OR LOWER(TRIM(novedad)) IN ('', 'sin novedad')) THEN meta_total ELSE 0 END) AS meta_total
  FROM metas_asesores
  WHERE anio_mes = (SELECT periodo FROM mes_actual)
  GROUP BY celula, canal_direccion
),
meta_acv_celula AS (
  SELECT celula, canal_direccion, meta_total_acv, meta_total_und
  FROM metas_gerentes
)
SELECT
  g.id AS gerente_id,
  g.nombre,
  g.canal,
  g.pais,
  TO_CHAR(CURRENT_DATE, 'YYYYMM') AS mes_periodo,
  COALESCE(ec.total_unidades, 0)::numeric AS unidades_logradas,
  COALESCE(mc.meta_total, 0)::numeric AS meta_unidades,
  COALESCE(ec.total_fe, 0)::numeric AS ventas_fe,
  COALESCE(mc.meta_fe, 0)::numeric AS meta_fe,
  COALESCE(ec.total_nube, 0)::numeric AS ventas_nube,
  COALESCE(mc.meta_nube, 0)::numeric AS meta_nube,
  COALESCE(ec.total_acv, 0)::numeric AS acv_total,
  CASE WHEN COALESCE(mac.meta_total_acv, 0) > 0 
    THEN ROUND(ec.total_acv::numeric / mac.meta_total_acv * 100, 2) 
    ELSE 0 END AS pct_cumplimiento,
  COALESCE(ec.total_recomendados, 0)::numeric AS cant_recomendados,
  COALESCE(ec.total_unidades, 0)::numeric AS sc_creados,
  ROW_NUMBER() OVER (
    PARTITION BY g.canal, g.pais
    ORDER BY 
      CASE WHEN COALESCE(mac.meta_total_acv, 0) > 0 
        THEN ec.total_acv::numeric / mac.meta_total_acv 
        ELSE 0 END DESC,
      COALESCE(ec.total_acv, 0) DESC
  ) AS posicion
FROM gerentes g
LEFT JOIN ejec_celula ec ON ec.celula = g.celula 
  AND CASE 
    WHEN g.canal = 'VN_ALIADOS' THEN 'Aliados'
    WHEN g.canal = 'VN_EMPRESARIOS' THEN 'Empresarios'
    ELSE g.canal 
  END = ec.canal_direccion
LEFT JOIN meta_celula mc ON mc.celula = g.celula 
  AND CASE 
    WHEN g.canal = 'VN_ALIADOS' THEN 'Aliados'
    WHEN g.canal = 'VN_EMPRESARIOS' THEN 'Empresarios'
    ELSE g.canal 
  END = mc.canal_direccion
LEFT JOIN meta_acv_celula mac ON mac.celula = g.celula 
  AND CASE 
    WHEN g.canal = 'VN_ALIADOS' THEN 'Aliados'
    WHEN g.canal = 'VN_EMPRESARIOS' THEN 'Empresarios'
    ELSE g.canal 
  END = mac.canal_direccion
WHERE g.canal IN ('VN_ALIADOS', 'VN_EMPRESARIOS')
  AND g.activo = true;
