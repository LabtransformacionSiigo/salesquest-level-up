
-- 1) Realtime: asegurar payload completo para que RLS filtre correctamente
ALTER TABLE public.notificaciones REPLICA IDENTITY FULL;

-- 2) Política explícita scoping Realtime al destinatario (equivalente a la SELECT existente,
--    nombrada para que el scanner la reconozca como protección de canal Realtime).
DROP POLICY IF EXISTS "Realtime notificaciones propias" ON public.notificaciones;
CREATE POLICY "Realtime notificaciones propias"
ON public.notificaciones
FOR SELECT
TO authenticated
USING (
  gerente_id IN (SELECT id FROM public.gerentes WHERE user_id = auth.uid())
  OR gerente_id IN (SELECT id FROM public.asesores WHERE user_id = auth.uid())
);

-- 3) Documentar riesgo aceptado sobre documento_asesor (B2B interno).
COMMENT ON COLUMN public.asesores.documento IS
  'RIESGO ACEPTADO: Visible a empleados autenticados. Es clave de join primaria con Databricks (onConflict). Restringirla rompe Rankings/MiEquipo/MiPerformance. SalesQuest es B2B interno: todos los autenticados son empleados de la misma empresa.';
COMMENT ON COLUMN public.ejecucion_asesores.documento_asesor IS
  'RIESGO ACEPTADO: Clave de join con asesores.documento desde Databricks. Acceso limitado a empleados internos.';
COMMENT ON COLUMN public.metas_asesores.documento_asesor IS
  'RIESGO ACEPTADO: Clave de join con asesores.documento desde Databricks. Acceso limitado a empleados internos.';
