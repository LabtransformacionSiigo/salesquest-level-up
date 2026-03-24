DROP VIEW IF EXISTS public.ranking_vc_comerciales;
CREATE VIEW public.ranking_vc_comerciales AS
SELECT
  comercial AS nombre,
  lider AS gerente_nombre,
  SUM(acv_plus) AS acv_total,
  COUNT(*) AS ventas_count,
  CASE 
    WHEN SUM(meta) > 0 THEN ROUND((SUM(acv_plus) / SUM(meta)) * 100, 2)
    ELSE 0 
  END AS pct_cumplimiento,
  ROW_NUMBER() OVER (
    ORDER BY CASE WHEN SUM(meta) > 0 THEN (SUM(acv_plus) / SUM(meta)) * 100 ELSE 0 END DESC
  ) AS posicion
FROM public.ventas
WHERE canal = 'VC'
  AND anio = 2026
  AND comercial IS NOT NULL
  AND comercial != ''
GROUP BY comercial, lider
ORDER BY pct_cumplimiento DESC;