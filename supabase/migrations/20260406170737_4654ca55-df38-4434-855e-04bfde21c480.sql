CREATE OR REPLACE VIEW public.sp_acumulados_comerciales WITH (security_invoker=on) AS
SELECT 
  v.comercial AS nombre,
  SUM(ROUND(SUM(v.acv_plus)::numeric / NULLIF(MAX(v.meta), 0) * 100)) OVER (PARTITION BY v.comercial) AS sp_totales,
  v.comercial AS id
FROM ventas v
WHERE v.canal = 'VC' 
  AND v.comercial IS NOT NULL 
  AND v.meta > 0
GROUP BY v.comercial, v.mes, v.anio;
