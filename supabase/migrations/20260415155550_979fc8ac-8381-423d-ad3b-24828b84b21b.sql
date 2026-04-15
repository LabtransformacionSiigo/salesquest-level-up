
ALTER TABLE public.metas_asesores ADD COLUMN IF NOT EXISTS gerente text;

-- Update the unique constraint to still work (gerente is nullable, won't affect uniqueness)
