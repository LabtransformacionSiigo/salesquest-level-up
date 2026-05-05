DELETE FROM metas_acv_gerentes a
USING metas_acv_gerentes b
WHERE a.celula = b.celula
  AND a.mes = b.mes
  AND a.archivo = b.archivo
  AND a.pais = b.pais
  AND a.ctid > b.ctid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'metas_acv_gerentes_celula_mes_archivo_pais_key'
  ) THEN
    ALTER TABLE metas_acv_gerentes
      ADD CONSTRAINT metas_acv_gerentes_celula_mes_archivo_pais_key
      UNIQUE (celula, mes, archivo, pais);
  END IF;
END $$;