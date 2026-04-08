
CREATE POLICY "Authenticated can update sp"
  ON public.sp_acumulados FOR UPDATE
  TO authenticated USING (true);
