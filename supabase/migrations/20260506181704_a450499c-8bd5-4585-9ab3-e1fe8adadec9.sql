-- Backfill retos_completados desde sp_acumulados ya otorgados
INSERT INTO retos_completados (gerente_id, reto, periodo, sp, tipo)
SELECT 
  s.gerente_id,
  split_part(s.detalle, ' · ', 1) AS reto,
  s.periodo,
  s.sp,
  CASE s.fuente
    WHEN 'RETO_DIARIO' THEN 'DIARIO'
    WHEN 'RETO_SEMANAL' THEN 'SEMANAL'
    WHEN 'RETO_MENSUAL' THEN 'MENSUAL'
  END AS tipo
FROM sp_acumulados s
WHERE s.fuente IN ('RETO_DIARIO','RETO_SEMANAL','RETO_MENSUAL')
  AND s.detalle IS NOT NULL
  AND NOT s.detalle LIKE 'RACHA%'
ON CONFLICT (gerente_id, reto, periodo) DO NOTHING;