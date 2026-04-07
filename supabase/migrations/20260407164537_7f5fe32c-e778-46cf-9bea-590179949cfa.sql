
DROP POLICY IF EXISTS "Users can view own canjes" ON public.canjes;
DROP POLICY IF EXISTS "Users can insert own canjes" ON public.canjes;

CREATE POLICY "Users can view own canjes"
  ON public.canjes FOR SELECT
  TO authenticated
  USING (
    gerente_id IN (SELECT g.id FROM gerentes g WHERE g.user_id = auth.uid())
    OR gerente_id IN (SELECT a.id FROM asesores a WHERE a.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can insert own canjes"
  ON public.canjes FOR INSERT
  TO authenticated
  WITH CHECK (
    gerente_id IN (SELECT g.id FROM gerentes g WHERE g.user_id = auth.uid())
    OR gerente_id IN (SELECT a.id FROM asesores a WHERE a.user_id = auth.uid())
  );
