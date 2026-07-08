CREATE OR REPLACE VIEW public.acv_vc_mensual AS
WITH vagg AS (
  SELECT g.nombre AS gname,
         v.mes,
         v.anio,
         SUM(COALESCE(v.acv_plus, 0::numeric))       AS acv_plus_total,
         COUNT(v.documento_factura)                  AS unidades,
         SUM(COALESCE(v.valor_producto, 0::numeric)) AS valor_total,
         SUM(COALESCE(v.meta, 0::numeric))           AS meta_total,
         SUM(CASE WHEN v.bloque_venta = 'Nomina-e'     THEN COALESCE(v.acv_plus,0::numeric) ELSE 0::numeric END) AS acv_nomina,
         SUM(CASE WHEN v.bloque_venta = 'FE'           THEN COALESCE(v.acv_plus,0::numeric) ELSE 0::numeric END) AS acv_fe,
         SUM(CASE WHEN v.bloque_venta = 'Conversiones' THEN COALESCE(v.acv_plus,0::numeric) ELSE 0::numeric END) AS acv_conversiones
  FROM public.ventas v
  JOIN public.gerentes g ON g.id = v.gerente_id
  WHERE g.canal = 'VC'
    AND v.canal = 'VC'
    AND v.documento_factura LIKE 'SUM-%'
  GROUP BY g.nombre, v.mes, v.anio
)
SELECT g.id AS gerente_id,
       g.nombre,
       va.mes,
       va.anio,
       va.acv_plus_total,
       va.unidades,
       va.valor_total,
       va.meta_total,
       va.acv_nomina,
       va.acv_fe,
       va.acv_conversiones
FROM public.gerentes g
JOIN vagg va ON va.gname = g.nombre
WHERE g.canal = 'VC';