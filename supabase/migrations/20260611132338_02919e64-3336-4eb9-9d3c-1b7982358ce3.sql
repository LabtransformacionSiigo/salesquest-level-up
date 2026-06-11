
-- Force all redemptions through canjear_premio RPC (SECURITY DEFINER bypasses these grants).
REVOKE INSERT, UPDATE, DELETE ON public.canjes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.canjes FROM anon;

-- Restrictive policy as defense-in-depth in case a future GRANT is re-added.
DROP POLICY IF EXISTS "Block direct writes on canjes" ON public.canjes;
CREATE POLICY "Block direct writes on canjes"
  ON public.canjes
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Keep existing SELECT policies intact; service_role keeps full access.
GRANT SELECT ON public.canjes TO authenticated;
GRANT ALL ON public.canjes TO service_role;
