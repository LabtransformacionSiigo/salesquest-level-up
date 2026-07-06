CREATE OR REPLACE VIEW acv_vc_mensual AS
SELECT 
  g.id AS gerente_id,
  g.nombre,
  v.mes,
  v.anio,
  SUM(COALESCE(v.acv_plus, 0::numeric)) AS acv_plus_total,
  COUNT(v.documento_factura) AS unidades,
  SUM(COALESCE(v.valor_producto, 0::numeric)) AS valor_total,
  SUM(COALESCE(v.meta, 0::numeric)) AS meta_total,
  SUM(CASE WHEN v.bloque_venta = 'Nomina-e' THEN COALESCE(v.acv_plus, 0::numeric) ELSE 0::numeric END) AS acv_nomina,
  SUM(CASE WHEN v.bloque_venta = 'FE' THEN COALESCE(v.acv_plus, 0::numeric) ELSE 0::numeric END) AS acv_fe,
  SUM(CASE WHEN v.bloque_venta = 'Conversiones' THEN COALESCE(v.acv_plus, 0::numeric) ELSE 0::numeric END) AS acv_conversiones
FROM gerentes g
LEFT JOIN ventas v ON v.canal = 'VC'
  AND v.documento_factura LIKE 'SUM-%'
  AND v.gerente_id IN (
    SELECT g2.id FROM gerentes g2
    WHERE g2.nombre = g.nombre AND g2.canal = 'VC'
  )
WHERE g.canal = 'VC'
GROUP BY g.id, g.nombre, v.mes, v.anio;