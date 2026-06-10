
-- Remove bypass: clients should not be able to write to canjes directly.
-- All redemptions must go through public.canjear_premio (SECURITY DEFINER) which enforces SP balance & stock.
DROP POLICY IF EXISTS "Users can insert own canjes" ON public.canjes;

-- Scope director self-read policy explicitly to authenticated role (was {public}).
DROP POLICY IF EXISTS "director_read_own" ON public.directores;
CREATE POLICY "director_read_own" ON public.directores
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
