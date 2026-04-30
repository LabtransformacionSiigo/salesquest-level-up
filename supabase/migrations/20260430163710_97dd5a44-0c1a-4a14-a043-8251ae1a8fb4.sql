-- Vincular advisor_segments con auth para identificar al asesor logueado
ALTER TABLE public.advisor_segments
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_advisor_segments_user_id ON public.advisor_segments(user_id);