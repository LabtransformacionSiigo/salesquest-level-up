ALTER TABLE public.ventas_diarias
ADD COLUMN IF NOT EXISTS registro_idx integer NOT NULL DEFAULT 0;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'ventas_diarias'
      AND con.contype = 'u'
      AND con.conname IN (
        'ventas_diarias_fecha_asesor_tipo_producto_canal_direccion_pro_key',
        'ventas_diarias_fecha_asesor_tipo_producto_canal_direccion_producto_key'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.ventas_diarias DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'ventas_diarias'
      AND con.conname = 'ventas_diarias_unique_registro'
  ) THEN
    ALTER TABLE public.ventas_diarias
    ADD CONSTRAINT ventas_diarias_unique_registro
    UNIQUE (fecha, asesor, tipo_producto, canal_direccion, producto, registro_idx);
  END IF;
END $$;