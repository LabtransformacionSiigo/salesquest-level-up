

## Plan: Acelerar sync de Databricks y arreglar Motor de SP

### Diagnóstico real (de los logs)

1. **`CPU Time exceeded`** en `sync-databricks` — el límite real que están golpeando NO es el timeout de 150s de red, es el **límite de CPU por worker** (~150s de CPU wall-clock acumulado). Procesar 33,140 filas + 3,154 filas + clasificar familias + upserts en un solo worker excede ese presupuesto.
2. **Queries duplicadas**: en los logs se ve `[ventas_aliados] Querying Databricks` ejecutándose **3 veces seguidas** porque el loop secuencial dentro de un único `EdgeRuntime.waitUntil` reintenta cuando el worker es matado por CPU.
3. **Motor SP roto**: `calcular-sp-semanal` no responde porque depende de `ejecucion_asesores` que nunca termina de poblarse.

### Solución

#### 1. Aislar cada tabla en su propio worker (paraleliza CPU)
En lugar de un solo `waitUntil` que itera 6 tablas en serie (consume CPU acumulada del mismo worker → matado), dispatch **una invocación HTTP fire-and-forget por tabla**. Cada tabla corre en un worker fresco con su propio presupuesto de CPU.

```text
all_new (orquestador, responde 202 inmediato)
   ├─ POST self → metas_gerentes        (worker 1, fresh CPU)
   ├─ POST self → metas_asesores_sync   (worker 2)
   ├─ POST self → ventas_empresarios    (worker 3)
   ├─ POST self → ventas_aliados        (worker 4) ← ya no muere por CPU
   ├─ POST self → ventas_vn_completo    (worker 5)
   └─ POST self → productividad_asesores(worker 6)
```

#### 2. Eliminar reintentos accidentales
Quitar el patrón `for...of` dentro del `waitUntil` único. Cada tabla recibe su propio job independiente, así si una falla las demás siguen.

#### 3. Hacer `updateEjecucionFromVentasDiarias` más liviano
Esta función procesa fila por fila las 33k ventas de aliados después del upsert. Optimizar a:
- Agregar en memoria con `Map` por `(documento_asesor, periodo)` → 1 sola pasada
- Un solo `parallelUpsert` con todos los registros agregados (vs uno por asesor)

#### 4. Motor de SP independiente del sync
- Quitar el trigger automático desde `sync-databricks` (`triggerSpRecalculation`).
- El admin lo dispara manualmente desde `/admin/calculos` cuando ve que el sync ya completó (los 6 jobs en estado `completed` en la tabla `sync_jobs`).
- En `calcular-sp-semanal`, agregar response inmediato 202 + `EdgeRuntime.waitUntil` (ya está hecho), pero también dividir el procesamiento por **país** en workers separados si sigue excediendo CPU.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/sync-databricks/index.ts` | (a) Reemplazar el bloque `all_new` para hacer 6 fetch fire-and-forget al mismo endpoint en lugar del loop con un solo `waitUntil`. (b) Eliminar la llamada a `triggerSpRecalculation` desde `runAllNewSyncs` y `runVentasVcCompleto` y `runVentasVnCompleto`. (c) Refactorizar `updateEjecucionFromVentasDiarias` para agregar en memoria y hacer un solo upsert masivo. |
| `supabase/functions/calcular-sp-semanal/index.ts` | Validar que ya responde 202 inmediato (ya lo hace). Sin cambios estructurales. |
| `src/pages/admin/AdminCalculoSP.tsx` | Agregar mensaje claro: "Asegúrate de que la sincronización de Databricks haya completado antes de ejecutar." + un check rápido del último `sync_jobs` exitoso. |

### Resultado esperado

- **Sync**: cada tabla termina en 30-60s aislada en su propio worker. Las 6 corren en paralelo → tiempo total ~60-90s en lugar de >5 min con timeouts.
- **No más `CPU Time exceeded`**.
- **Motor de SP**: el admin lo ejecuta cuando vea los 6 jobs verdes; corre limpio en background y responde instantáneo.

