
-- notificaciones: remove open INSERT policy, restrict to admin/especialista (triggers run as SECURITY DEFINER and bypass RLS)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notificaciones;
CREATE POLICY "Admin/especialista insert notifications"
ON public.notificaciones
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'especialista'::app_role));

-- rachas: remove open INSERT policy, restrict to admin/especialista
DROP POLICY IF EXISTS "Authenticated can upsert rachas" ON public.rachas;
CREATE POLICY "Admin/especialista insert rachas"
ON public.rachas
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'especialista'::app_role));

-- kpis_mensuales: remove open INSERT policy, restrict to admin/especialista
DROP POLICY IF EXISTS "Authenticated can upsert kpis" ON public.kpis_mensuales;
CREATE POLICY "Admin/especialista insert kpis"
ON public.kpis_mensuales
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'especialista'::app_role));
