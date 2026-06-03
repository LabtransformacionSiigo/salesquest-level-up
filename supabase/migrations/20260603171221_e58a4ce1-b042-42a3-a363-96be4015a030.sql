
-- 1) Directores: quitar SELECT abierto, dejar self + admin + especialista
DROP POLICY IF EXISTS "auth_view_directores" ON public.directores;

CREATE POLICY "directores_admin_especialista_select"
ON public.directores
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'especialista'::app_role)
);

-- (la política director_read_own ya existe y se conserva)

-- 2) Canjes: añadir SELECT para especialistas
CREATE POLICY "Especialistas can view canjes"
ON public.canjes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'especialista'::app_role));

-- 3) Realtime.messages: restringir broadcast/presence a topics propios.
-- Los suscriptores de postgres_changes usados por la app no dependen de estas políticas.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON realtime.messages', pol.policyname);
  END LOOP;
END$$;

-- Permitir SELECT a topics que incluyan el uid del usuario o sean explícitamente públicos
CREATE POLICY "rt_messages_select_scoped"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'public:%')
  OR (realtime.topic() LIKE '%' || auth.uid()::text || '%')
);

CREATE POLICY "rt_messages_insert_scoped"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() LIKE 'public:%')
  OR (realtime.topic() LIKE '%' || auth.uid()::text || '%')
);
