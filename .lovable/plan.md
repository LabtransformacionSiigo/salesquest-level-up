## Problema

El SP Convención de un mismo gerente muestra valores distintos según dónde se lea:

- **Sidebar / Header / Mi Progreso** → usa `useGamificationMetrics` (pipeline complejo: `ventas_gerente_mensual` con dedup por familia + fallbacks a `vn_metricas_optimizadas` scope=gerente, `ejecucion_asesores`, `ventas_diarias`, `productividad_asesores`; metas estrictas desde `metas_acv_gerentes` con prioridad Cierre>Inicio).
- **Ranking (tabla)** → usa `computeSpConvencionAnualForCelula` (pipeline simplificado, sin varios de esos fallbacks ni la misma precedencia).

Resultado: Carol ve **1.089** en su sidebar pero **1.137** en la tabla del ranking. Es un KPI crítico — debe haber una única fuente de verdad.

## Objetivo

1. **Fuente única**: el SP que ve cada gerente en "Mi Progreso" es la verdad. El Ranking debe mostrar exactamente ese mismo número para cada fila.
2. **Tiempo real**: el ranking se actualiza cuando cambian las tablas fuente (sin polling agresivo cada segundo: usamos suscripciones realtime de Supabase + refetch en cambio detectado).

## Plan técnico

### Paso 1 — Extraer la lógica de Mi Progreso a una función pura compartida

Crear `src/lib/sp-convencion-vn-mi-progreso.ts` con:

```ts
computeMonthlyCumplimientoForGerente({
  celula, gerenteNombre, anio,
  ventasGerenteMensualRows,   // ventas_gerente_mensual
  vnMetricasGerenteRows,       // vn_metricas_optimizadas scope=gerente
  vnMetricasAsesorRows,        // scope=asesor (fallback)
  ventasDiariasRows,
  ejecucionAsesoresRows,
  productividadAsesoresRows,
  metasAcvRows,                // metas_acv_gerentes (Cierre>Inicio)
  metasAsesoresRows,           // metas_asesores (fallback meta_fe/nube)
}) : MonthlyCumplimiento[]
```

Esta función reproduce **idénticamente** el bloque de `useGamificationMetrics.ts` (líneas ~1049-1577) que produce `vcMonthlyCumplimiento`. El total anual es la suma de la columna `sp`.

Luego reemplazar el cálculo inline dentro de `useGamificationMetrics` por una llamada a esta función para garantizar que siempre estén alineados.

### Paso 2 — Usar la función única en el Ranking

En `src/pages/Rankings.tsx` (canal VN):

1. Cargar **una sola vez** las tablas base con los filtros amplios (por país + canal del usuario): `ventas_gerente_mensual`, `vn_metricas_optimizadas` (scope=gerente y scope=asesor), `ventas_diarias`, `ejecucion_asesores`, `productividad_asesores`, `metas_acv_gerentes`, `metas_asesores`.
2. Por cada gerente del ranking, llamar `computeMonthlyCumplimientoForGerente(...)` filtrando las filas por su célula/nombre, y sumar `.sp`.
3. Reemplazar `computeSpConvencionAnualForCelula` (que queda deprecado; mantener export pero redirigir a la nueva función para evitar romper otros consumidores).

### Paso 3 — Tiempo real

En `Rankings.tsx`, suscribirse vía `supabase.channel('rankings-vn')` a INSERT/UPDATE/DELETE de:
- `ventas_gerente_mensual`
- `vn_metricas_optimizadas`
- `ventas_diarias`
- `metas_acv_gerentes`
- `sp_acumulados`

En cualquier cambio: re-disparar el `loadRanking()` (debounced 1.5s para no saturar al recibir lotes del sync de Databricks). Habilitar Realtime para esas tablas en una migración (`ALTER PUBLICATION supabase_realtime ADD TABLE …`).

### Paso 4 — Verificación

Después de implementar:
- Iniciar sesión como Carol Florez → comparar SP del sidebar (Mi Progreso) con el valor de su fila en `/ranking`. Deben ser idénticos.
- Repetir con otro gerente de otra célula.
- Forzar una inserción en `ventas_gerente_mensual` y verificar que el ranking se refresca en ≤2s sin recargar la página.

## Detalles importantes

- **Costos de carga**: traer todas las tablas para todos los gerentes del país+canal puede ser pesado (cientos de miles de filas). Mitigación: filtros server-side por `pais`, `canal`, `anio=2026`, y limit por chunks de células.
- **Asesores VN**: el ranking de asesores ya usa `computeSpConvencionAnualForAsesor` que coincide con Mi Progreso individual; no se toca esa parte.
- **Canal VC**: el ranking VC se calcula desde `sp_acumulados` y no presenta este desajuste (no se modifica).

## Riesgos

- Refactor grande del hook `useGamificationMetrics` (1955 líneas). Extraer la función debe respetar **byte por byte** la lógica actual para no romper Mi Progreso.
- Realtime requiere la migración de publicación y que las RLS permitan SELECT al usuario logueado (ya está OK para estas tablas).
