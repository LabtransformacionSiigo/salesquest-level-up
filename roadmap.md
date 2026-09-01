# Roadmap

## Login solo con Entra ID
- [x] Quitar formulario email/contraseña del login
- [x] Quitar diálogo de cambio de contraseña
- [x] Deshabilitar proveedor email; permitir el alta automática interna que Microsoft necesita en el primer acceso
- [x] Proveedor Microsoft configurado por el usuario en Cloud Settings (BYOC Entra ID)

## Perfil desde el directorio activo (Microsoft Graph)
- [ ] Guardar credenciales de Graph: ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET (App registration con User.Read.All)
- [ ] Edge function `sync-entra-profile`: identidad básica (displayName, mail, jobTitle) + estructura (department, officeLocation/country, manager)
- [ ] Sincronizar esos campos hacia `gerentes` al iniciar sesión; BD queda solo como espejo + gamificación
