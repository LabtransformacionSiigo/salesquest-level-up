
DROP VIEW IF EXISTS public.desglose_producto_vc;
CREATE VIEW public.desglose_producto_vc AS
SELECT 
  gerente_id,
  categoria_producto_venta AS producto,
  anio,
  mes,
  SUM(COALESCE(acv_plus, 0::numeric)) AS acv_total,
  COUNT(*) AS unidades
FROM ventas v
WHERE canal = 'VC' 
  AND documento_factura NOT LIKE 'SUM-%'
  AND categoria_producto_venta IS NOT NULL 
  AND categoria_producto_venta <> ''
GROUP BY gerente_id, categoria_producto_venta, anio, mes;
