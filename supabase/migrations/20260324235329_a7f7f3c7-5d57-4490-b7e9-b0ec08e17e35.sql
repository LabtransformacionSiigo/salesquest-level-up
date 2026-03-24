DROP VIEW IF EXISTS public.ranking_vc_comerciales;
CREATE VIEW public.ranking_vc_comerciales AS
WITH ultimo_mes AS (
  SELECT mes 
  FROM public.ventas 
  WHERE canal = 'VC' AND anio = 2026 AND meta > 0 AND acv_plus > 0
  ORDER BY fecha_facturacion DESC 
  LIMIT 1
)
SELECT
  v.comercial AS nombre,
  v.lider AS gerente_nombre,
  v.acv_plus AS acv_total,
  v.meta AS meta_total,
  CASE 
    WHEN v.meta > 0 THEN ROUND((v.acv_plus::numeric / v.meta::numeric) * 100, 2)
    ELSE 0 
  END AS pct_cumplimiento,
  0::bigint AS ventas_count,
  ROW_NUMBER() OVER (
    ORDER BY CASE WHEN v.meta > 0 THEN (v.acv_plus::numeric / v.meta::numeric) ELSE 0 END DESC,
    v.acv_plus DESC
  ) AS posicion
FROM public.ventas v
INNER JOIN ultimo_mes um ON v.mes = um.mes
WHERE v.canal = 'VC'
  AND v.anio = 2026
  AND v.meta > 0
  AND v.comercial IS NOT NULL
  AND v.comercial != ''
ORDER BY pct_cumplimiento DESC;