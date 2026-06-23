-- Causa 2: Extender rachas VC al 2026-12-31
UPDATE public.config_rachas
SET fecha_fin = '2026-12-31'
WHERE canal = 'VC' AND fecha_fin = '2026-05-31';

-- Causa 3: Eliminar cron huérfano que invoca función inexistente
SELECT cron.unschedule('evaluar-gamificacion-vc-daily');