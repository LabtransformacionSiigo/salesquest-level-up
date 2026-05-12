
-- ============================================================================
-- 1) sp_acumulados: lock down INSERT/UPDATE to admin + especialista
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated can insert sp" ON public.sp_acumulados;
DROP POLICY IF EXISTS "Authenticated can update sp" ON public.sp_acumulados;

CREATE POLICY "Admin/especialista insert sp"
  ON public.sp_acumulados FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'especialista'::app_role));

CREATE POLICY "Admin/especialista update sp"
  ON public.sp_acumulados FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'especialista'::app_role));

-- ============================================================================
-- 2) retos_completados: restrict INSERT to admin/especialista
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated can insert retos" ON public.retos_completados;

CREATE POLICY "Admin/especialista insert retos"
  ON public.retos_completados FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'especialista'::app_role));

-- ============================================================================
-- 3) medallas: restrict INSERT to admin/especialista
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated can insert medallas" ON public.medallas;

CREATE POLICY "Admin/especialista insert medallas"
  ON public.medallas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'especialista'::app_role));

-- ============================================================================
-- 4) ventas: restrict INSERT to admin (sales come from Databricks sync via service role)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated can insert ventas" ON public.ventas;

CREATE POLICY "Admin insert ventas"
  ON public.ventas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 5) wallet_sp_canje: restrict SELECT so users only see their own wallet
-- ============================================================================
DROP POLICY IF EXISTS "Auth view wallet_sp_canje" ON public.wallet_sp_canje;

CREATE POLICY "Users view own wallet_sp_canje"
  ON public.wallet_sp_canje FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'especialista'::app_role)
    OR comercial IN (SELECT pg.comercial FROM public.participants_gamification pg WHERE pg.user_id = auth.uid())
  );

-- ============================================================================
-- 6) sp_transactions: restrict SELECT so users only see their own transactions
-- ============================================================================
DROP POLICY IF EXISTS "Auth view sp_transactions" ON public.sp_transactions;

CREATE POLICY "Users view own sp_transactions"
  ON public.sp_transactions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'especialista'::app_role)
    OR comercial IN (SELECT pg.comercial FROM public.participants_gamification pg WHERE pg.user_id = auth.uid())
  );

-- ============================================================================
-- 7) reward_redemptions: restrict SELECT so users only see their own redemptions
-- ============================================================================
DROP POLICY IF EXISTS "Auth view reward_redemptions" ON public.reward_redemptions;

CREATE POLICY "Users view own reward_redemptions"
  ON public.reward_redemptions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'especialista'::app_role)
    OR comercial IN (SELECT pg.comercial FROM public.participants_gamification pg WHERE pg.user_id = auth.uid())
  );

-- ============================================================================
-- 8) Convert {public} role policies to {authenticated} on catalogs/configs
-- ============================================================================

-- catalogo_medallas
DROP POLICY IF EXISTS "Admins manage medallas" ON public.catalogo_medallas;
DROP POLICY IF EXISTS "Auth view medallas" ON public.catalogo_medallas;
DROP POLICY IF EXISTS "Especialista manage medallas in scope" ON public.catalogo_medallas;

CREATE POLICY "Admins manage medallas"
  ON public.catalogo_medallas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth view medallas"
  ON public.catalogo_medallas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Especialista manage medallas in scope"
  ON public.catalogo_medallas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'especialista'::app_role) AND especialista_puede(pais, operacion))
  WITH CHECK (has_role(auth.uid(), 'especialista'::app_role) AND especialista_puede(pais, operacion));

-- catalogo_retos
DROP POLICY IF EXISTS "Admins manage retos" ON public.catalogo_retos;
DROP POLICY IF EXISTS "Auth view retos" ON public.catalogo_retos;
DROP POLICY IF EXISTS "Especialista manage retos in scope" ON public.catalogo_retos;

CREATE POLICY "Admins manage retos"
  ON public.catalogo_retos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth view retos"
  ON public.catalogo_retos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Especialista manage retos in scope"
  ON public.catalogo_retos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'especialista'::app_role) AND especialista_puede(pais, operacion))
  WITH CHECK (has_role(auth.uid(), 'especialista'::app_role) AND especialista_puede(pais, operacion));

-- config_rachas
DROP POLICY IF EXISTS "Admins manage rachas" ON public.config_rachas;
DROP POLICY IF EXISTS "Auth view rachas" ON public.config_rachas;
DROP POLICY IF EXISTS "Especialista manage rachas in scope" ON public.config_rachas;

CREATE POLICY "Admins manage rachas"
  ON public.config_rachas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth view rachas"
  ON public.config_rachas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Especialista manage rachas in scope"
  ON public.config_rachas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'especialista'::app_role) AND especialista_puede(pais, operacion))
  WITH CHECK (has_role(auth.uid(), 'especialista'::app_role) AND especialista_puede(pais, operacion));

-- especialista_permisos
DROP POLICY IF EXISTS "Admins manage especialista_permisos" ON public.especialista_permisos;
DROP POLICY IF EXISTS "Especialista views own permisos" ON public.especialista_permisos;

CREATE POLICY "Admins manage especialista_permisos"
  ON public.especialista_permisos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Especialista views own permisos"
  ON public.especialista_permisos FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- premios
DROP POLICY IF EXISTS "Especialista manage premios in scope" ON public.premios;
CREATE POLICY "Especialista manage premios in scope"
  ON public.premios FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'especialista'::app_role) AND especialista_puede(pais, operacion))
  WITH CHECK (has_role(auth.uid(), 'especialista'::app_role) AND especialista_puede(pais, operacion));
