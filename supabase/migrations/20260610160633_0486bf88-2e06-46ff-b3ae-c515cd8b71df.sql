REVOKE SELECT (documento) ON public.asesores FROM authenticated, anon;
GRANT SELECT (documento) ON public.asesores TO service_role;