
-- 1. Meta mensual de unidades nube por gerente
CREATE TABLE IF NOT EXISTS public.metas_nubes_mensuales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id UUID NOT NULL REFERENCES public.gerentes(id) ON DELETE CASCADE,
  anio_mes TEXT NOT NULL,
  meta_nubes INTEGER NOT NULL DEFAULT 0,
  pais TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (gerente_id, anio_mes)
);
ALTER TABLE public.metas_nubes_mensuales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mnm_select" ON public.metas_nubes_mensuales FOR SELECT TO authenticated USING (true);
CREATE POLICY "mnm_manage" ON public.metas_nubes_mensuales FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role));

-- 2. Calendario VN
CREATE TABLE IF NOT EXISTS public.config_calendario_vn (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anio_mes TEXT NOT NULL,
  pais TEXT NOT NULL,
  dias_habiles INTEGER NOT NULL DEFAULT 20,
  festivos DATE[] NOT NULL DEFAULT '{}',
  semanas JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (anio_mes, pais)
);
ALTER TABLE public.config_calendario_vn ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ccv_select" ON public.config_calendario_vn FOR SELECT TO authenticated USING (true);
CREATE POLICY "ccv_manage" ON public.config_calendario_vn FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role));

INSERT INTO public.config_calendario_vn (anio_mes, pais, dias_habiles, festivos, semanas) VALUES
('2025-05','COL',19, ARRAY['2025-05-01','2025-05-19']::DATE[],
 '[{"numero":1,"fecha_inicio":"2025-05-01","fecha_fin":"2025-05-09","sp":7},{"numero":2,"fecha_inicio":"2025-05-10","fecha_fin":"2025-05-16","sp":7},{"numero":3,"fecha_inicio":"2025-05-17","fecha_fin":"2025-05-23","sp":5},{"numero":4,"fecha_inicio":"2025-05-24","fecha_fin":"2025-05-31","sp":5}]'::JSONB),
('2025-05','ECU',20, ARRAY['2025-05-01']::DATE[],
 '[{"numero":1,"fecha_inicio":"2025-05-01","fecha_fin":"2025-05-09","sp":7},{"numero":2,"fecha_inicio":"2025-05-10","fecha_fin":"2025-05-16","sp":7},{"numero":3,"fecha_inicio":"2025-05-17","fecha_fin":"2025-05-23","sp":5},{"numero":4,"fecha_inicio":"2025-05-24","fecha_fin":"2025-05-31","sp":5}]'::JSONB),
('2025-06','COL',19, ARRAY['2025-06-09','2025-06-16','2025-06-30']::DATE[],
 '[{"numero":1,"fecha_inicio":"2025-06-01","fecha_fin":"2025-06-05","sp":7},{"numero":2,"fecha_inicio":"2025-06-06","fecha_fin":"2025-06-13","sp":7},{"numero":3,"fecha_inicio":"2025-06-14","fecha_fin":"2025-06-20","sp":5},{"numero":4,"fecha_inicio":"2025-06-21","fecha_fin":"2025-06-30","sp":5}]'::JSONB),
('2025-06','ECU',22, ARRAY[]::DATE[],
 '[{"numero":1,"fecha_inicio":"2025-06-01","fecha_fin":"2025-06-05","sp":7},{"numero":2,"fecha_inicio":"2025-06-06","fecha_fin":"2025-06-13","sp":7},{"numero":3,"fecha_inicio":"2025-06-14","fecha_fin":"2025-06-20","sp":5},{"numero":4,"fecha_inicio":"2025-06-21","fecha_fin":"2025-06-30","sp":5}]'::JSONB)
ON CONFLICT (anio_mes, pais) DO NOTHING;

