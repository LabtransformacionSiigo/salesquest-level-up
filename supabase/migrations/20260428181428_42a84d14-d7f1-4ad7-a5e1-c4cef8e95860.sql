-- 1) Eliminar duplicados manteniendo la fila más reciente (por created_at, luego id)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY periodo, familia, celula
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.ventas_gerente_mensual
  WHERE celula IS NOT NULL
)
DELETE FROM public.ventas_gerente_mensual v
USING ranked r
WHERE v.id = r.id AND r.rn > 1;

-- 2) Constraint único para evitar duplicados futuros
ALTER TABLE public.ventas_gerente_mensual
  DROP CONSTRAINT IF EXISTS vgm_unique_periodo_familia_celula;

ALTER TABLE public.ventas_gerente_mensual
  ADD CONSTRAINT vgm_unique_periodo_familia_celula
  UNIQUE (periodo, familia, celula);