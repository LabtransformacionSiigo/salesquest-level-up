DROP VIEW IF EXISTS ranking_vn_comerciales;

CREATE VIEW ranking_vn_comerciales AS
SELECT 
  v.comercial AS nombre,
  v.lider AS gerente_nombre,
  v.canal,
  v.pais AS pais_gerente,
  sum(COALESCE(v.acv_plus, 0)) AS acv_total,
  count(*) AS ventas_count,
  sum(COALESCE(v.sc_creados_ind, 1)) AS unidades_total,
  COALESCE(pa.cant_recomendados, 0) AS cant_recomendados,
  row_number() OVER (PARTITION BY v.canal ORDER BY sum(COALESCE(v.acv_plus, 0)) DESC) AS posicion
FROM ventas v
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(p.cant_recomendados), 0) AS cant_recomendados
  FROM productividad_asesores p
  WHERE p.asesor = v.comercial
    AND p.anio_mes = CONCAT(EXTRACT(year FROM CURRENT_DATE)::text, LPAD(EXTRACT(month FROM CURRENT_DATE)::text, 2, '0'))
) pa ON true
WHERE v.canal IN ('VN_ALIADOS', 'VN_EMPRESARIOS')
  AND v.anio = EXTRACT(year FROM CURRENT_DATE)::integer
  AND v.mes = mes_actual_nombre()
  AND v.comercial IS NOT NULL AND v.comercial <> ''
GROUP BY v.comercial, v.lider, v.canal, v.pais, pa.cant_recomendados
ORDER BY v.canal, sum(COALESCE(v.acv_plus, 0)) DESC;