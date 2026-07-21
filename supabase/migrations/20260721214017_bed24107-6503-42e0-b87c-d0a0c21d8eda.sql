
INSERT INTO public._backfill_vn_junio (fecha, orden, done, disparado_at)
SELECT d::date::text, (SELECT COALESCE(MAX(orden),0) FROM public._backfill_vn_junio) + row_number() OVER (ORDER BY d), false, NULL
FROM generate_series('2026-07-01'::date, CURRENT_DATE, interval '1 day') AS d
WHERE NOT EXISTS (SELECT 1 FROM public._backfill_vn_junio b WHERE b.fecha::date = d::date);

UPDATE public._backfill_vn_junio SET done = false, disparado_at = NULL;

DO $$ BEGIN PERFORM cron.unschedule('backfill-vn-junio'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('backfill-vn-junio', '*/2 * * * *', $$SELECT public.procesar_backfill_vn_junio();$$);
