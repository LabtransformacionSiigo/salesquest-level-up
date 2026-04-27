-- Fix RPC: actualizar meta_fe y meta_nube aunque el archivo ya esté en 'Cierre'.
-- Mantiene el bloqueo Cierre→Inicio sobre los demás campos.
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
  v_id UUID;
  v_action TEXT;
BEGIN
  IF p_archivo NOT IN ('Inicio','Cierre') THEN
    RETURN jsonb_build_object('success', false, 'error', 'archivo invalido');
  END IF;

  SELECT id, archivo, meta_fe, meta_nube
    INTO v_id, v_existing_archivo, v_existing_fe, v_existing_nube
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
    v_action := 'inserted';

  ELSIF v_existing_archivo = 'Cierre' THEN
    -- Aunque el archivo esté bloqueado en Cierre, permitimos rellenar
    -- meta_fe/meta_nube si están vacíos y vienen valores nuevos > 0.
    -- Esto cubre filas históricas anteriores a la introducción de las columnas.
    IF (COALESCE(v_existing_fe,0) = 0 AND COALESCE(p_meta_fe,0) > 0)
       OR (COALESCE(v_existing_nube,0) = 0 AND COALESCE(p_meta_nube,0) > 0) THEN
      UPDATE metas_acv_gerentes SET
        meta_fe   = CASE WHEN COALESCE(meta_fe,0)   = 0 THEN COALESCE(p_meta_fe,0)   ELSE meta_fe   END,
        meta_nube = CASE WHEN COALESCE(meta_nube,0) = 0 THEN COALESCE(p_meta_nube,0) ELSE meta_nube END,
        updated_at = now()
      WHERE id = v_id;
      RETURN jsonb_build_object('success', true, 'action', 'backfilled_fe_nube', 'id', v_id);
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'skipped',
      'reason', 'cierre_existente_bloquea',
      'id', v_id
    );

  ELSE
    UPDATE metas_acv_gerentes SET
      pais = p_pais,
      canal = p_canal,
      director = p_director,
      esquema = p_esquema,
      cuota = COALESCE(p_cuota,0),
      meta_total_und = COALESCE(p_meta_total_und,0),
      meta_total_acv = COALESCE(p_meta_total_acv,0),
      meta_fe = COALESCE(p_meta_fe,0),
      meta_nube = COALESCE(p_meta_nube,0),
      archivo = p_archivo,
      updated_at = now()
    WHERE id = v_id;
    v_action := CASE WHEN p_archivo = 'Cierre' THEN 'upgraded_to_cierre' ELSE 'updated_inicio' END;
  END IF;

  RETURN jsonb_build_object('success', true, 'action', v_action, 'id', v_id);
END;
$function$;