CREATE OR REPLACE VIEW public.comerciales_por_gerente AS
SELECT DISTINCT
  v.comercial AS nombre,
  g.id AS gerente_id,
  g.nombre AS gerente_nombre
FROM public.ventas v
JOIN public.gerentes g ON v.lider = g.nombre
WHERE v.canal = 'VC'
  AND v.anio = 2026
  AND v.comercial IS NOT NULL
  AND v.comercial != ''
ORDER BY v.comercial;