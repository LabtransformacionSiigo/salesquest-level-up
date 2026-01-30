

# Plan: Plataforma de Gamificación Comercial MVP

## ✅ Estado de Implementación

| Fase | Estado |
|------|--------|
| 1. Base de Datos | ✅ Completado |
| 2. Módulo de Parametrización | ✅ Completado |
| 3. Catálogo de Medallas | ✅ Completado |
| 4. Sistema de Puntos y Logros | ✅ Completado |
| 5. Rankings de Gamificación | ✅ Completado |
| 6. Mejoras en Carga de Datos | ✅ Completado |
| 7. Navegación y UX | ✅ Completado |
| 8. Preparación para SSO | 🔄 Pendiente (documentación) |

---

## Resumen Ejecutivo

Transformar la aplicación actual en una plataforma de gamificación comercial enfocada en:
- Reducir la rotación
- Aumentar el engagement  
- Mejorar la productividad
- Fomentar reconocimiento y competencia sana

---

## Estado Actual vs Requerido

| Funcionalidad | Estado Actual | Acción Requerida |
|--------------|---------------|------------------|
| Autenticación con roles | ✅ Implementado | Mantener |
| Gestión de Usuarios | ✅ Implementado | Campo nickname y selector células agregados |
| Gestión de Células | ✅ Implementado | Página Cells.tsx creada |
| Catálogo de Medallas | ✅ Implementado | Migrado a Supabase |
| Sistema de Puntos | ✅ Implementado | Edge function evaluate-medals creada |
| Rankings | ✅ Implementado | Página Rankings.tsx con Top 3 |
| Carga de Excel | ✅ Implementado | Integrado con evaluador de medallas |

---

## Fase 1: Base de Datos y Estructura

### 1.1 Modificaciones al Schema de Perfiles

Agregar campo `nickname` (apodo) a la tabla `profiles`:

```sql
ALTER TABLE profiles ADD COLUMN nickname TEXT;
```

### 1.2 Relación Gerentes-Células (Muchos a Muchos)

Crear tabla para asignar múltiples células a múltiples gerentes:

```sql
CREATE TABLE manager_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cell_id UUID NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(manager_id, cell_id)
);
```

### 1.3 Extender Tabla de Medallas

La tabla `medals` ya existe con estructura adecuada. Agregar campo `active` para desactivar:

```sql
ALTER TABLE medals ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
```

### 1.4 Crear Vista para Rankings

```sql
CREATE VIEW ranking_view AS
SELECT 
  p.id,
  p.name,
  p.nickname,
  p.avatar,
  p.xp,
  p.cell_id,
  p.country,
  p.segment,
  p.manager_id,
  c.name as cell_name,
  ur.role,
  RANK() OVER (ORDER BY p.xp DESC) as global_rank,
  RANK() OVER (PARTITION BY p.cell_id ORDER BY p.xp DESC) as cell_rank,
  RANK() OVER (PARTITION BY p.country ORDER BY p.xp DESC) as country_rank,
  RANK() OVER (PARTITION BY p.segment ORDER BY p.xp DESC) as segment_rank
FROM profiles p
LEFT JOIN cells c ON p.cell_id = c.id
LEFT JOIN user_roles ur ON p.id = ur.user_id
WHERE ur.role = 'EJECUTIVO';
```

---

## Fase 2: Módulo de Parametrización (Admin)

### 2.1 Página de Gestión de Gerentes

Modificar `src/pages/Users.tsx` para incluir:
- Campo de apodo (nickname)
- Selector de células múltiples
- Visualización de "Segmento por país" (combinación automática)

### 2.2 Nueva Página: Gestión de Células

Crear `src/pages/Cells.tsx` con:
- Lista de células existentes
- Formulario para crear/editar células
- Campos: nombre, país, segmento, meta
- Asignación de gerentes a células

### 2.3 Actualizar Sidebar

Agregar enlace a "Células" en el menú del administrador.

---

## Fase 3: Catálogo de Medallas Persistente

### 3.1 Hook para Medallas de Supabase

Crear `src/hooks/useMedals.ts`:
- Cargar medallas desde la tabla `medals`
- CRUD de medallas
- Sincronización con Supabase

### 3.2 Actualizar MedalsTab

Modificar `src/components/settings/MedalsTab.tsx`:
- Usar hook `useMedals` en lugar de `useConfig`
- Persistir cambios en Supabase
- Agregar toggle de activación/desactivación

### 3.3 Condiciones de Medallas

Mantener las condiciones existentes:
- `PRIMERA_VENTA` - Primera venta
- `X_VENTAS_MES` - X ventas en el mes
- `PRIMERA_META` - Primera meta cumplida
- `X_MESES_CONSECUTIVOS` - Meses consecutivos
- `TOP_VENDEDOR_MES` - Top vendedor
- `RACHA_X_SEMANAS` - Racha de semanas
- `X_PRODUCTOS_ESPECIFICOS` - Productos específicos
- `CUSTOM` - Personalizado

---

## Fase 4: Sistema de Puntos y Logros

### 4.1 Evaluador de Medallas Automático

Crear `src/utils/medalEvaluator.ts` (ya existe, ampliar):
- Función que evalúa condiciones de medallas
- Se ejecuta después de cada carga de ventas
- Asigna medallas automáticamente

### 4.2 Edge Function: Evaluar Medallas

Crear `supabase/functions/evaluate-medals/index.ts`:
- Recibe user_id
- Evalúa todas las medallas activas
- Inserta en `user_medals` las ganadas
- Actualiza XP del usuario

### 4.3 Integrar con Carga de Ventas

Modificar `process-sales-upload` para:
- Llamar al evaluador de medallas después de insertar ventas
- Retornar medallas ganadas en el resultado

---

