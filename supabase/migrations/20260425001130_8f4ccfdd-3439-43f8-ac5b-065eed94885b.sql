-- Borrar metas ACV de gerentes con valores claramente incorrectos
-- (escala de unidades en lugar de monetario). Cualquier registro con
-- meta_total_acv < 100000 y mes en (Ene, Feb, Mar, Abr) es basura
-- importada con la lógica antigua. La nueva sync los reinsertará con
-- el valor correcto desde tbl_brz_cuotas.meta_total_acv.
DELETE FROM public.metas_acv_gerentes
WHERE meta_total_acv < 100000
  AND mes IN ('Ene','Feb','Mar','Abr','2026-04');

-- También borramos registros con periodo en formato YYYY-MM (basura legacy
-- de una importación previa que no respetaba el formato canónico de mes).
DELETE FROM public.metas_acv_gerentes
WHERE mes LIKE '____-__';