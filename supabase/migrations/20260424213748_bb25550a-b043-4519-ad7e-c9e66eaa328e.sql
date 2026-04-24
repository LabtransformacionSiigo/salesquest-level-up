-- Indices for frequent queries
CREATE INDEX IF NOT EXISTS idx_metas_asesores_celula_mes ON public.metas_asesores(celula, anio_mes);
CREATE INDEX IF NOT EXISTS idx_metas_asesores_canal_mes ON public.metas_asesores(canal_direccion, anio_mes);
CREATE INDEX IF NOT EXISTS idx_metas_asesores_gerente ON public.metas_asesores(gerente, anio_mes);

CREATE INDEX IF NOT EXISTS idx_productividad_celula_mes ON public.productividad_asesores(celula, anio_mes);
CREATE INDEX IF NOT EXISTS idx_productividad_pais_mes ON public.productividad_asesores(pais, anio_mes);

CREATE INDEX IF NOT EXISTS idx_ejecucion_periodo_canal ON public.ejecucion_asesores(periodo, canal_direccion);
CREATE INDEX IF NOT EXISTS idx_ejecucion_documento_periodo ON public.ejecucion_asesores(documento_asesor, periodo);

CREATE INDEX IF NOT EXISTS idx_ventas_diarias_fecha_canal ON public.ventas_diarias(fecha, canal_direccion);
CREATE INDEX IF NOT EXISTS idx_ventas_diarias_celula_fecha ON public.ventas_diarias(celula, fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_diarias_pais_canal ON public.ventas_diarias(pais, canal_direccion, fecha);

CREATE INDEX IF NOT EXISTS idx_vgm_periodo_canal ON public.ventas_gerente_mensual(periodo, canal_direccion);
CREATE INDEX IF NOT EXISTS idx_vgm_gerente_periodo ON public.ventas_gerente_mensual(gerente_normalizado, periodo);
CREATE INDEX IF NOT EXISTS idx_vgm_celula_periodo ON public.ventas_gerente_mensual(celula, periodo);

CREATE INDEX IF NOT EXISTS idx_metas_acv_celula_mes ON public.metas_acv_gerentes(celula, mes);
CREATE INDEX IF NOT EXISTS idx_metas_acv_pais_canal ON public.metas_acv_gerentes(pais, canal);

CREATE INDEX IF NOT EXISTS idx_sp_acumulados_tipo ON public.sp_acumulados(gerente_id, tipo_sp);

-- Migrate missing data from metas_gerentes to metas_acv_gerentes
INSERT INTO public.metas_acv_gerentes (
  pais, canal, director, celula,
  meta_total_acv, meta_total_und,
  mes, archivo, created_at, updated_at
)
SELECT
  COALESCE(mg.pais_gestion, 'COL') AS pais,
  CASE
    WHEN mg.canal_direccion = 'Aliados' THEN 'VN_ALIADOS'
    WHEN mg.canal_direccion = 'Empresarios' THEN 'VN_EMPRESARIOS'
    ELSE mg.canal_direccion
  END AS canal,
  mg.director,
  mg.celula,
  mg.meta_total_acv,
  mg.meta_total_und,
  TO_CHAR(CURRENT_DATE, 'YYYY-MM') AS mes,
  'Inicio' AS archivo,
  now(), now()
FROM public.metas_gerentes mg
WHERE NOT EXISTS (
  SELECT 1 FROM public.metas_acv_gerentes mac
  WHERE LOWER(TRIM(mac.celula)) = LOWER(TRIM(mg.celula))
)
  AND mg.celula IS NOT NULL
  AND mg.celula <> ''
  AND mg.meta_total_acv > 0
ON CONFLICT DO NOTHING;

UPDATE public.catalogo_retos
SET canal = 'VC'
WHERE canal IS NULL
  AND kpi IN ('acv_plus', 'upgrades', 'conversiones', 'cumplimiento_pct');

-- Update ranking_vn_gerentes view (without unaccent — manual tilde normalization)
CREATE OR REPLACE VIEW public.ranking_vn_gerentes AS
WITH current_period AS (
  SELECT
    TO_CHAR(CURRENT_DATE, 'YYYYMM') AS periodo,
    LOWER(LEFT(TO_CHAR(CURRENT_DATE, 'Mon'), 3)) AS mes_corto
),
vgm_actual AS (
  SELECT
    v.gerente_normalizado,
    v.celula,
    v.canal_direccion,
    SUM(CASE WHEN v.familia = 'FE'   THEN v.unidades ELSE 0 END) AS ventas_fe,
    SUM(CASE WHEN v.familia = 'NUBE' THEN v.unidades ELSE 0 END) AS ventas_nube,
    SUM(v.unidades) AS ventas_total,
    SUM(v.acv) AS acv_total
  FROM public.ventas_gerente_mensual v
  CROSS JOIN current_period cp
  WHERE v.periodo = cp.periodo
  GROUP BY v.gerente_normalizado, v.celula, v.canal_direccion
),
metas_acv AS (
  SELECT
    LOWER(TRIM(m.celula)) AS celula_norm,
    m.meta_total_acv,
    m.meta_total_und
  FROM public.metas_acv_gerentes m
  CROSS JOIN current_period cp
  WHERE LOWER(LEFT(m.mes, 3)) = cp.mes_corto
),
metas_und AS (
  SELECT
    LOWER(TRIM(ma.celula)) AS celula_norm,
    ma.canal_direccion,
    SUM(COALESCE(ma.meta_fe,   0)) AS meta_fe,
    SUM(COALESCE(ma.meta_nube, 0)) AS meta_nube,
    SUM(COALESCE(ma.meta_total,0)) AS meta_total
  FROM public.metas_asesores ma
  CROSS JOIN current_period cp
  WHERE ma.anio_mes = cp.periodo
    AND (ma.novedad IS NULL OR LOWER(TRIM(ma.novedad)) = 'sin novedad')
    AND ma.celula IS NOT NULL
  GROUP BY LOWER(TRIM(ma.celula)), ma.canal_direccion
)
SELECT
  g.id  AS gerente_id,
  g.nombre,
  g.canal,
  g.pais,
  (SELECT periodo FROM current_period) AS mes_periodo,
  COALESCE(vgm.ventas_total, 0)::integer AS unidades_logradas,
  COALESCE(mu.meta_total,    0)::integer AS meta_unidades,
  COALESCE(vgm.ventas_fe,    0)::integer AS ventas_fe,
  COALESCE(mu.meta_fe,       0)::integer AS meta_fe,
  COALESCE(vgm.ventas_nube,  0)::integer AS ventas_nube,
  COALESCE(mu.meta_nube,     0)::integer AS meta_nube,
  COALESCE(vgm.acv_total,    0)::numeric AS acv_total,
  CASE WHEN COALESCE(mac.meta_total_acv, 0) > 0
    THEN ROUND(COALESCE(vgm.acv_total, 0)::numeric / mac.meta_total_acv * 100, 2)
    ELSE 0
  END AS pct_cumplimiento,
  0::integer AS cant_recomendados,
  COALESCE(vgm.ventas_total, 0)::integer AS sc_creados,
  ROW_NUMBER() OVER (
    PARTITION BY g.canal, g.pais
    ORDER BY
      CASE WHEN COALESCE(mac.meta_total_acv, 0) > 0
        THEN COALESCE(vgm.acv_total, 0)::numeric / mac.meta_total_acv
        ELSE 0
      END DESC,
      COALESCE(vgm.acv_total, 0) DESC
  )::integer AS posicion
FROM public.gerentes g
LEFT JOIN vgm_actual vgm
  ON vgm.gerente_normalizado = LOWER(TRIM(REGEXP_REPLACE(
       TRANSLATE(g.nombre, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'),
       '\s+', ' ', 'g'
     )))
LEFT JOIN metas_acv mac
  ON mac.celula_norm = LOWER(TRIM(g.celula))
LEFT JOIN metas_und mu
  ON mu.celula_norm = LOWER(TRIM(g.celula))
  AND mu.canal_direccion = CASE
    WHEN g.canal = 'VN_ALIADOS'     THEN 'Aliados'
    WHEN g.canal = 'VN_EMPRESARIOS' THEN 'Empresarios'
    ELSE g.canal
  END
WHERE g.canal IN ('VN_ALIADOS', 'VN_EMPRESARIOS')
  AND g.activo = true;

COMMENT ON TABLE public.metas_gerentes IS
  'LEGACY: Reemplazada por metas_acv_gerentes. Pendiente eliminar cuando el hook useGamificationMetrics ya no la referencie.';
