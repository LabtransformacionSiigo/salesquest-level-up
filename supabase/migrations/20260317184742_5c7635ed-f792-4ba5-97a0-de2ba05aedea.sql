
-- Drop the partial unique index
DROP INDEX IF EXISTS public.ventas_factura_producto_fecha_idx;

-- Create a proper unique constraint for upsert
ALTER TABLE public.ventas ADD CONSTRAINT ventas_factura_producto_fecha_uq UNIQUE (documento_factura, producto, fecha_facturacion);
