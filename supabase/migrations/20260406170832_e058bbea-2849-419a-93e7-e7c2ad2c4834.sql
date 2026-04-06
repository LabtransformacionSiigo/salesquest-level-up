DROP VIEW IF EXISTS public.sp_acumulados_comerciales;
CREATE VIEW public.sp_acumulados_comerciales WITH (security_invoker=on) AS
SELECT 
  comercial AS nombre,
  SUM(sp_mes)::integer AS sp_totales
FROM (
  SELECT 
    v.comercial,
    v.mes,
    v.anio,
    ROUND(SUM(v.acv_plus)::numeric / NULLIF(MAX(v.meta), 0) * 100) AS sp_mes
  FROM ventas v
  WHERE v.canal = 'VC' 
    AND v.comercial IS NOT NULL 
    AND v.meta > 0
  GROUP BY v.comercial, v.mes, v.anio
) sub
GROUP BY comercial;