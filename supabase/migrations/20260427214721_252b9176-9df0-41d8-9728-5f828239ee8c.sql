ALTER TABLE public.gerentes DROP CONSTRAINT IF EXISTS gerentes_pais_check;
ALTER TABLE public.gerentes ADD CONSTRAINT gerentes_pais_check CHECK (pais = ANY (ARRAY['COL'::text, 'MEX'::text, 'ECU'::text, 'URU'::text]));

ALTER TABLE public.asesores DROP CONSTRAINT IF EXISTS asesores_pais_check;
ALTER TABLE public.asesores ADD CONSTRAINT asesores_pais_check CHECK (pais IS NULL OR pais = ANY (ARRAY['COL'::text, 'MEX'::text, 'ECU'::text, 'URU'::text]));