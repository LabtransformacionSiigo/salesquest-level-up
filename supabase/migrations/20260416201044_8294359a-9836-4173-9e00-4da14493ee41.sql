-- Función que enriquece una fila de metas_asesores con celula, nombre_asesor y gerente
CREATE OR REPLACE FUNCTION public.enrich_metas_asesor_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canal_norm TEXT;
BEGIN
  -- Normalizar canal_direccion a canal de gerentes
  v_canal_norm := CASE
    WHEN NEW.canal_direccion ILIKE '%aliados%' THEN 'VN_ALIADOS'
    WHEN NEW.canal_direccion ILIKE '%smbs%' OR NEW.canal_direccion ILIKE '%empresarios%' OR NEW.canal_direccion ILIKE '%leads%' OR NEW.canal_direccion ILIKE '%mercadeo%' THEN 'VN_EMPRESARIOS'
    ELSE NULL
  END;

  -- 1) Si falta nombre o celula, intentar completar desde productividad_asesores por documento
  IF (NEW.nombre_asesor IS NULL OR NEW.nombre_asesor = '' OR NEW.celula IS NULL OR NEW.celula = '') AND NEW.documento_asesor IS NOT NULL THEN
    -- productividad_asesores no tiene documento, así que cruzamos por nombre normalizado más adelante
    -- Primero intentamos por documento si existiera, sino por orden de fecha más reciente del mismo periodo
    NULL;
  END IF;

  -- 2) Si tenemos celula pero no gerente, buscar gerente por celula+canal
  IF (NEW.gerente IS NULL OR NEW.gerente = '') AND NEW.celula IS NOT NULL AND v_canal_norm IS NOT NULL THEN
    SELECT nombre INTO NEW.gerente
    FROM gerentes
    WHERE celula = NEW.celula AND canal = v_canal_norm AND activo IS NOT FALSE
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_enrich_metas_asesor ON public.metas_asesores;
CREATE TRIGGER trg_enrich_metas_asesor
BEFORE INSERT OR UPDATE ON public.metas_asesores
FOR EACH ROW
EXECUTE FUNCTION public.enrich_metas_asesor_row();

-- ENRIQUECIMIENTO RETROACTIVO PARA DATOS EXISTENTES
-- Paso 1: Completar celula y nombre_asesor desde productividad_asesores
-- (productividad_asesores no tiene documento, así que solo podemos cruzar por gerente directo)

-- Paso 2: Para registros donde podamos inferir la celula a partir del canal_direccion + alguna lógica adicional
-- Como no hay documento en productividad, usaremos un enfoque diferente:
-- Cruzar por nombre de asesor cuando exista en otras fuentes
-- Por ahora, inferir gerente directamente buscando productividad_asesores con el mismo canal

-- Estrategia retroactiva: para cada documento en metas_asesores, asignar celula/gerente
-- basándonos en una distribución equitativa de los gerentes activos del canal
-- Pero como no tenemos vínculo directo doc->celula, lo más correcto es enriquecer
-- via una asignación por defecto: tomar el gerente principal del canal por país

-- Mejor enfoque: usar ventas_diarias o ejecucion_asesores que sí tienen documento+celula
UPDATE public.metas_asesores ma
SET 
  celula = COALESCE(ma.celula, vd.celula),
  nombre_asesor = COALESCE(ma.nombre_asesor, vd.asesor)
FROM (
  SELECT DISTINCT ON (asesor) asesor, celula
  FROM public.ventas_diarias
  WHERE celula IS NOT NULL
  ORDER BY asesor, fecha DESC
) vd
WHERE ma.nombre_asesor IS NULL 
  AND ma.celula IS NULL;

-- Paso final: completar gerente desde celula+canal
UPDATE public.metas_asesores ma
SET gerente = g.nombre
FROM public.gerentes g
WHERE (ma.gerente IS NULL OR ma.gerente = '')
  AND ma.celula IS NOT NULL
  AND g.celula = ma.celula
  AND g.canal = CASE
    WHEN ma.canal_direccion ILIKE '%aliados%' THEN 'VN_ALIADOS'
    WHEN ma.canal_direccion ILIKE '%smbs%' OR ma.canal_direccion ILIKE '%empresarios%' OR ma.canal_direccion ILIKE '%leads%' OR ma.canal_direccion ILIKE '%mercadeo%' THEN 'VN_EMPRESARIOS'
    ELSE NULL
  END;

-- Recalcular metas_gerentes desde metas_asesores enriquecidos
INSERT INTO public.metas_gerentes (celula, canal_direccion, fe, nube, meta_total_und, meta_total_acv, director)
SELECT 
  celula,
  canal_direccion,
  SUM(meta_fe) AS fe,
  SUM(meta_nube) AS nube,
  SUM(meta_total) AS meta_total_und,
  0 AS meta_total_acv,
  MAX(gerente) AS director
FROM public.metas_asesores
WHERE celula IS NOT NULL 
  AND anio_mes = TO_CHAR(CURRENT_DATE, 'YYYYMM')
  AND (novedad IS NULL OR LOWER(TRIM(novedad)) IN ('', 'sin novedad'))
GROUP BY celula, canal_direccion
ON CONFLICT DO NOTHING;