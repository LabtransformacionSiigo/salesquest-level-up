
-- Revertir gamificación VN otorgada para periodos < 202605 (debió iniciar en Mayo 2026)

-- 1) Restar sp_canje a cada gerente VN según lo otorgado en periodos previos
WITH to_revert AS (
  SELECT s.gerente_id, SUM(s.sp)::int AS sp_revert
  FROM sp_acumulados s
  JOIN gerentes g ON g.id = s.gerente_id
  WHERE g.canal IN ('VN_ALIADOS','VN_EMPRESARIOS')
    AND s.fuente IN ('RETO_DIARIO','RETO_SEMANAL','RETO_MENSUAL','RACHA','MEDALLA')
    AND s.tipo_sp = 'canje'
    AND (
      s.periodo < '202605'
      OR (s.periodo ~ '^[0-9]{6}-S[0-9]+$' AND substring(s.periodo,1,6) < '202605')
      OR (s.periodo ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND substring(replace(s.periodo,'-',''),1,6) < '202605')
    )
  GROUP BY s.gerente_id
)
UPDATE gerentes g
SET sp_canje = GREATEST(COALESCE(sp_canje,0) - t.sp_revert, 0)
FROM to_revert t
WHERE g.id = t.gerente_id;

-- 2) Borrar sp_acumulados de gamificación VN para periodos < 202605
DELETE FROM sp_acumulados s
USING gerentes g
WHERE s.gerente_id = g.id
  AND g.canal IN ('VN_ALIADOS','VN_EMPRESARIOS')
  AND s.fuente IN ('RETO_DIARIO','RETO_SEMANAL','RETO_MENSUAL','RACHA','MEDALLA')
  AND (
    s.periodo < '202605'
    OR (s.periodo ~ '^[0-9]{6}-S[0-9]+$' AND substring(s.periodo,1,6) < '202605')
    OR (s.periodo ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND substring(replace(s.periodo,'-',''),1,6) < '202605')
  );

-- 3) Borrar retos_completados pre-mayo
DELETE FROM retos_completados r
USING gerentes g
WHERE r.gerente_id = g.id
  AND g.canal IN ('VN_ALIADOS','VN_EMPRESARIOS')
  AND (
    r.periodo < '202605'
    OR (r.periodo ~ '^[0-9]{6}-S[0-9]+$' AND substring(r.periodo,1,6) < '202605')
    OR (r.periodo ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND substring(replace(r.periodo,'-',''),1,6) < '202605')
  );

-- 4) Borrar progreso diario/semanal/mensual pre-mayo
DELETE FROM retos_vn_progreso_diario WHERE fecha_evaluacion < DATE '2026-05-01';
DELETE FROM retos_vn_progreso_semanal WHERE anio_mes < '202605';
DELETE FROM retos_vn_progreso_mensual WHERE anio_mes < '202605';

-- 5) Borrar medallas VN ganadas pre-mayo (y reversar su SP ya descontado arriba)
DELETE FROM medallas_vn_ganadas WHERE fecha_desbloqueo < TIMESTAMP '2026-05-01';
