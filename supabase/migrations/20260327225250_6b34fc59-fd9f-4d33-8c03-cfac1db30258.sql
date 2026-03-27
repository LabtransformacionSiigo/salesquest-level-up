
DROP VIEW IF EXISTS public.acv_vc_mensual;
CREATE VIEW public.acv_vc_mensual AS
SELECT g.id AS gerente_id,
    g.nombre,
    v.mes,
    v.anio,
    sum(COALESCE(v.acv_plus, 0::numeric)) AS acv_plus_total,
    count(v.documento_factura) AS unidades,
    sum(COALESCE(v.valor_producto, 0::numeric)) AS valor_total,
    sum(COALESCE(v.meta, 0::numeric)) AS meta_total,
    sum(
        CASE
            WHEN v.bloque_venta = 'Nomina-e' THEN COALESCE(v.acv_plus, 0::numeric)
            ELSE 0::numeric
        END) AS acv_nomina,
    sum(
        CASE
            WHEN v.bloque_venta = 'FE' THEN COALESCE(v.acv_plus, 0::numeric)
            ELSE 0::numeric
        END) AS acv_fe,
    sum(
        CASE
            WHEN v.bloque_venta = 'Conversiones' THEN COALESCE(v.acv_plus, 0::numeric)
            ELSE 0::numeric
        END) AS acv_conversiones
   FROM gerentes g
     LEFT JOIN ventas v ON g.id = v.gerente_id AND v.canal = 'VC' AND v.documento_factura LIKE 'SUM-%'
  WHERE g.canal = 'VC'
  GROUP BY g.id, g.nombre, v.mes, v.anio;
