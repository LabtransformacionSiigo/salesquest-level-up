-- 1. Renombrar tabla
ALTER TABLE public.advisor_segments RENAME TO participants_gamification;

-- 2. Nuevas columnas
ALTER TABLE public.participants_gamification
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'asesor'
    CHECK (role IN ('asesor', 'gerente')),
  ADD COLUMN IF NOT EXISTS gerente_id uuid,
  ADD COLUMN IF NOT EXISTS display_name text;

CREATE INDEX IF NOT EXISTS idx_participants_gamification_role ON public.participants_gamification(role);
CREATE INDEX IF NOT EXISTS idx_participants_gamification_gerente_id ON public.participants_gamification(gerente_id);

-- 3. Ampliar CHECKs de segmento para permitir 'gerente'
ALTER TABLE public.challenge_thresholds
  DROP CONSTRAINT IF EXISTS challenge_thresholds_segment_check;
ALTER TABLE public.challenge_thresholds
  ADD CONSTRAINT challenge_thresholds_segment_check
    CHECK (segment IN ('nube', 'legacy', 'gerente'));

ALTER TABLE public.streak_thresholds
  DROP CONSTRAINT IF EXISTS streak_thresholds_segment_check;
ALTER TABLE public.streak_thresholds
  ADD CONSTRAINT streak_thresholds_segment_check
    CHECK (segment IN ('nube', 'legacy', 'gerente'));