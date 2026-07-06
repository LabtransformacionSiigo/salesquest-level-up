import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoIncentivos from "@/assets/logo-incentivos.png";

// Typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthAuthorization = {
  redirect_url?: string;
  redirect_to?: string;
  client?: { name?: string; client_uri?: string };
  scopes?: string[];
};
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthAuthorization | null; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthAuthorization | null; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthAuthorization | null; error: any }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthAuthorization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Falta el parámetro authorization_id.");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message ?? "No se pudo cargar la solicitud.");
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message ?? "Error al procesar la decisión.");
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("El servidor de autorización no devolvió una URL de redirección.");
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted p-6">
      <div className="w-full max-w-md bg-white border border-border rounded-3xl p-8 shadow-smooth-md space-y-6">
        <div className="flex items-center gap-3">
          <img src={logoIncentivos} alt="Siigo Arena" className="h-8" />
          <div>
            <h1 className="text-lg font-black font-heading text-secondary">Conectar aplicación</h1>
            <p className="text-xs text-muted-foreground">Autorización OAuth</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
            {error}
          </div>
        )}

        {!error && !details && (
          <p className="text-sm text-muted-foreground">Cargando solicitud…</p>
        )}

        {details && (
          <>
            <div className="space-y-3">
              <p className="text-sm text-secondary">
                <span className="font-bold">{details.client?.name ?? "Una aplicación externa"}</span>{" "}
                solicita acceso a tu cuenta de Siigo Arena.
              </p>
              <p className="text-xs text-muted-foreground">
                Podrá consultar tu perfil, tu historial de Siigo Points, rankings y catálogo de
                premios, actuando como tu usuario. Puedes revocar el acceso en cualquier momento.
              </p>
              {details.client?.client_uri && (
                <p className="text-xs text-muted-foreground break-all">
                  Sitio: {details.client.client_uri}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => decide(false)}
              >
                Denegar
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                {busy ? "Procesando…" : "Aprobar"}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
