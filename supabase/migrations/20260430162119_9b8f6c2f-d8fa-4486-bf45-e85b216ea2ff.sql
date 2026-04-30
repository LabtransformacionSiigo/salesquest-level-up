-- Crear tabla de segmentos de asesores para gamificación VC Colombia
CREATE TABLE public.advisor_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercial text UNIQUE NOT NULL,
  segment text NOT NULL CHECK (segment IN ('nube', 'legacy')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index para búsqueda rápida por comercial
CREATE INDEX idx_advisor_segments_comercial ON public.advisor_segments (comercial);
CREATE INDEX idx_advisor_segments_segment ON public.advisor_segments (segment);

-- Habilitar RLS
ALTER TABLE public.advisor_segments ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver los segmentos (necesario para gamificación)
CREATE POLICY "Authenticated can view advisor_segments"
ON public.advisor_segments
FOR SELECT
TO authenticated
USING (true);

-- Solo admins y especialistas pueden gestionar (insertar/actualizar/eliminar)
CREATE POLICY "Admins manage advisor_segments"
ON public.advisor_segments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Especialistas manage advisor_segments"
ON public.advisor_segments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'especialista'::app_role))
WITH CHECK (has_role(auth.uid(), 'especialista'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_advisor_segments_updated_at
BEFORE UPDATE ON public.advisor_segments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();