-- 3. Retos VN config
CREATE TABLE IF NOT EXISTS public.retos_vn_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('DIARIO','SEMANAL','MENSUAL')),
  kpi TEXT NOT NULL CHECK (kpi IN ('NUBES','ACV')),
  canal TEXT[] NOT NULL DEFAULT '{}',
  paises TEXT[] NOT NULL DEFAULT '{}',
  sp_base INTEGER NOT NULL DEFAULT 2,
  sp_semanal_sem1 INTEGER NOT NULL DEFAULT 7,
  sp_semanal_sem2 INTEGER NOT NULL DEFAULT 7,
  sp_semanal_sem3 INTEGER NOT NULL DEFAULT 5,
  sp_semanal_sem4 INTEGER NOT NULL DEFAULT 5,
  acumular_finde_al_viernes BOOLEAN NOT NULL DEFAULT TRUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  creado_por UUID REFERENCES public.gerentes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.retos_vn_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rvc_select" ON public.retos_vn_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "rvc_manage" ON public.retos_vn_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role));

-- 4. Progreso diario
CREATE TABLE IF NOT EXISTS public.retos_vn_progreso_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reto_id UUID NOT NULL REFERENCES public.retos_vn_config(id) ON DELETE CASCADE,
  gerente_id UUID NOT NULL REFERENCES public.gerentes(id) ON DELETE CASCADE,
  fecha_evaluacion DATE NOT NULL,
  nubes_vendidas INTEGER NOT NULL DEFAULT 0,
  meta_diaria_nubes NUMERIC NOT NULL DEFAULT 0,
  cumple BOOLEAN NOT NULL DEFAULT FALSE,
  sp_otorgados INTEGER NOT NULL DEFAULT 0,
  sp_con_racha INTEGER NOT NULL DEFAULT 0,
  evaluado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (reto_id, gerente_id, fecha_evaluacion)
);
ALTER TABLE public.retos_vn_progreso_diario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rvpd_select" ON public.retos_vn_progreso_diario FOR SELECT TO authenticated USING (true);
CREATE POLICY "rvpd_manage" ON public.retos_vn_progreso_diario FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role));

-- 5. Progreso semanal
CREATE TABLE IF NOT EXISTS public.retos_vn_progreso_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reto_id UUID NOT NULL REFERENCES public.retos_vn_config(id) ON DELETE CASCADE,
  gerente_id UUID NOT NULL REFERENCES public.gerentes(id) ON DELETE CASCADE,
  anio_mes TEXT NOT NULL,
  semana_numero INTEGER NOT NULL CHECK (semana_numero BETWEEN 1 AND 4),
  fecha_inicio_semana DATE NOT NULL,
  fecha_fin_semana DATE NOT NULL,
  acv_real NUMERIC NOT NULL DEFAULT 0,
  meta_semanal_acv NUMERIC NOT NULL DEFAULT 0,
  pct_cumplimiento NUMERIC NOT NULL DEFAULT 0,
  cumple BOOLEAN NOT NULL DEFAULT FALSE,
  sp_otorgados INTEGER NOT NULL DEFAULT 0,
  sp_con_racha INTEGER NOT NULL DEFAULT 0,
  evaluado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (reto_id, gerente_id, anio_mes, semana_numero)
);
ALTER TABLE public.retos_vn_progreso_semanal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rvps_select" ON public.retos_vn_progreso_semanal FOR SELECT TO authenticated USING (true);
CREATE POLICY "rvps_manage" ON public.retos_vn_progreso_semanal FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role));

-- 6. Progreso mensual
CREATE TABLE IF NOT EXISTS public.retos_vn_progreso_mensual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reto_id UUID NOT NULL REFERENCES public.retos_vn_config(id) ON DELETE CASCADE,
  gerente_id UUID NOT NULL REFERENCES public.gerentes(id) ON DELETE CASCADE,
  anio_mes TEXT NOT NULL,
  acv_real NUMERIC NOT NULL DEFAULT 0,
  meta_mensual_acv NUMERIC NOT NULL DEFAULT 0,
  pct_cumplimiento NUMERIC NOT NULL DEFAULT 0,
  cumple BOOLEAN NOT NULL DEFAULT FALSE,
  sp_otorgados INTEGER NOT NULL DEFAULT 0,
  evaluado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (reto_id, gerente_id, anio_mes)
);
ALTER TABLE public.retos_vn_progreso_mensual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rvpm_select" ON public.retos_vn_progreso_mensual FOR SELECT TO authenticated USING (true);
CREATE POLICY "rvpm_manage" ON public.retos_vn_progreso_mensual FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role));

