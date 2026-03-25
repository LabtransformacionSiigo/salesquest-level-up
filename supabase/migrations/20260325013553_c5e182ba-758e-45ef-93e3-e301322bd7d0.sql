DROP VIEW IF EXISTS public.ranking_vc_comerciales;
CREATE VIEW public.ranking_vc_comerciales AS
WITH comercial_data AS (
  SELECT 
    comercial,
    lider,
    acv_plus,
    meta,
    mes,
    ROW_NUMBER() OVER (
      PARTITION BY comercial 
      ORDER BY 
        CASE WHEN acv_plus > 0 THEN 1 ELSE 0 END DESC,
        CASE mes 
          WHEN 'Diciembre' THEN 12 WHEN 'Noviembre' THEN 11 WHEN 'Octubre' THEN 10
          WHEN 'Septiembre' THEN 9 WHEN 'Agosto' THEN 8 WHEN 'Julio' THEN 7
          WHEN 'Junio' THEN 6 WHEN 'Mayo' THEN 5 WHEN 'Abril' THEN 4
          WHEN 'Marzo' THEN 3 WHEN 'Febrero' THEN 2 WHEN 'Enero' THEN 1 
          ELSE 0 
        END DESC
    ) as rn
  FROM public.ventas
  WHERE canal = 'VC' AND anio = 2026 AND meta > 0
    AND comercial IS NOT NULL AND comercial != ''
)
SELECT
  comercial AS nombre,
  lider AS gerente_nombre,
  acv_plus AS acv_total,
  meta AS meta_total,
  CASE 
    WHEN meta > 0 THEN ROUND((acv_plus::numeric / meta::numeric) * 100, 2)
    ELSE 0 
  END AS pct_cumplimiento,
  0::bigint AS ventas_count,
  ROW_NUMBER() OVER (
    ORDER BY CASE WHEN meta > 0 THEN (acv_plus::numeric / meta::numeric) ELSE 0 END DESC,
    acv_plus DESC
  ) AS posicion
FROM comercial_data
WHERE rn = 1
ORDER BY pct_cumplimiento DESC;