CREATE OR REPLACE VIEW public.desglose_producto_vc AS
SELECT 
  v.gerente_id,
  COALESCE(NULLIF(v.categoria_producto_venta, ''), NULLIF(v.producto, ''), 'Sin categoría') AS producto,
  v.anio,
  v.mes,
  SUM(COALESCE(v.acv_plus, 0::numeric)) AS acv_total,
  SUM(
    CASE
      WHEN v.documento_factura LIKE 'PROD-%' THEN COALESCE(NULLIF(v.valor_producto, 0), 0)
      ELSE 1
    END
  )::bigint AS unidades
FROM public.ventas v
WHERE v.canal = 'VC'
  AND (
    v.documento_factura LIKE 'PROD-%'
    OR (
      v.documento_factura NOT LIKE 'SUM-%'
      AND v.documento_factura NOT LIKE 'PROD-%'
      AND v.categoria_producto_venta IS NOT NULL
      AND v.categoria_producto_venta <> ''
    )
  )
GROUP BY v.gerente_id, COALESCE(NULLIF(v.categoria_producto_venta, ''), NULLIF(v.producto, ''), 'Sin categoría'), v.anio, v.mes;