-- 7. Rachas config
CREATE TABLE IF NOT EXISTS public.rachas_vn_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('DIARIA','SEMANAL')),
  dias_consecutivos_requeridos INTEGER NOT NULL DEFAULT 3,
  multiplicador NUMERIC NOT NULL DEFAULT 1.5,
  reto_ref_id UUID REFERENCES public.retos_vn_config(id),
  canal TEXT[] NOT NULL DEFAULT '{}',
  paises TEXT[] NOT NULL DEFAULT '{}',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  creado_por UUID REFERENCES public.gerentes(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.rachas_vn_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rvc2_select" ON public.rachas_vn_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "rvc2_manage" ON public.rachas_vn_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role));

-- 8. Rachas estado
CREATE TABLE IF NOT EXISTS public.rachas_vn_estado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  racha_id UUID NOT NULL REFERENCES public.rachas_vn_config(id) ON DELETE CASCADE,
  gerente_id UUID NOT NULL REFERENCES public.gerentes(id) ON DELETE CASCADE,
  dias_o_semanas_consecutivas INTEGER NOT NULL DEFAULT 0,
  racha_activa BOOLEAN NOT NULL DEFAULT FALSE,
  ultima_fecha_cumplida DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (racha_id, gerente_id)
);
ALTER TABLE public.rachas_vn_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rve_select" ON public.rachas_vn_estado FOR SELECT TO authenticated USING (true);
CREATE POLICY "rve_manage" ON public.rachas_vn_estado FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role));

-- 9. Medallas config
CREATE TABLE IF NOT EXISTS public.medallas_vn_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  emoji TEXT NOT NULL DEFAULT '🏅',
  lucide_icon TEXT NOT NULL DEFAULT 'Award',
  condicion_tipo TEXT NOT NULL CHECK (condicion_tipo IN (
    'racha_diaria_activada','racha_semanal_activada',
    'reto_diario_completado_n','reto_semanal_completado_n',
    'reto_mensual_completado','cumplimiento_100_pct_mes'
  )),
  condicion_valor INTEGER NOT NULL DEFAULT 1,
  sp_reward INTEGER NOT NULL DEFAULT 5,
  canal TEXT[] NOT NULL DEFAULT '{}',
  paises TEXT[] NOT NULL DEFAULT '{}',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_inicio DATE,
  fecha_fin DATE,
  creado_por UUID REFERENCES public.gerentes(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.medallas_vn_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mvc_select" ON public.medallas_vn_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "mvc_manage" ON public.medallas_vn_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role));

-- 10. Medallas ganadas
CREATE TABLE IF NOT EXISTS public.medallas_vn_ganadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medalla_id UUID NOT NULL REFERENCES public.medallas_vn_config(id) ON DELETE CASCADE,
  gerente_id UUID NOT NULL REFERENCES public.gerentes(id) ON DELETE CASCADE,
  fecha_desbloqueo TIMESTAMPTZ DEFAULT NOW(),
  sp_otorgados INTEGER NOT NULL DEFAULT 0,
  UNIQUE (medalla_id, gerente_id)
);
ALTER TABLE public.medallas_vn_ganadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mvg_select" ON public.medallas_vn_ganadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "mvg_manage" ON public.medallas_vn_ganadas FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'especialista'::app_role));

-- 11. Función auxiliar
CREATE OR REPLACE FUNCTION public.increment_gerente_sp_canje(p_gerente_id UUID, p_delta INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.gerentes SET sp_canje = COALESCE(sp_canje,0) + p_delta WHERE id = p_gerente_id;
END;
$$;
