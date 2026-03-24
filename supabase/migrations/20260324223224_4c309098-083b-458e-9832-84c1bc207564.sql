
-- Add meta column
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS meta NUMERIC DEFAULT 0;

-- Clean duplicate sp_acumulados
DELETE FROM public.sp_acumulados
WHERE id NOT IN (
  SELECT DISTINCT ON (gerente_id, fuente, periodo) id
  FROM public.sp_acumulados
  ORDER BY gerente_id, fuente, periodo, created_at DESC
);

-- Create unique index for upsert
CREATE UNIQUE INDEX IF NOT EXISTS sp_acumulados_gerente_fuente_periodo_uq 
ON public.sp_acumulados (gerente_id, fuente, periodo);

-- Drop and recreate ranking view with new column order
DROP VIEW IF EXISTS public.ranking_vc_comerciales;
CREATE VIEW public.ranking_vc_comerciales AS
SELECT
  comercial AS nombre,
  lider AS gerente_nombre,
  SUM(acv_plus) AS acv_total,
  COUNT(*) AS ventas_count,
  CASE 
    WHEN AVG(meta) > 0 THEN ROUND((SUM(acv_plus) / AVG(meta)) * 100, 2)
    ELSE 0 
  END AS pct_cumplimiento,
  ROW_NUMBER() OVER (
    ORDER BY CASE WHEN AVG(meta) > 0 THEN (SUM(acv_plus) / AVG(meta)) * 100 ELSE 0 END DESC
  ) AS posicion
FROM public.ventas
WHERE canal = 'VC'
  AND anio = 2026
  AND comercial IS NOT NULL
  AND comercial != ''
GROUP BY comercial, lider
ORDER BY pct_cumplimiento DESC;
