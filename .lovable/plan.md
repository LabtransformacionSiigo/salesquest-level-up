

## Diagnóstico

El error `"Unsupported provider: provider is not enabled"` ocurre porque el proveedor **Azure (Microsoft)** no está habilitado en la configuración de autenticación del backend. En Lovable Cloud, solo se soportan Google y Apple como proveedores OAuth. Azure/Microsoft **no es compatible**.

## Plan

**Quitar el botón de Microsoft SSO** del login, ya que no es posible habilitarlo en Lovable Cloud. El login quedará únicamente con el formulario de correo y contraseña, que sí funciona correctamente para los usuarios de prueba y usuarios registrados.

### Cambios:
1. **`src/components/auth/Login.tsx`**: Eliminar la función `handleMicrosoftLogin`, el separador "o", y el botón de Microsoft. Dejar solo el formulario de email/password. También eliminar el import de `supabase` que ya no se necesitará.