## Fase 5: Rankings de Gamificación

### 5.1 Nueva Página: Rankings

Crear `src/pages/Rankings.tsx` con:
- Top 3 destacado con animaciones sutiles (sin complicar)
- Tabla de ranking general
- Filtros por: célula, segmento, país
- Tu posición resaltada

### 5.2 Componentes de Ranking

```
src/components/ranking/
  ├── TopThreeCard.tsx      # Podio Top 3
  ├── RankingTable.tsx      # Tabla general
  ├── RankingFilters.tsx    # Filtros
  └── MyPosition.tsx        # Posición del usuario
```

### 5.3 Hook para Rankings

Crear `src/hooks/useRankings.ts`:
- Consultar vista `ranking_view`
- Filtros dinámicos
- Paginación

---

## Fase 6: Mejoras en Carga de Datos

### 6.1 Actualizar Edge Function

Modificar `process-sales-upload/index.ts`:
- Evaluar medallas después de procesar ventas
- Actualizar rankings
- Retornar resumen más completo

### 6.2 Historial de Cargas

Crear `src/pages/UploadHistory.tsx`:
- Lista de cargas anteriores
- Ver errores de cada carga
- Estadísticas de éxito

---

## Fase 7: Navegación y UX

### 7.1 Actualizar Sidebar

Modificar `src/components/layout/Sidebar.tsx`:

**Menú Administrador:**
- Dashboard Global
- Usuarios (gerentes y ejecutivos)
- Células (nuevo)
- Ranking
- Configuración (productos, niveles, medallas)

**Menú Gerente:**
- Dashboard
- Cargar Ventas
- Mi Equipo
- Ranking
- Medallas

**Menú Ejecutivo:**
- Dashboard
- Mis Ventas
- Mis Medallas
- Ranking

### 7.2 Actualizar Rutas

Modificar `src/App.tsx`:
- `/cells` - Gestión de células
- `/ranking` - Rankings (reemplazar Placeholder)

---

## Fase 8: Preparación para SSO

### 8.1 Documentación

Crear guía de configuración para Entra ID en `docs/sso-setup.md`:
- Pasos para configurar Supabase con Azure AD
- Variables de entorno necesarias
- Flujo de autenticación

### 8.2 Componente de Login Preparado

El login actual usa email/password. Agregar botón preparado para SSO:
```tsx
<Button disabled variant="outline">
  Iniciar con cuenta corporativa (próximamente)
</Button>
```

---

## Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `src/pages/Cells.tsx` | Crear |
| `src/pages/Rankings.tsx` | Crear |
| `src/pages/UploadHistory.tsx` | Crear |
| `src/hooks/useMedals.ts` | Crear |
| `src/hooks/useRankings.ts` | Crear |
| `src/hooks/useManagerCells.ts` | Crear |
| `src/components/ranking/TopThreeCard.tsx` | Crear |
| `src/components/ranking/RankingTable.tsx` | Crear |
| `src/components/ranking/RankingFilters.tsx` | Crear |
| `src/components/cells/CellsList.tsx` | Crear |
| `src/components/cells/CellForm.tsx` | Crear |
| `supabase/functions/evaluate-medals/index.ts` | Crear |
| Migración: manager_cells, ranking_view | Crear |
| `src/pages/Users.tsx` | Modificar |
| `src/components/settings/MedalsTab.tsx` | Modificar |
| `src/components/layout/Sidebar.tsx` | Modificar |
| `src/App.tsx` | Modificar |
| `supabase/functions/process-sales-upload/index.ts` | Modificar |

---

## Pruebas End-to-End

### Flujo 1: Gestión de Gerentes
1. Login como Admin
2. Crear un nuevo Gerente con país y segmento
3. Asignar células al gerente
4. Verificar que aparece en la lista

### Flujo 2: Gestión de Células
1. Login como Admin
2. Crear nueva célula "Empresarios Colombia 1"
3. Asociar país "Colombia" y segmento "Empresarios"
4. Asignar a un gerente
5. Verificar visualización

### Flujo 3: Carga de Ventas y Puntos
1. Login como Gerente
2. Descargar plantilla CSV
3. Llenar con ejecutivos del equipo
4. Cargar archivo
5. Verificar XP asignado
6. Verificar medallas otorgadas

### Flujo 4: Rankings
1. Login como Ejecutivo
2. Ver ranking general
3. Filtrar por célula
4. Verificar posición propia
5. Ver top 3

### Flujo 5: Medallas Automáticas
1. Cargar ventas para un ejecutivo nuevo
2. Verificar que recibe medalla "Primera Venta"
3. Verificar XP bonus de la medalla
4. Ver en perfil las medallas ganadas

---

## Secuencia de Implementación Recomendada

```
1. Migraciones de DB (manager_cells, ranking_view, nickname)
   ↓
2. Hooks: useMedals, useRankings, useManagerCells
   ↓
3. Páginas: Cells.tsx, Rankings.tsx
   ↓
4. Edge Function: evaluate-medals
   ↓
5. Integración: process-sales-upload + evaluador
   ↓
6. Actualizar: Sidebar, Users.tsx, MedalsTab.tsx
   ↓
7. Pruebas end-to-end
```

---

## Mensaje Estratégico (UI)

En el footer o header de la aplicación, mostrar el propósito:

> "Impulsando el éxito comercial a través del reconocimiento, 
> la competencia sana y el crecimiento continuo"

---

## Consideraciones Técnicas

1. **Sin animaciones complejas**: UI funcional y limpia
2. **Enfoque en datos**: Rankings y medallas basados en datos reales
3. **Escalable**: Preparado para agregar más condiciones de medallas
4. **Seguridad**: RLS mantiene separación de datos por gerente
5. **Performance**: Vistas de DB para rankings eficientes

