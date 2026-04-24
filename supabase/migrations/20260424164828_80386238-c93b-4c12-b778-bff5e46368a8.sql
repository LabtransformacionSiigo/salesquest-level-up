-- Helper genérico para timestamps (no existía)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.metas_acv_gerentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pais TEXT NOT NULL,
  canal TEXT NOT NULL,
  director TEXT,
  celula TEXT NOT NULL,
  esquema TEXT,
  cuota NUMERIC DEFAULT 0,
  meta_total_und INTEGER DEFAULT 0,
  meta_total_acv NUMERIC DEFAULT 0,
  mes TEXT NOT NULL,
  archivo TEXT NOT NULL CHECK (archivo IN ('Inicio','Cierre')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX metas_acv_gerentes_mes_celula_uidx
  ON public.metas_acv_gerentes (mes, celula);

CREATE INDEX metas_acv_gerentes_pais_canal_idx
  ON public.metas_acv_gerentes (pais, canal);

ALTER TABLE public.metas_acv_gerentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage metas_acv_gerentes"
ON public.metas_acv_gerentes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view metas_acv_gerentes"
ON public.metas_acv_gerentes
FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER trg_metas_acv_gerentes_updated_at
BEFORE UPDATE ON public.metas_acv_gerentes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.upsert_meta_acv_gerente(
  p_pais TEXT,
  p_canal TEXT,
  p_director TEXT,
  p_celula TEXT,
  p_esquema TEXT,
  p_cuota NUMERIC,
  p_meta_total_und INTEGER,
  p_meta_total_acv NUMERIC,
  p_mes TEXT,
  p_archivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_archivo TEXT;
  v_id UUID;
  v_action TEXT;
BEGIN
  IF p_archivo NOT IN ('Inicio','Cierre') THEN
    RETURN jsonb_build_object('success', false, 'error', 'archivo invalido');
  END IF;

  SELECT id, archivo INTO v_id, v_existing_archivo
  FROM metas_acv_gerentes
  WHERE mes = p_mes AND celula = p_celula
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO metas_acv_gerentes (
      pais, canal, director, celula, esquema, cuota,
      meta_total_und, meta_total_acv, mes, archivo
    ) VALUES (
      p_pais, p_canal, p_director, p_celula, p_esquema, COALESCE(p_cuota,0),
      COALESCE(p_meta_total_und,0), COALESCE(p_meta_total_acv,0), p_mes, p_archivo
    ) RETURNING id INTO v_id;
    v_action := 'inserted';

  ELSIF v_existing_archivo = 'Cierre' THEN
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
      archivo = p_archivo,
      updated_at = now()
    WHERE id = v_id;
    v_action := CASE WHEN p_archivo = 'Cierre' THEN 'upgraded_to_cierre' ELSE 'updated_inicio' END;
  END IF;

  RETURN jsonb_build_object('success', true, 'action', v_action, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_cierre_lock_metas_acv()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.archivo = 'Cierre' AND NEW.archivo = 'Inicio' THEN
    RAISE EXCEPTION 'No se puede degradar una meta de Cierre a Inicio (mes=%, celula=%)', OLD.mes, OLD.celula;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_cierre_lock_metas_acv
BEFORE UPDATE ON public.metas_acv_gerentes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cierre_lock_metas_acv();