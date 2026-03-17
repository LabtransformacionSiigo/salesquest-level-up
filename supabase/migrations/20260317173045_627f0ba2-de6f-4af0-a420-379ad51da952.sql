
-- Add columns for real Databricks data
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS comercial text;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS lider text;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS categoria_producto_venta text;

-- Add unique constraint to avoid duplicates on re-sync
-- Using documento_factura + producto + fecha_facturacion as natural key
CREATE UNIQUE INDEX IF NOT EXISTS ventas_factura_producto_fecha_idx 
ON public.ventas (documento_factura, producto, fecha_facturacion) 
WHERE documento_factura IS NOT NULL;
