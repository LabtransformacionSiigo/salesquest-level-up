

# Plan: Corregir métricas mensuales en Dashboard, Mi Performance y Rankings

## Problemas identificados

1. **Dashboard muestra 79% incorrecto**: El `vcCumplimiento` suma TODOS los meses (ACV total / Meta total), en vez de mostrar solo el mes actual (Abril).

2. **Mi Performance - ACV+ muestra $1202.5M**: `vcHeadlineValue` usa `acvData[0]` que toma el primer resultado de `acv_vc_mensual` ordenado por `anio DESC` sin filtrar por mes actual. Muestra datos de cualquier mes.

3. **Mi Performance - Unidades incorrectas**: Mismo problema, toma unidades del primer registro que no necesariamente es Abril.

4. **Cumplimiento por Mes desordenado**: No está ordenado de más reciente a más antiguo.

5. **Rankings - SP = 0 para Nerli/Adelia**: El ranking de comerciales busca SP por nombre de gerente en `ranking_general`, pero Adelia tiene 0 SP en `sp_acumulados`. Esto indica que el motor `calcular-sp-semanal` no le ha otorgado puntos a este gerente.

6. **Desglose por producto muestra todos los meses**: El hook filtra por `headlineMonth` pero si ese valor es incorrecto, muestra datos equivocados.

## Cambios a realizar

### 1. Hook `useGamificationMetrics.ts` — Filtrar por mes actual

**Gerente VC path (query 6):**
- Añadir filtro `.eq('mes', currentMonthName)` a la query de `acv_vc_mensual` para obtener solo datos de Abril.
- Cambiar `vcHeadlineValue` para usar solo el mes actual, no `totalAcv`.

**Gerente VC path (query 7):**  
- Añadir filtro `.eq('mes', currentMonthName)` a la query de `desglose_producto_vc`.

**`vcCumplimiento`:**
- Calcular el % de cumplimiento solo con datos del mes actual (no sumando todos los meses).

**`vcMonthlyCumplimiento`:**
- Seguir trayendo todos los meses para el historial, pero ordenar de más reciente a más antiguo.

**VC Advisor path:**
- Aplicar la misma lógica: filtrar `ventasMetaRes` por mes actual para headline, y mantener historial completo ordenado.

### 2. `MiPerformance.tsx` — Corregir headline y orden

- `vcHeadlineValue`: Usar `acvMes` (que vendrá filtrado por mes actual desde el hook).
- `vcUnitsTotal`: Usar `unidades` del hook (filtrado por mes actual).
- `vcMonthlyCumplimiento`: Ordenar por índice de mes (más reciente primero).

### 3. `Rankings.tsx` — SP de comerciales

- Para comerciales VC, el SP debe venir del gerente asociado o calcularse. El problema es que Adelia tiene 0 en `sp_acumulados`. Esto requiere que el motor SP haya corrido correctamente para ella.
- Verificar si el motor `calcular-sp-semanal` cubre a todos los gerentes VC activos.

### 4. `Dashboard.tsx` — % Cumplimiento del mes actual

- `pctCumplimiento` ya viene del hook; asegurar que refleje solo Abril tras el fix del hook.

## Resumen técnico de ediciones

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useGamificationMetrics.ts` | Filtrar `acv_vc_mensual` y `desglose_producto_vc` por mes actual; calcular `vcCumplimiento` solo con mes actual; ordenar `vcMonthlyCumplimiento` de reciente a antiguo |
| `src/pages/MiPerformance.tsx` | Usar `acvMes` para headline; ordenar historial cumplimiento; usar `unidades` del hook |
| `src/pages/Dashboard.tsx` | Sin cambios necesarios (hereda fix del hook) |
| `src/pages/Rankings.tsx` | Sin cambios necesarios (las vistas ya filtran por `mes_actual_nombre()`) |

El problema de SP = 0 para algunos gerentes es un problema de datos: el motor de cálculo de SP no ha procesado a esos gerentes. Después de implementar estos cambios, se recomienda ejecutar una sincronización completa desde Admin → Databricks para recalcular los SP de todos.

