-- LIMPIEZA
DELETE FROM public.medallas;
DELETE FROM public.retos_completados;
DELETE FROM public.rachas;
DELETE FROM public.sp_acumulados;
DELETE FROM public.catalogo_medallas;
DELETE FROM public.config_rachas;
UPDATE public.gerentes SET sp_canje = 0, sp_convencion = 0;
UPDATE public.asesores SET sp_canje = 0, sp_convencion = 0;

-- TABLA PERMISOS
CREATE TABLE IF NOT EXISTS public.especialista_permisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nombre text NOT NULL,
  email text NOT NULL,
  paises text[] NOT NULL DEFAULT '{}',
  operaciones text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.especialista_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage especialista_permisos" ON public.especialista_permisos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Especialista views own permisos" ON public.especialista_permisos
  FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.especialista_puede(_pais text, _operacion text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.especialista_permisos
    WHERE user_id = auth.uid()
      AND (_pais IS NULL OR _pais = ANY(paises))
      AND (_operacion IS NULL OR _operacion = ANY(operaciones))
  )
$$;

-- EXTENDER catalogo_medallas
ALTER TABLE public.catalogo_medallas
  ADD COLUMN IF NOT EXISTS tipo_evento text,
  ADD COLUMN IF NOT EXISTS objetivo_descripcion text,
  ADD COLUMN IF NOT EXISTS operacion text;
ALTER TABLE public.catalogo_medallas ALTER COLUMN activo SET DEFAULT false;

DROP POLICY IF EXISTS "Authenticated can view catalogo" ON public.catalogo_medallas;
DROP POLICY IF EXISTS "Admins can manage catalogo" ON public.catalogo_medallas;
CREATE POLICY "Auth view medallas" ON public.catalogo_medallas FOR SELECT USING (true);
CREATE POLICY "Admins manage medallas" ON public.catalogo_medallas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Especialista manage medallas in scope" ON public.catalogo_medallas FOR ALL
  USING (public.has_role(auth.uid(), 'especialista') AND public.especialista_puede(pais, operacion))
  WITH CHECK (public.has_role(auth.uid(), 'especialista') AND public.especialista_puede(pais, operacion));

-- EXTENDER config_rachas
ALTER TABLE public.config_rachas
  ADD COLUMN IF NOT EXISTS objetivo_descripcion text,
  ADD COLUMN IF NOT EXISTS multiplicador_sp numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS dias_requeridos integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS pais text,
  ADD COLUMN IF NOT EXISTS operacion text;
ALTER TABLE public.config_rachas ALTER COLUMN activo SET DEFAULT false;

DROP POLICY IF EXISTS "Authenticated can view config_rachas" ON public.config_rachas;
DROP POLICY IF EXISTS "Admins can manage config_rachas" ON public.config_rachas;
CREATE POLICY "Auth view rachas" ON public.config_rachas FOR SELECT USING (true);
CREATE POLICY "Admins manage rachas" ON public.config_rachas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Especialista manage rachas in scope" ON public.config_rachas FOR ALL
  USING (public.has_role(auth.uid(), 'especialista') AND public.especialista_puede(pais, operacion))
  WITH CHECK (public.has_role(auth.uid(), 'especialista') AND public.especialista_puede(pais, operacion));

-- NUEVA TABLA catalogo_retos
CREATE TABLE IF NOT EXISTS public.catalogo_retos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  objetivo_descripcion text,
  ventana_tiempo text NOT NULL CHECK (ventana_tiempo IN ('DIARIO','SEMANAL','MENSUAL')),
  tipo_metrica text NOT NULL,
  familia text,
  umbral numeric NOT NULL DEFAULT 0,
  sp_otorgados integer NOT NULL DEFAULT 0,
  emoji text DEFAULT '🎯',
  pais text,
  operacion text,
  activo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalogo_retos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view retos" ON public.catalogo_retos FOR SELECT USING (true);
CREATE POLICY "Admins manage retos" ON public.catalogo_retos FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Especialista manage retos in scope" ON public.catalogo_retos FOR ALL
  USING (public.has_role(auth.uid(), 'especialista') AND public.especialista_puede(pais, operacion))
  WITH CHECK (public.has_role(auth.uid(), 'especialista') AND public.especialista_puede(pais, operacion));

-- SEED INACTIVO
INSERT INTO public.catalogo_retos (nombre, objetivo_descripcion, ventana_tiempo, tipo_metrica, familia, umbral, sp_otorgados, emoji, activo) VALUES
  ('Sin irme en 0', 'Logra al menos 5 ventas en el día', 'DIARIO', 'UNIDADES', NULL, 5, 2, '🎯', false),
  ('Semana Redonda', 'Logra $20''000.000 en ACV en ventas de productos Nube', 'SEMANAL', 'ACV', 'NUBE', 20000000, 7, '☁️', false),
  ('Conquista Legendaria', 'Logra cumplir tu meta de ACV en más del 120%', 'MENSUAL', 'CUMPLIMIENTO_META_ACV_PLUS', NULL, 120, 15, '👑', false);

INSERT INTO public.config_rachas (canal, nombre, objetivo_descripcion, condicion_tipo, umbral_verde, multiplicador_sp, dias_requeridos, activo) VALUES
  ('VC', 'Racha de ventas', 'Lograr al menos 1 venta por día durante 1 semana', 'VENTA_DIARIA_CONSECUTIVA', 1, 1.5, 7, false);

INSERT INTO public.catalogo_medallas (canal, nombre, descripcion, objetivo_descripcion, condicion_tipo, tipo_evento, cantidad_requerida, sp, emoji, activo) VALUES
  ('VC', 'Primer Paso', 'Registra tu primera venta en la plataforma', 'Registra tu primera venta en la plataforma', 'primera_venta', 'PRIMERA_VENTA', 1, 2, '👣', false),
  ('VC', 'El Camino de Reconocer', 'Envía tu primer reconocimiento', 'Envía tu primer reconocimiento a un miembro de tu equipo', 'evento', 'PRIMER_RECONOCIMIENTO', 1, 2, '🤝', false),
  ('VC', 'El Velocista', 'Llega al 100% de tu meta antes del día 20', 'Llega al 100% de tu meta de ventas en unidades antes del día 20 del mes en curso', 'evento', 'CUMPLIMIENTO_TEMPRANO_UNIDADES', 100, 15, '⚡', false);