## Plan de corrección

### Qué voy a corregir
1. Unificar la fórmula de SP Convención VN en toda la app para que siempre sea:
   `SP mensual = %Uds + %FE + (%Nube × 2) + %ACV`
2. Hacer que el historial mensual, el banner de Mi Performance, el header/sidebar, el ranking y el perfil autenticado usen exactamente la misma fuente de cálculo.
3. Ejecutar un recálculo masivo 2026 y persistir el total correcto en backend para todos los gerentes y asesores VN de Colombia, México, Ecuador y Uruguay.

### Hallazgos confirmados
- `src/lib/vn-convention.ts` ya suma correctamente `pctTotal + pctAcv + pctFe + pctNube * 2`.
- `src/pages/MiPerformance.tsx` todavía muestra mal la columna SP del historial mensual: allí se está calculando solo `ACV + FE + Nube*2` y se está omitiendo `%Uds`. Por eso una tabla puede mostrar 187 cuando la suma esperada incluye otro componente, o viceversa.
- `src/hooks/useSupabaseAuth.ts` para gerentes VN sigue calculando el total con una ruta separada basada en `productividad_asesores + metas_asesores + synthetic ventas_diarias`, en vez de reutilizar la misma ruta oficial de historial mensual.
- En backend hay valores persistidos desactualizados: por ejemplo, `gerentes.sp_convencion` para Diana Maria Naranjo Mattheus hoy está en `394`, mientras el caso que muestras apunta a `414`.
- No existen filas de `sp_acumulados` de convención para Diana ni Grace; hoy la persistencia real está dependiendo de `gerentes.sp_convencion` / `asesores.sp_convencion`.

### Implementación
1. Corregir el historial mensual VN
   - Ajustar `VnHistorialSection` para que la columna `SP` use exactamente el mismo total del motor (`%Uds + %FE + (%Nube × 2) + %ACV`).
   - Evitar recomputaciones parciales en el componente y preferir el `sp` ya calculado por la capa de datos cuando esté disponible.

2. Unificar la fuente de verdad en frontend
   - Extraer/usar un único builder para VN mensual en `src/lib/vn-convention.ts`.
   - Hacer que `useGamificationMetrics.ts`, `useSupabaseAuth.ts` y `Rankings.tsx` consuman ese mismo builder.
   - Para gerentes VN, priorizar `ventas_gerente_mensual` como fuente oficial de FE/Nube/Unidades/ACV por mes, combinada con `metas_asesores` y `productividad_asesores` para metas y ACV meta.
   - Para asesores VN, usar la misma fórmula mensual y misma normalización de país/ACV.

3. Persistir los totales correctos en backend
   - Crear una rutina de recálculo masivo para ciclo 2026 de todos los usuarios VN (`VN_ALIADOS` y `VN_EMPRESARIOS`) en `COL`, `MEX`, `ECU`, `URU`.
   - Recalcular mes a mes y luego guardar la sumatoria anual en:
     - `gerentes.sp_convencion`
     - `asesores.sp_convencion`
   - Si conviene para trazabilidad, también dejar una salida estructurada por periodo antes de actualizar para validar muestras como Diana y Grace.

4. Validación final
   - Verificar manualmente casos conocidos como Diana y Grace comparando:
     - Historial mensual en UI
     - Suma anual mostrada en perfil/header/ranking
     - Valor persistido en backend
   - Confirmar que los totales coinciden en todos los puntos de la plataforma.

### Detalles técnicos
- Archivos a tocar:
  - `src/lib/vn-convention.ts`
  - `src/hooks/useGamificationMetrics.ts`
  - `src/hooks/useSupabaseAuth.ts`
  - `src/pages/MiPerformance.tsx`
  - `src/pages/Rankings.tsx`
- Datos usados:
  - `ventas_gerente_mensual` para ejecución oficial de gerente VN por mes
  - `metas_asesores` para `meta_fe`, `meta_nube`, `meta_total` y exclusión por novedad
  - `productividad_asesores` para `acv_f` y `meta ACV` con escala por país
- Persistencia a actualizar:
  - `gerentes.sp_convencion`
  - `asesores.sp_convencion`

### Resultado esperado
- Si una fila mensual muestra 54% Uds, 57% FE, 46% Nube y 38% ACV, el SP del mes quedará exactamente en `54 + 57 + 92 + 38 = 241`.
- El total anual será la suma de la columna SP mes a mes.
- Ese mismo total quedará igual en Mi Performance, header, sidebar, ranking y backend.
- Diana, Grace y el resto de VN en Colombia, México, Ecuador y Uruguay quedarán alineados con la tabla mensual oficial.

Apenas apruebes, hago la corrección y corro el recálculo masivo.