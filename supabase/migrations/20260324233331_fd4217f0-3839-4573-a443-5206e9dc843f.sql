DROP VIEW IF EXISTS public.ranking_vc_comerciales;
CREATE VIEW public.ranking_vc_comerciales AS
WITH cumplimiento AS (
  SELECT comercial, lider, 
    SUM(acv_plus) AS acv_meta_rows,
    SUM(meta) AS meta_total,
    CASE WHEN SUM(meta) > 0 THEN ROUND((SUM(acv_plus) / SUM(meta)) * 100, 2) ELSE 0 END AS pct_cumplimiento
  FROM public.ventas
  WHERE canal = 'VC' AND anio = 2026 AND meta > 0
    AND comercial IS NOT NULL AND comercial != ''
  GROUP BY comercial, lider
),
totales AS (
  SELECT comercial, lider,
    SUM(acv_plus) AS acv_total,
    COUNT(*) AS ventas_count
  FROM public.ventas
  WHERE canal = 'VC' AND anio = 2026
    AND comercial IS NOT NULL AND comercial != ''
  GROUP BY comercial, lider
)
SELECT
  t.comercial AS nombre,
  t.lider AS gerente_nombre,
  t.acv_total,
  t.ventas_count,
  COALESCE(c.pct_cumplimiento, 0) AS pct_cumplimiento,
  ROW_NUMBER() OVER (ORDER BY COALESCE(c.pct_cumplimiento, 0) DESC) AS posicion
FROM totales t
LEFT JOIN cumplimiento c ON t.comercial = c.comercial AND t.lider = c.lider
ORDER BY pct_cumplimiento DESC;