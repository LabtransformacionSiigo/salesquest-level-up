

# Plan: Integración Multi-Frente (Aliados + Empresarios) en Siigo Arena

## Contexto

La plataforma ya soporta 3 canales (`VC`, `VN_ALIADOS`, `VN_EMPRESARIOS`) con gerentes activos en cada uno. La sincronización actual con Databricks ya maneja Productividad para VN y Ventas VC. Necesitamos crear tablas dedicadas para metas y ejecución de asesores de Aliados/Empresarios, actualizar la lógica de SP, y adaptar el UI.

---

## Fase 1: Nuevas Tablas de Base de Datos

### Migration 1: `metas_asesores`
```sql
CREATE TABLE public.metas_asesores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_asesor text NOT NULL,
  pais text DEFAULT 'COL',
  canal_direccion text NOT NULL,
  meta_fe integer DEFAULT 0,
  meta_nube integer DEFAULT 0,
  meta_total integer DEFAULT 0,
  anio_mes text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(documento_asesor, canal_direccion, anio_mes)
);
ALTER TABLE public.metas_asesores ENABLE ROW LEVEL SECURITY;
-- SELECT para authenticated, INSERT/UPDATE para admins
```

### Migration 2: `ejecucion_asesores`
```sql
CREATE TABLE public.ejecucion_asesores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_asesor text NOT NULL,
  periodo text NOT NULL,
  canal_direccion text NOT NULL,
  pais text DEFAULT 'COL',
  ventas_fe integer DEFAULT 0,
  ventas_nube integer DEFAULT 0,
  ventas_total integer DEFAULT 0,
  acv_total numeric DEFAULT 0,
  cant_recomendados integer DEFAULT 0,
  productividad numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(documento_asesor, canal_direccion, periodo)
);
ALTER TABLE public.ejecucion_asesores ENABLE ROW LEVEL SECURITY;
```

### Migration 3: Agregar `puntos_ranking` a asesores
```sql
ALTER TABLE public.asesores 
  ADD COLUMN IF NOT EXISTS puntos_ranking integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documento text,
  ADD COLUMN IF NOT EXISTS canal_direccion text;
```

---

## Fase 2: Edge Function de Sincronización (Aliados/Empresarios)

Actualizar `sync-databricks/index.ts`:

- Agregar nueva config `TABLE_CONFIGS` para queries de Databricks que traigan datos de Aliados y Empresarios (unidades por tipo producto, recomendados, productividad).
- Nueva función `syncEjecucionAsesores()` que:
  1. Reciba rows de Databricks con campos como `TIPO_PRODUCTO`, `UNIDADES`, `CANT_RECOMENDADOS`.
  2. Normalice productos bajo categorías maestras ("NUBE", "FE", etc.).
  3. Agrupe por `documento_asesor + periodo + canal_direccion`.
  4. Upsert en `ejecucion_asesores`.
- Nueva función `syncMetasAsesores()` para ingestar metas por asesor/periodo/canal.

---

## Fase 3: Lógica Universal de Siigo Points (Ranking)

Actualizar `calcular-sp-semanal/index.ts`:

- Agregar un bloque para canales `VN_ALIADOS` y `VN_EMPRESARIOS` que:
  1. Lea `ejecucion_asesores` agrupado por `documento_asesor` y `canal_direccion`.
  2. Cruce con `metas_asesores` del mismo periodo y canal.
  3. Calcule `SP = ROUND((ventas_total / meta_total) * 100)`.
  4. Upsert en `sp_acumulados` con `fuente = 'CUMPLIMIENTO_META'`.
  5. Actualice `asesores.puntos_ranking` con la sumatoria.
- Solo comparar si `canal_direccion` coincide entre ejecución y meta.

---

## Fase 4: Medallas y Puntos Canjeables para Nuevos Frentes

Actualizar la función `evaluateMedals` en `calcular-sp-semanal`:

- Agregar nuevos `condicion_tipo` en el catálogo:
  - `"recomendados"`: Si `cant_recomendados >= cantidad_requerida` → medalla + puntos canjeables.
  - `"equilibrio"`: Si `ventas_fe >= meta_fe AND ventas_nube >= meta_nube` → medalla + puntos canjeables.
  - `"productividad_superior"`: Si productividad > promedio del equipo → reto completado.
- Estas medallas alimentan `puntos_canjeables` vía `otorgar_medalla_si_aplica` (ya soporta asesores).
- No afectan `puntos_ranking`.

---

## Fase 5: UI/UX Segmentado

### `KpiProgressBars.tsx`
- Leer `canal_direccion` del perfil del usuario.
- Si es Aliados/Empresarios: mostrar barras de FE vs meta_fe, Nube vs meta_nube, Productividad, y Recomendados.
- Si es VC: mantener el layout actual (ACV+ vs Meta).

### `Dashboard.tsx` y `MiPerformance.tsx`
- Agregar fetch de `ejecucion_asesores` y `metas_asesores` cuando `canal_direccion` sea Aliados o Empresarios.
- Mostrar tarjetas dinámicas de Productividad y Recomendados.

### `Rankings.tsx`
- Mantener filtros existentes de `pais` y `canal`.
- Para Aliados/Empresarios: leer `puntos_ranking` de asesores + `puntos_canjeables`, mostrar ambas columnas.
- Agregar tab de "Asesores" para estos frentes.

### `useSupabaseAuth.ts`
- Para asesores de Aliados/Empresarios: leer SP desde `sp_acumulados` filtrado por `fuente = 'CUMPLIMIENTO_META'` (ya implementado en rama `else` del asesor no-VC).

### `useGamificationMetrics.ts`
- Agregar branch para canales VN: fetch de `ejecucion_asesores` y `metas_asesores` para poblar KPIs del dashboard.

---

## Archivos a Modificar/Crear

| Archivo | Acción |
|---|---|
| `supabase/migrations/...` | 3 migraciones (tablas + columnas) |
| `supabase/functions/sync-databricks/index.ts` | Agregar sync de ejecución y metas |
| `supabase/functions/calcular-sp-semanal/index.ts` | SP universal + medallas nuevos frentes |
| `src/hooks/useGamificationMetrics.ts` | Branch para VN con datos de ejecución |
| `src/hooks/useSupabaseAuth.ts` | Mapear `canal_direccion` al perfil |
| `src/components/dashboard/KpiProgressBars.tsx` | Barras dinámicas FE/Nube/Productividad |
| `src/pages/Dashboard.tsx` | Tarjetas condicionales por frente |
| `src/pages/MiPerformance.tsx` | Métricas VN específicas |
| `src/pages/Rankings.tsx` | Tabs + filtros por canal_direccion |

---

## Notas Técnicas

- Las queries de Databricks para Aliados/Empresarios necesitarán ser definidas con el usuario (nombres exactos de tablas/columnas en Databricks). El plan asume una estructura similar a la de Productividad.
- El mapeo de productos (ej. "Nube Facturación" → "NUBE") se hará con una función de normalización en la Edge Function de sincronización.
- Los tipos TypeScript se actualizarán automáticamente tras las migraciones.

