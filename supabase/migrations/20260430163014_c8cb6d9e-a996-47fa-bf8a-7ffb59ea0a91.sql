-- =========================================================
-- WALLET & TRANSACTIONS
-- =========================================================
CREATE TABLE public.wallet_sp_canje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercial text UNIQUE NOT NULL,
  current_balance integer NOT NULL DEFAULT 0,
  total_earned_historically integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_sp_canje_comercial ON public.wallet_sp_canje(comercial);

CREATE TABLE public.sp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercial text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earned','spent')),
  amount integer NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sp_transactions_comercial ON public.sp_transactions(comercial);
CREATE INDEX idx_sp_transactions_source ON public.sp_transactions(source_type, source_id);

-- =========================================================
-- CHALLENGES
-- =========================================================
CREATE TABLE public.gamification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  kpi_type text NOT NULL CHECK (kpi_type IN ('acv_plus','upgrades','conversiones')),
  evaluation_scope text NOT NULL CHECK (evaluation_scope IN ('amount','count','percentage')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.challenge_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.gamification_challenges(id) ON DELETE CASCADE,
  segment text NOT NULL CHECK (segment IN ('nube','legacy')),
  threshold_value numeric,
  sp_canje_reward integer NOT NULL,
  UNIQUE(challenge_id, segment)
);

CREATE TABLE public.advisor_challenge_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercial text NOT NULL,
  challenge_id uuid NOT NULL REFERENCES public.gamification_challenges(id) ON DELETE CASCADE,
  completion_date date NOT NULL,
  acv_achieved numeric,
  sp_awarded integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comercial, challenge_id, completion_date)
);
CREATE INDEX idx_acc_comercial ON public.advisor_challenge_completions(comercial);

-- =========================================================
-- STREAKS
-- =========================================================
CREATE TABLE public.gamification_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active_weekdays integer[] NOT NULL,
  evaluation_weekday integer NOT NULL,
  multiplier_reward numeric NOT NULL DEFAULT 2.0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.streak_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  streak_id uuid NOT NULL REFERENCES public.gamification_streaks(id) ON DELETE CASCADE,
  segment text NOT NULL CHECK (segment IN ('nube','legacy')),
  daily_threshold_cop numeric NOT NULL,
  UNIQUE(streak_id, segment)
);

CREATE TABLE public.streak_daily_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  streak_id uuid NOT NULL REFERENCES public.gamification_streaks(id) ON DELETE CASCADE,
  comercial text NOT NULL,
  progress_date date NOT NULL,
  weekday integer NOT NULL,
  acv_achieved numeric NOT NULL DEFAULT 0,
  threshold_required numeric NOT NULL,
  met boolean NOT NULL DEFAULT false,
  UNIQUE(streak_id, comercial, progress_date)
);
CREATE INDEX idx_sdp_comercial_date ON public.streak_daily_progress(comercial, progress_date);

-- =========================================================
-- BADGES
-- =========================================================
CREATE TABLE public.gamification_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  lucide_icon_name text,
  condition_type text NOT NULL CHECK (condition_type IN (
    'acv_mensual_acumulado',
    'upgrades_acumulados',
    'conversiones_acumuladas',
    'retos_completados',
    'racha_completada',
    'cumplimiento_120_pct'
  )),
  condition_target numeric NOT NULL,
  sp_canje_reward integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.advisor_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercial text NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.gamification_badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comercial, badge_id)
);
CREATE INDEX idx_advisor_badges_comercial ON public.advisor_badges(comercial);

-- =========================================================
-- REWARDS
-- =========================================================
CREATE TABLE public.rewards_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  sp_cost integer NOT NULL,
  stock integer NOT NULL DEFAULT -1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercial text NOT NULL,
  reward_id uuid NOT NULL REFERENCES public.rewards_catalog(id) ON DELETE RESTRICT,
  sp_spent integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','cancelled')),
  notes text,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX idx_reward_redemptions_comercial ON public.reward_redemptions(comercial);

-- =========================================================
-- updated_at triggers
-- =========================================================
CREATE TRIGGER update_wallet_sp_canje_updated_at
BEFORE UPDATE ON public.wallet_sp_canje
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ENABLE RLS
-- =========================================================
ALTER TABLE public.wallet_sp_canje ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_challenge_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_daily_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- RLS POLICIES
-- Pattern:
--   - SELECT: any authenticated user
--   - ALL (write): admin OR especialista
-- =========================================================

-- wallet_sp_canje
CREATE POLICY "Auth view wallet_sp_canje" ON public.wallet_sp_canje FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage wallet_sp_canje" ON public.wallet_sp_canje FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage wallet_sp_canje" ON public.wallet_sp_canje FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));

-- sp_transactions
CREATE POLICY "Auth view sp_transactions" ON public.sp_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage sp_transactions" ON public.sp_transactions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage sp_transactions" ON public.sp_transactions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));

-- gamification_challenges
CREATE POLICY "Auth view challenges" ON public.gamification_challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage challenges" ON public.gamification_challenges FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage challenges" ON public.gamification_challenges FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));

-- challenge_thresholds
CREATE POLICY "Auth view challenge_thresholds" ON public.challenge_thresholds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage challenge_thresholds" ON public.challenge_thresholds FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage challenge_thresholds" ON public.challenge_thresholds FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));

-- advisor_challenge_completions
CREATE POLICY "Auth view acc" ON public.advisor_challenge_completions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage acc" ON public.advisor_challenge_completions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage acc" ON public.advisor_challenge_completions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));

-- gamification_streaks
CREATE POLICY "Auth view streaks" ON public.gamification_streaks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage streaks" ON public.gamification_streaks FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage streaks" ON public.gamification_streaks FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));

-- streak_thresholds
CREATE POLICY "Auth view streak_thresholds" ON public.streak_thresholds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage streak_thresholds" ON public.streak_thresholds FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage streak_thresholds" ON public.streak_thresholds FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));

-- streak_daily_progress
CREATE POLICY "Auth view sdp" ON public.streak_daily_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage sdp" ON public.streak_daily_progress FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage sdp" ON public.streak_daily_progress FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));

-- gamification_badges
CREATE POLICY "Auth view badges" ON public.gamification_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage badges" ON public.gamification_badges FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage badges" ON public.gamification_badges FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));

-- advisor_badges
CREATE POLICY "Auth view advisor_badges" ON public.advisor_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage advisor_badges" ON public.advisor_badges FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage advisor_badges" ON public.advisor_badges FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));

-- rewards_catalog
CREATE POLICY "Auth view rewards_catalog" ON public.rewards_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage rewards_catalog" ON public.rewards_catalog FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage rewards_catalog" ON public.rewards_catalog FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));

-- reward_redemptions
CREATE POLICY "Auth view reward_redemptions" ON public.reward_redemptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage reward_redemptions" ON public.reward_redemptions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Especialista manage reward_redemptions" ON public.reward_redemptions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'especialista'::app_role)) WITH CHECK (has_role(auth.uid(),'especialista'::app_role));