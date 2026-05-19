-- Agregar rol director al enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director';

-- Tabla directores
CREATE TABLE IF NOT EXISTS public.directores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  nombre text NOT NULL,
  email text NOT NULL UNIQUE,
  cargo text,
  canales text[] NOT NULL DEFAULT '{}',
  paises text[] NOT NULL DEFAULT '{}',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.directores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "director_read_own" ON public.directores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "auth_view_directores" ON public.directores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_manage_directores" ON public.directores
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_directores_updated_at
  BEFORE UPDATE ON public.directores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();