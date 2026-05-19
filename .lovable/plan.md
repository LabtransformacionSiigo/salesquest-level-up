## Plan: Rol "Director" y Panel Director

Implementación de una nueva capa jerárquica entre admin y gerentes.

### 1. Base de datos (migración)
- Crear enum value `'director'` en `app_role`
- Crear tabla `directores` (user_id, nombre, email, cargo, canales[], paises[], activo)
- RLS: director lee su propia fila; admin gestiona todo
- Insertar los 14 directores reales (inactivos, sin user_id)

### 2. Autenticación (`src/hooks/useSupabaseAuth.ts` + `SupabaseAuthContext.tsx`)
- Extender tipo `AuthUser`/`Profile` con `director_canales?`, `director_paises?`, `director_cargo?`
- Priorizar `director` antes de `gerente` al resolver el rol
- Cuando rol = director, cargar fila de `directores` por `user_id` y poblar perfil

### 3. Rutas y redirección (`src/App.tsx`)
- Nueva ruta `/panel-director` protegida (admin o director)
- Crear `DirectorRoute` wrapper
- Login redirige directores a `/panel-director`

### 4. Página `src/pages/PanelDirector.tsx`
- Header con filtros: período (mes), país, canal (limitados al scope)
- KPI cards: total gerentes, unidades vs meta, ACV total, mix Nube
- Tabla semáforo de gerentes (FE, Nube, ACV, SP, racha, estado)
- Distribución (en meta / riesgo / bajo meta) + Top 3 + Plan de choque
- Tendencia 6 meses (barras)
- Fuente VN: `vn_metricas_optimizadas` scope=gerente. VC: `ventas_diarias`/`sp_acumulados`
- VPs (paises array con ARG/CHL): scope Latam sobre su canal

### 5. Admin — asignación de directores
- Nuevo tab/sección en `src/pages/admin/AdminEspecialistasAccesos.tsx`
- Listar `directores`, asignar `user_id` por email (edge function), activar/desactivar

### 6. Sidebar (`src/components/layout/Sidebar.tsx`)
- Cuando `role === 'director'`: mostrar solo "📊 Mi Panel" y "🏆 Rankings"

### Detalles técnicos
- Edge function `link-director-user`: busca user en auth.users por email, asigna `user_id` a `directores`
- Normalización de nombres (NFD + lowercase) para matching gerente↔vn_metricas
- Si no hay metas reales, estimar: FE=2/asesor, Nube=1/asesor
- Diseño: bg-card, border-border, rounded-2xl, font-scoreboard, semáforo emojis 🟢🟡🔴
