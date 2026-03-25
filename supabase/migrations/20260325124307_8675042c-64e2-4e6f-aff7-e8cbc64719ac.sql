CREATE OR REPLACE VIEW public.ranking_vc_gerentes AS
WITH gerente_mes AS (
  SELECT 
    gerente_id,
    mes,
    SUM(acv_plus) as acv_total,
    SUM(meta) as meta_total,
    ROW_NUMBER() OVER (
      PARTITION BY gerente_id 
      ORDER BY 
        CASE WHEN SUM(acv_plus) > 0 THEN 1 ELSE 0 END DESC,
        CASE mes 
          WHEN 'Diciembre' THEN 12 WHEN 'Noviembre' THEN 11 WHEN 'Octubre' THEN 10
          WHEN 'Septiembre' THEN 9 WHEN 'Agosto' THEN 8 WHEN 'Julio' THEN 7
          WHEN 'Junio' THEN 6 WHEN 'Mayo' THEN 5 WHEN 'Abril' THEN 4
          WHEN 'Marzo' THEN 3 WHEN 'Febrero' THEN 2 WHEN 'Enero' THEN 1 
          ELSE 0 
        END DESC
    ) as rn
  FROM public.ventas
  WHERE canal = 'VC' AND anio = 2026 AND documento_factura LIKE 'SUM-%'
    AND meta > 0
  GROUP BY gerente_id, mes
)
SELECT
  gm.gerente_id,
  g.nombre,
  g.pais,
  gm.mes,
  gm.acv_total,
  gm.meta_total,
  CASE 
    WHEN gm.meta_total > 0 THEN ROUND((gm.acv_total::numeric / gm.meta_total::numeric) * 100, 2)
    ELSE 0 
  END AS pct_cumplimiento,
  ROW_NUMBER() OVER (
    ORDER BY CASE WHEN gm.meta_total > 0 THEN (gm.acv_total::numeric / gm.meta_total::numeric) ELSE 0 END DESC,
    gm.acv_total DESC
  ) AS posicion
FROM gerente_mes gm
JOIN public.gerentes g ON g.id = gm.gerente_id
WHERE gm.rn = 1
ORDER BY pct_cumplimiento DESC;