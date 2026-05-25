
ALTER TABLE public.retos_vn_config DROP CONSTRAINT IF EXISTS retos_vn_config_kpi_check;
ALTER TABLE public.retos_vn_config ADD CONSTRAINT retos_vn_config_kpi_check
  CHECK (kpi = ANY (ARRAY[
    'NUBES','ACV',
    'UNIDADES_70_79','UNIDADES_80_89','UNIDADES_90',
    'ACV_SEM_GTE_100K','ACV_SEM_87K_100K','ACV_SEM_62K_87K',
    'ACV_MES_80'
  ]));
