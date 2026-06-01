-- Restringir configs de rangos a solo MEX
UPDATE public.retos_vn_config SET paises = ARRAY['MEX']
WHERE kpi IN ('UNIDADES_70_79','UNIDADES_80_89','UNIDADES_90','ACV_SEM_GTE_100K','ACV_SEM_87K_100K','ACV_SEM_62K_87K','ACV_MES_80');

-- Limpieza idempotente
DELETE FROM public.retos_vn_config WHERE nombre IN (
  'El Golazo del Día (Nubes)',
  'La Jugada de la Semana (ACV ≥100%)',
  'La Bota de Oro (ACV mes ≥100%)'
);

-- COL/ECU: Diario nubes (2 SP), Semanal ACV escalado 7/7/5/5, Mensual ACV 100% (7 SP)
INSERT INTO public.retos_vn_config (nombre, tipo, kpi, canal, paises, sp_base, sp_semanal_sem1, sp_semanal_sem2, sp_semanal_sem3, sp_semanal_sem4, fecha_inicio, fecha_fin, activo, acumular_finde_al_viernes)
VALUES
  ('El Golazo del Día (Nubes)', 'DIARIO', 'NUBES',
   ARRAY['VN_ALIADOS','VN_EMPRESARIOS'], ARRAY['COL','ECU'],
   2, 0, 0, 0, 0, '2026-01-01', '2026-12-31', true, true),
  ('La Jugada de la Semana (ACV ≥100%)', 'SEMANAL', 'ACV',
   ARRAY['VN_ALIADOS','VN_EMPRESARIOS'], ARRAY['COL','ECU'],
   0, 7, 7, 5, 5, '2026-01-01', '2026-12-31', true, true),
  ('La Bota de Oro (ACV mes ≥100%)', 'MENSUAL', 'ACV',
   ARRAY['VN_ALIADOS','VN_EMPRESARIOS'], ARRAY['COL','ECU'],
   7, 0, 0, 0, 0, '2026-01-01', '2026-12-31', true, true);