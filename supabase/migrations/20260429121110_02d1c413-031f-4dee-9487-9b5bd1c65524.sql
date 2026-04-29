-- Limpiar duplicados existentes en vn_metricas_optimizadas causados por
-- variantes del nombre del gerente en la tabla brz_cuotas_asesores
-- (ej. "Diana Naranjo" vs "Diana Maria Naranjo Mattheus"). Conservamos el id
-- mayor por (pais, mes_nro, anio, celula, asesor, tipo_producto1, scope).
DELETE FROM public.vn_metricas_optimizadas a
USING public.vn_metricas_optimizadas b
WHERE a.id < b.id
  AND a.pais            = b.pais
  AND a.mes_nro         = b.mes_nro
  AND a.anio            = b.anio
  AND COALESCE(a.celula, '')        = COALESCE(b.celula, '')
  AND COALESCE(a.asesor, '')        = COALESCE(b.asesor, '')
  AND a.tipo_producto1  = b.tipo_producto1
  AND a.scope           = b.scope;

-- Índice único para que el sync futuro no pueda introducir duplicados
-- (sirve además como soporte para upsert con onConflict).
CREATE UNIQUE INDEX IF NOT EXISTS vn_metricas_optimizadas_unique_grain
  ON public.vn_metricas_optimizadas (
    pais, anio, mes_nro, scope, tipo_producto1,
    COALESCE(celula, ''), COALESCE(asesor, '')
  );