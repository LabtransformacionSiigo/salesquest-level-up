

## Aclaración importante

El SSO que configuraste (`oidc.b-a202f9d7` con URL `https://lovable.dev/sso-login/...`) es un SSO **de la plataforma Lovable** — sirve para que los miembros de tu equipo accedan al editor de Lovable, no para autenticar usuarios dentro de tu aplicación SalesQuest.

Son dos sistemas de autenticación completamente separados:

```text
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   SSO de Lovable (OIDC)     │     │   Auth de SalesQuest        │
│   Para acceder al editor    │     │   Para tus usuarios/ventas  │
│   lovable.dev/sso-login/... │     │   salesquest-level-up.app   │
└─────────────────────────────┘     └─────────────────────────────┘
```

## Opciones para autenticación en SalesQuest

Para el login de tu aplicación SalesQuest, los proveedores OAuth disponibles en Lovable Cloud son:

1. **Google SSO** — Los usuarios inician sesión con su cuenta de Google/Google Workspace. Ideal si tu empresa usa Google Workspace.
2. **Apple SSO** — Inicio de sesión con Apple ID.
3. **Email/contraseña** — Lo que ya tienes funcionando actualmente.

**OIDC genérico y Microsoft/Azure NO están soportados** como proveedores de autenticación para tu app en Lovable Cloud.

## Plan propuesto

Si quieres agregar **Google SSO** como opción de inicio de sesión en SalesQuest (además del email/contraseña actual):

1. Configurar Google como proveedor social usando la herramienta de autenticación del backend.
2. Agregar un botón "Continuar con Google" en `src/components/auth/Login.tsx` usando `lovable.auth.signInWithOAuth("google")`.
3. Mantener el formulario de email/contraseña como alternativa.

Si solo necesitas email/contraseña, no se requiere ningún cambio — ya está funcionando.

