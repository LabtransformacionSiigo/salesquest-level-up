import { supabase } from '@/integrations/supabase/client';

/**
 * Procesa el retorno del broker OAuth (Microsoft Entra ID) cuando el login se hace
 * con redirección de página completa: los tokens llegan en el hash o el query string
 * y hay que canjearlos por una sesión ANTES de montar la app, o el usuario aterriza
 * sin sesión y las rutas protegidas lo devuelven al login.
 */
export async function consumeOAuthCallback(): Promise<void> {
  if (typeof window === 'undefined') return;

  const hash = window.location.hash.startsWith('#')
    ? new URLSearchParams(window.location.hash.slice(1))
    : new URLSearchParams();
  const query = new URLSearchParams(window.location.search);

  const access_token = hash.get('access_token') || query.get('access_token');
  const refresh_token = hash.get('refresh_token') || query.get('refresh_token');

  if (!access_token || !refresh_token) return;

  try {
    await supabase.auth.setSession({ access_token, refresh_token });
  } catch {
    // si falla, la app mostrará el login normalmente
  }

  // Limpia los tokens de la URL para no dejarlos en el historial
  ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'state', 'provider_token'].forEach((k) => {
    query.delete(k);
  });
  const search = query.toString();
  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}${search ? `?${search}` : ''}`,
  );
}
