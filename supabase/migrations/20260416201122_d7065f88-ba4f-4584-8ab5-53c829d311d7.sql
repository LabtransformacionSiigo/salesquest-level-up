-- Revertir el enriquecimiento incorrecto
UPDATE public.metas_asesores 
SET 
  celula = NULL,
  gerente = NULL,
  nombre_asesor = NULL
WHERE anio_mes = '202604';

-- Vaciar metas_gerentes para que se reconstruya
TRUNCATE public.metas_gerentes;

-- Eliminar el trigger problemático (lo recrearemos cuando tengamos datos correctos)
DROP TRIGGER IF EXISTS trg_enrich_metas_asesor ON public.metas_asesores;
DROP FUNCTION IF EXISTS public.enrich_metas_asesor_row();