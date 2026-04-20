
-- Agregar país y operación a premios
ALTER TABLE public.premios
  ADD COLUMN IF NOT EXISTS pais text,
  ADD COLUMN IF NOT EXISTS operacion text;

-- RLS: especialistas pueden gestionar premios solo dentro de su scope
DROP POLICY IF EXISTS "Especialista manage premios in scope" ON public.premios;
CREATE POLICY "Especialista manage premios in scope"
ON public.premios
FOR ALL
USING (
  has_role(auth.uid(), 'especialista'::app_role)
  AND especialista_puede(pais, operacion)
)
WITH CHECK (
  has_role(auth.uid(), 'especialista'::app_role)
  AND especialista_puede(pais, operacion)
);
