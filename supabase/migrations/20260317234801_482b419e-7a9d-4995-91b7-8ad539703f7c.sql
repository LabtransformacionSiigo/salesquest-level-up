CREATE OR REPLACE VIEW public.ranking_vc_comerciales AS
SELECT
  comercial AS nombre,
  lider AS gerente_nombre,
  SUM(acv_plus) AS acv_total,
  COUNT(*) AS ventas_count,
  ROW_NUMBER() OVER (ORDER BY SUM(acv_plus) DESC) AS posicion
FROM public.ventas
WHERE canal = 'VC'
  AND anio = 2026
  AND comercial IS NOT NULL
  AND comercial != ''
GROUP BY comercial, lider
ORDER BY acv_total DESC;