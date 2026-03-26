CREATE OR REPLACE VIEW public.desglose_producto_vc AS
SELECT 
  v.gerente_id,
  v.categoria_producto_venta AS producto,
  v.anio,
  SUM(COALESCE(v.acv_plus, 0)) AS acv_total,
  COUNT(*) AS unidades
FROM ventas v
WHERE v.canal = 'VC' 
  AND v.documento_factura NOT LIKE 'SUM-%'
  AND v.categoria_producto_venta IS NOT NULL
  AND v.categoria_producto_venta != ''
GROUP BY v.gerente_id, v.categoria_producto_venta, v.anio;