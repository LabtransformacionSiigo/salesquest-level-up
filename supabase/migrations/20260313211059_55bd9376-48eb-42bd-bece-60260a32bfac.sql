
-- MEJORA 7: Índices de rendimiento, columna moneda, vista racha_activa actualizada

-- 1. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_ventas_gerente_fecha ON ventas(gerente_id, fecha_facturacion);
CREATE INDEX IF NOT EXISTS idx_sp_acumulados_gerente ON sp_acumulados(gerente_id);
CREATE INDEX IF NOT EXISTS idx_rachas_gerente_semana ON rachas(gerente_id, anio, semana_iso);

-- 2. Columna moneda en kpis_mensuales
ALTER TABLE kpis_mensuales ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'COP';

-- 3. Recrear vista racha_activa con umbral_verde del canal
DROP VIEW IF EXISTS racha_activa;
CREATE OR REPLACE VIEW racha_activa AS
SELECT
  r.gerente_id,
  r.semana_iso,
  r.anio,
  r.estado,
  r.semanas_consecutivas,
  r.multiplicador,
  CASE
    WHEN r.semanas_consecutivas >= 12 THEN 'Leyenda de Fuego'
    WHEN r.semanas_consecutivas >= 8  THEN 'Inferno'
    WHEN r.semanas_consecutivas >= 6  THEN 'Llamarada'
    WHEN r.semanas_consecutivas >= 4  THEN 'Encendido'
    WHEN r.semanas_consecutivas >= 2  THEN 'Chispa'
    ELSE NULL
  END AS nombre_racha,
  cr.umbral_verde
FROM rachas r
JOIN gerentes g ON g.id = r.gerente_id
LEFT JOIN config_rachas cr ON cr.canal = g.canal AND cr.condicion_tipo = 'ventas_semanales' AND cr.activo = true
WHERE r.semana_iso = (SELECT MAX(r2.semana_iso) FROM rachas r2 WHERE r2.gerente_id = r.gerente_id AND r2.anio = r.anio)
  AND r.anio = EXTRACT(YEAR FROM CURRENT_DATE)::int;
