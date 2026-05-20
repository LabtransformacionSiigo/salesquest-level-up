CREATE OR REPLACE FUNCTION public.upsert_meta_acv_gerente(
  p_pais text, p_canal text, p_director text, p_celula text, p_esquema text,
  p_cuota numeric, p_meta_total_und integer, p_meta_total_acv numeric,
  p_mes text, p_archivo text,
  p_meta_fe integer DEFAULT 0, p_meta_nube integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_archivo TEXT;
  v_existing_fe INT;
  v_existing_nube INT;
  v_existing_und INT;
  v_existing_acv NUMERIC;
  v_id UUID;
  v_action TEXT;
BEGIN
  IF p_archivo NOT IN ('Inicio','Cierre') THEN
    RETURN jsonb_build_object('success', false, 'error', 'archivo invalido');
  END IF;

  SELECT id, archivo, meta_fe, meta_nube, meta_total_und, meta_total_acv
    INTO v_id, v_existing_archivo, v_existing_fe, v_existing_nube, v_existing_und, v_existing_acv
  FROM metas_acv_gerentes
  WHERE mes = p_mes AND celula = p_celula
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO metas_acv_gerentes (
      pais, canal, director, celula, esquema, cuota,
      meta_total_und, meta_total_acv, meta_fe, meta_nube, mes, archivo
    ) VALUES (
      p_pais, p_canal, p_director, p_celula, p_esquema, COALESCE(p_cuota,0),
      COALESCE(p_meta_total_und,0), COALESCE(p_meta_total_acv,0),
      COALESCE(p_meta_fe,0), COALESCE(p_meta_nube,0),
      p_mes, p_archivo
    ) RETURNING id INTO v_id;
    RETURN jsonb_build_object('success', true, 'action', 'inserted', 'id', v_id);
  END IF;

  -- Existe fila previa. Nunca permitimos que un valor 0 entrante pise un valor previo > 0.
  UPDATE metas_acv_gerentes SET
    pais            = p_pais,
    canal           = p_canal,
    director        = COALESCE(NULLIF(p_director,''), director),
    esquema         = COALESCE(NULLIF(p_esquema,''), esquema),
    cuota           = CASE WHEN COALESCE(p_cuota,0)         > 0 THEN p_cuota         ELSE cuota END,
    meta_total_und  = CASE WHEN COALESCE(p_meta_total_und,0) > 0 THEN p_meta_total_und ELSE meta_total_und END,
    meta_total_acv  = CASE WHEN COALESCE(p_meta_total_acv,0) > 0 THEN p_meta_total_acv ELSE meta_total_acv END,
    meta_fe         = CASE WHEN COALESCE(p_meta_fe,0)       > 0 THEN p_meta_fe       ELSE meta_fe END,
    meta_nube       = CASE WHEN COALESCE(p_meta_nube,0)     > 0 THEN p_meta_nube     ELSE meta_nube END,
    archivo         = CASE WHEN p_archivo = 'Cierre' THEN 'Cierre' ELSE archivo END,
    updated_at      = now()
  WHERE id = v_id;

  v_action := CASE
    WHEN v_existing_archivo <> 'Cierre' AND p_archivo = 'Cierre' THEN 'upgraded_to_cierre'
    WHEN v_existing_archivo = 'Cierre' THEN 'backfilled_cierre'
    ELSE 'updated_inicio'
  END;

  RETURN jsonb_build_object('success', true, 'action', v_action, 'id', v_id);
END;
$function$;

-- Quitamos la versión vieja sin meta_fe/meta_nube para que no se llame por accidente.
DROP FUNCTION IF EXISTS public.upsert_meta_acv_gerente(text, text, text, text, text, numeric, integer, numeric, text, text);
