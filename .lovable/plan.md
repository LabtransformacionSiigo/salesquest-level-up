

## Plan: Separación de Puntos (Ranking vs Canjeables) y Sistema de Premios

### Resumen

Separar el sistema de puntos en dos bolsas independientes: **puntos de ranking** (basados en cumplimiento de meta, intocables) y **puntos canjeables** (ganados por medallas, retos, rachas, reconocimientos — gastables en premios). Crear un catálogo de premios con sistema de canje y administración.

---

### 1. Cambios en Base de Datos (Migración)

**Nueva columna en `gerentes`:**
- `puntos_canjeables` (integer, default 0) — saldo actual de puntos canjeables

**Nueva columna en `asesores`:**
- `puntos_canjeables` (integer, default 0)

**Nueva tabla `premios`:**
- `id` (uuid, PK), `nombre` (text), `descripcion` (text), `costo_puntos` (int), `imagen_url` (text), `stock` (int), `activo` (boolean, default true), `created_at` (timestamp)
- RLS: SELECT para authenticated, ALL para admins

**Nueva tabla `canjes`:**
- `id` (uuid, PK), `gerente_id` (uuid, FK → gerentes), `premio_id` (uuid, FK → premios), `puntos_gastados` (int), `fecha_canje` (timestamp), `estado` (text, default 'pendiente' — valores: pendiente, entregado, cancelado)
- RLS: SELECT propios registros, INSERT propio gerente_id, admins ALL

**Nueva función `canjear_premio`** (SECURITY DEFINER):
- Valida stock > 0 y puntos_canjeables >= costo
- Resta puntos_canjeables del gerente/asesor
- Resta stock del premio
- Inserta registro en canjes
- Retorna éxito o error

**Backfill**: Calcular `puntos_canjeables` iniciales sumando SP de fuentes MEDALLA, RETO, RECONOCIMIENTO, RACHA desde `sp_acumulados` (menos canjes ya hechos, si los hubiera).

---

### 2. Lógica de Gamificación (Backend)

**`calcular-sp-semanal` edge function:**
- Los SP por CUMPLIMIENTO_META siguen igual → solo ranking
- Al otorgar medallas (`otorgar_medalla_si_aplica`), además de insertar en `sp_acumulados`, sumar los SP a `puntos_canjeables` del gerente
- Modificar la función DB `otorgar_medalla_si_aplica` para que también haga `UPDATE gerentes SET puntos_canjeables = puntos_canjeables + p_sp`

**Triggers de nivel (`notify_nivel_cambio`):** Se mantienen basados en `sp_acumulados` total (ranking + canjeables acumulados históricamente).

**Retos completados** (`Retos.tsx`): Al completar un reto, además del insert en `sp_acumulados`, sumar SP a `puntos_canjeables`.

**Reconocimientos** (`Reconocimientos.tsx`): Al enviar reconocimiento, sumar `sp_para` a `puntos_canjeables` del destinatario.

---

### 3. Cambios en Auth/Profile Hook

**`useSupabaseAuth.ts`:**
- Añadir `puntos_canjeables` al tipo `AuthUser`
- Para gerentes: leer desde `gerentes.puntos_canjeables`
- Para asesores: leer desde `asesores.puntos_canjeables`
- Exponer en el profile para uso en UI

---

### 4. Interfaz de Usuario

**Sidebar (`Sidebar.tsx`):**
- Añadir ítem "Premios" (icon: `redeem`) en menú regular
- Añadir ítem "Premios" (icon: `storefront`) en menú admin

**Header (`Header.tsx`):**
- Mostrar dos badges: SP ranking y puntos canjeables con iconos distintos

**Dashboard (`Dashboard.tsx`):**
- Mostrar ambos saldos en el banner/resumen

**Nueva página `Premios.tsx`:**
- Catálogo con tarjetas: imagen, nombre, descripción, costo, botón "Canjear"
- Validación de saldo suficiente antes de canjear
- Historial de canjes del usuario
- Animación de confirmación al canjear

**Nueva página `AdminPremios.tsx`:**
- CRUD de premios (nombre, descripción, costo, imagen URL, stock)
- Lista de canjes pendientes con opción de marcar como "entregado"
- Protegida con `AdminRoute`

**Rankings (`Rankings.tsx`):**
- Sin cambios — sigue ordenando por SP totales de cumplimiento (ya usa `sp_totales` de la vista `ranking_general`)

**Rutas (`App.tsx`):**
- Añadir `/premios` → `<Premios />`
- Añadir `/admin/premios` → `<AdminRoute><AdminPremios /></AdminRoute>`

---

### 5. Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| Migración SQL | Crear tablas `premios`, `canjes`, columnas `puntos_canjeables`, función `canjear_premio`, backfill |
| `src/pages/Premios.tsx` | Crear |
| `src/pages/admin/AdminPremios.tsx` | Crear |
| `src/App.tsx` | Añadir rutas |
| `src/components/layout/Sidebar.tsx` | Añadir ítems de menú |
| `src/components/layout/Header.tsx` | Mostrar ambos saldos |
| `src/hooks/useSupabaseAuth.ts` | Añadir `puntos_canjeables` al profile |
| `src/pages/Retos.tsx` | Al completar reto, actualizar `puntos_canjeables` |
| `src/pages/Reconocimientos.tsx` | Al enviar reconocimiento, actualizar `puntos_canjeables` |
| `supabase/functions/calcular-sp-semanal/index.ts` | No cambios directos (medallas ya usan la función DB) |
| Función DB `otorgar_medalla_si_aplica` | Añadir UPDATE a `puntos_canjeables` |

