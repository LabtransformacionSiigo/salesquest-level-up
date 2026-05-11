-- 1) Add 'aprobador' to app_role enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'aprobador'
  ) THEN
    ALTER TYPE app_role ADD VALUE 'aprobador';
  END IF;
END$$;

-- 2) Tabla aprobador_permisos
CREATE TABLE IF NOT EXISTS public.aprobador_permisos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  nombre     TEXT,
  email      TEXT,
  paises     TEXT[] NOT NULL DEFAULT '{}',
  operaciones TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aprobador_permisos_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.aprobador_permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ap_select_own" ON public.aprobador_permisos;
CREATE POLICY "ap_select_own" ON public.aprobador_permisos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "ap_admin_all" ON public.aprobador_permisos;
CREATE POLICY "ap_admin_all" ON public.aprobador_permisos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3) Calendario VN base (idempotente por (anio_mes, pais))
INSERT INTO public.config_calendario_vn (anio_mes, pais, dias_habiles, festivos, semanas) VALUES
('2025-05','COL',19,ARRAY['2025-05-01','2025-05-19']::DATE[],
 '[{"numero":1,"fecha_inicio":"2025-05-01","fecha_fin":"2025-05-09","sp":7},{"numero":2,"fecha_inicio":"2025-05-10","fecha_fin":"2025-05-16","sp":7},{"numero":3,"fecha_inicio":"2025-05-17","fecha_fin":"2025-05-23","sp":5},{"numero":4,"fecha_inicio":"2025-05-24","fecha_fin":"2025-05-31","sp":5}]'::JSONB),
('2025-05','ECU',20,ARRAY['2025-05-01']::DATE[],
 '[{"numero":1,"fecha_inicio":"2025-05-01","fecha_fin":"2025-05-09","sp":7},{"numero":2,"fecha_inicio":"2025-05-10","fecha_fin":"2025-05-16","sp":7},{"numero":3,"fecha_inicio":"2025-05-17","fecha_fin":"2025-05-23","sp":5},{"numero":4,"fecha_inicio":"2025-05-24","fecha_fin":"2025-05-31","sp":5}]'::JSONB),
('2025-06','COL',19,ARRAY['2025-06-09','2025-06-16','2025-06-30']::DATE[],
 '[{"numero":1,"fecha_inicio":"2025-06-01","fecha_fin":"2025-06-05","sp":7},{"numero":2,"fecha_inicio":"2025-06-06","fecha_fin":"2025-06-13","sp":7},{"numero":3,"fecha_inicio":"2025-06-14","fecha_fin":"2025-06-20","sp":5},{"numero":4,"fecha_inicio":"2025-06-21","fecha_fin":"2025-06-30","sp":5}]'::JSONB),
('2025-06','ECU',22,ARRAY[]::DATE[],
 '[{"numero":1,"fecha_inicio":"2025-06-01","fecha_fin":"2025-06-05","sp":7},{"numero":2,"fecha_inicio":"2025-06-06","fecha_fin":"2025-06-13","sp":7},{"numero":3,"fecha_inicio":"2025-06-14","fecha_fin":"2025-06-20","sp":5},{"numero":4,"fecha_inicio":"2025-06-21","fecha_fin":"2025-06-30","sp":5}]'::JSONB)
ON CONFLICT DO NOTHING;