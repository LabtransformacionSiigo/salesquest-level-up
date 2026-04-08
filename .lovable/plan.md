

# Plan: Extensión VN_ALIADOS & VN_EMPRESARIOS a Siigo Arena

## Resumen

Replicar el modelo de ventas individuales + rankings que ya funciona para VC, pero para los canales VN_ALIADOS y VN_EMPRESARIOS. Esto incluye: nuevas columnas en `ventas`, nuevas vistas SQL de ranking y desglose, nueva lógica de sync en la Edge Function para insertar transacciones VN en la tabla `ventas`, y actualización del frontend (Rankings, MiPerformance, AdminDatabricks) para soportar VN con métricas de unidades.

---

## Fase 1 — Migración SQL

Crear una migración con:

1. **Nuevas columnas en `ventas`**: `sc_creados_ind` (integer, default 1), `recurrencia` (text), `origen` (text), `pais` (text)
2. **Vista `ranking_vn_gerentes`**: Ranking mensual de gerentes VN por % cumplimiento de unidades desde `kpis_mensuales`, particionado por canal + país
3. **Vista `ranking_vn_comerciales`**: Ranking de asesores VN por ACV total desde la tabla `ventas` (registros con canal VN_*), particionado por canal
4. **Vista `desglose_producto_vn`**: Agrupación de ventas por producto/bloque para gerentes VN, similar a `desglose_producto_vc`

---

## Fase 2 — Edge Function: sync-databricks

Modificaciones al archivo `supabase/functions/sync-databricks/index.ts`:

1. **Corregir `inferCanal`**: Mapear `AREA = 'Aliados'` → `VN_ALIADOS`, `AREA` con 'digital'/'mercadeo'/'leads' → `VN_EMPRESARIOS`, fallback `VN_EMPRESARIOS`
2. **Agregar nuevas TABLE_CONFIGS**: `ventas_vn_aliados` y `ventas_vn_empresarios` con queries que traen transacciones individuales de Databricks
3. **Nueva función `syncVentasVN`**: Inserta transacciones individuales en tabla `ventas` (no `ventas_diarias`) con prefijo `VN-` en `documento_factura`, auto-crea gerentes faltantes, y mapea por lider/celula
4. **Agregar `ventas_vn_completo`** al SYNC_MAP y como tabla compuesta (similar a `ventas_vc_completo`)
5. **Actualizar `all_new`** para incluir las nuevas tablas VN en la secuencia

---

## Fase 3 — Edge Function: calcular-sp-semanal

1. **Filtro de canal en `evaluateMedals`**: Agregar `.eq("canal", gerente.canal)` a las queries de ventas para medallas de tipo `primera_venta` y `cantidad`
2. Sin otros cambios — la lógica VN de SP ya funciona vía `kpis_mensuales`

---

## Fase 4 — AdminDatabricks.tsx

Agregar las nuevas tablas VN al diccionario `TABLE_LABELS`:
- `ventas_vn_aliados`: "Ventas VN Aliados"
- `ventas_vn_empresarios`: "Ventas VN Empresarios"  
- `ventas_vn_completo`: "Ventas VN Completo"

---

## Fase 5 — Rankings.tsx

1. **Agregar tabs para VN**: Cuando el canal es VN_ALIADOS o VN_EMPRESARIOS, mostrar tabs "Asesores" y "Gerentes"
2. **Branch de fetch para VN**: 
   - Tab "Asesores": consultar `ranking_vn_comerciales` filtrado por canal
   - Tab "Gerentes": consultar `ranking_vn_gerentes` filtrado por canal + país
3. **Columnas específicas VN**: Mostrar "% Cumpl. Unidades", "Unidades", "Meta" en lugar de solo ACV+

---

## Fase 6 — useGamificationMetrics.ts + MiPerformance.tsx

1. **Agregar query de `desglose_producto_vn`** al hook para canales no-VC
2. **Exportar `vnProductBreakdown`** en las métricas retornadas
3. **MiPerformance**: Renderizar sección de desglose por producto para Aliados/Empresarios
4. **KpiProgressBars**: Ajustar labels para VN (mostrar "Unidades vendidas vs Meta" en lugar de "ACV+")

---

## Archivos a modificar

| Archivo | Acción |
|---|---|
| Nueva migración SQL | CREAR: vistas + columnas |
| `supabase/functions/sync-databricks/index.ts` | MODIFICAR: inferCanal, TABLE_CONFIGS, syncVentasVN |
| `supabase/functions/calcular-sp-semanal/index.ts` | MODIFICAR: canal filter en evaluateMedals |
| `src/pages/admin/AdminDatabricks.tsx` | MODIFICAR: TABLE_LABELS |
| `src/pages/Rankings.tsx` | MODIFICAR: VN tabs + fetch + columnas |
| `src/hooks/useGamificationMetrics.ts` | MODIFICAR: desglose_producto_vn query |
| `src/pages/MiPerformance.tsx` | MODIFICAR: sección desglose VN |
| `src/components/dashboard/KpiProgressBars.tsx` | MODIFICAR: labels VN |

