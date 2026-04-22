
Objetivo: cerrar la fuga restante para que VN muestre exactamente los totales de Databricks en dashboard, Mi Performance, rankings y SP Convención.

Estado auditado
- El arreglo de persistencia base ya existe:
  - `ventas_diarias.registro_idx` ya está creado.
  - La migration `20260422174825_02f0e07b-1a02-44c7-b193-457cb3bdba53.sql` ya reemplazó la unique key vieja por `UNIQUE(fecha, asesor, tipo_producto, canal_direccion, producto, registro_idx)`.
  - `syncVentasAliados` y `syncVentasEmpresarios` ya limpian 2026, preservan filas individuales y usan `registro_idx`.
- La base ya contiene el volumen correcto en crudo para el caso real:
  - `ventas_diarias` en abril 2026 para `Equipo Antioquia` tiene FE=215, NUBE=70, CONTADOR=2.
- La discrepancia persiste aguas abajo:
  - `ejecucion_asesores` para `Diana Maria Naranjo Mattheus` sigue en FE=11, NUBE=3.
  - Sumando `ejecucion_asesores` por asesores cruzados con metas del equipo da FE=201, NUBE=67, todavía por debajo del crudo.
- Conclusión: la fuga principal ya no está en la carga cruda, sino en las capas agregadas y en cómo frontend/SP resuelven gerente-equipo vs asesor individual.

Plan de implementación

1. Corregir la fuente de verdad para VN gerente
- Cambiar la lógica de gerentes VN para que FE/NUBE/TOTAL del equipo salga siempre de `ventas_diarias` agregada por `celula + periodo + canal_direccion`.
- Dejar `ejecucion_asesores` como tabla derivada para asesores individuales y compatibilidad, no como fuente principal del gerente.
- Aplicar esto en:
  - `src/hooks/useGamificationMetrics.ts`
  - `src/hooks/useSupabaseAuth.ts`
  - cualquier cálculo mensual VN que hoy consuma `ejecucion_asesores` para gerentes.

2. Reescribir la agregación mensual VN del gerente
- Crear una utilidad compartida para VN gerente que reciba:
  - `ventas_diarias`
  - `productividad_asesores`
  - `metas_asesores`
  - `celula`
  - `canal_direccion`
- La utilidad debe producir por mes:
  - `ventas_fe`, `ventas_nube`, `ventas_total` desde `ventas_diarias`
  - `meta_fe`, `meta_nube`, `meta_total` desde `metas_asesores`
  - `acv`, `metaAcv` desde `productividad_asesores` / `metas_gerentes`
- Así el dashboard, historial mensual y SP convención usarán exactamente el mismo cálculo.

3. Corregir `useGamificationMetrics` en gerente VN
- Eliminar dependencia de `ejecucion_asesores` para:
  - `metrics.ejecucion`
  - `vcMonthlyCumplimiento` en VN
  - `teamAsesorPerformance` cuando se necesiten FE/NUBE por asesor
- Mantener `ventas_diarias` como base:
  - gerente: sumar por `celula`
  - asesor: sumar por nombre/documento normalizado
- Revisar el filtro de equipo para que sea prioritariamente por `celula`, no por coincidencia de nombres.

4. Corregir `teamAsesorPerformance`
- Hoy arma FE/NUBE por asesor desde `ejecucion_asesores`, lo que sigue heredando subconteos.
- Cambiarlo para construir métricas por asesor directamente desde `ventas_diarias` del mes:
  - FE = suma de `unidades` donde `tipo_producto='FE'`
  - NUBE = suma de `unidades` donde `tipo_producto='NUBE'`
  - TOTAL = suma de todas las `unidades`
- Mantener metas por asesor desde `metas_asesores`.

5. Corregir SP Convención VN en `useSupabaseAuth`
- Para gerentes VN, reemplazar el uso de `buildVnConventionMonthlyRows(...ejecRows...)` basado en `ejecucion_asesores` por el mismo agregado mensual desde `ventas_diarias`.
- Para asesores VN, conservar cálculo individual pero priorizando `ventas_diarias` sobre `ejecucion_asesores` cuando ambas existan.
- Resultado esperado: SP de convención y ranking quedan alineados con el mismo volumen que ve la UI.

6. Corregir agregado a `kpis_mensuales`
- En `aggregateVentasDiariasToKpis` hay un bug de mapeo:
  - intenta buscar meta con `metaByCelula.get(normalizeText(gerente.nombre))`
  - debe cruzar contra `gerente.celula`, no contra `gerente.nombre`
- Ajustar ese join para que KPI histórico VN no quede subalimentado o en cero.

7. Endurecer `ejecucion_asesores` para que no vuelva a desalinearse
- Mantener limpieza anual actual.
- Recalcular `ejecucion_asesores` exclusivamente desde `ventas_diarias` recién sincronizada.
- Validar que `tipo_producto` preserve `FE`, `NUBE`, `CONTADOR`, `OTRO`.
- `ventas_total` debe incluir todo; `ventas_fe` y `ventas_nube` solo sus familias.

8. Validación funcional obligatoria
- Validar en BD y UI estos puntos:
  - `ventas_diarias` abril 2026 / `Equipo Antioquia`
  - total gerente Diana en dashboard y Mi Performance
  - historial mensual abril 2026
  - ranking VN gerente
  - SP convención recalculado
- Caso esperado para el equipo:
  - FE ≈ 215
  - NUBE = 70
  - CONTADOR = 2
- Si negocio exige exactamente 212/70/2 como Databricks, revisar diferencia de 3 FE en la query de extracción/mapeo de Aliados antes de cerrar. Esa diferencia ya no parece ser por colisión de filas sino por criterio de inclusión.

Cambios técnicos concretos
- Archivos a tocar:
  - `src/hooks/useGamificationMetrics.ts`
  - `src/hooks/useSupabaseAuth.ts`
  - `src/lib/vn-convention.ts` o nueva utilidad VN compartida
  - `supabase/functions/sync-databricks/index.ts`
- Base de datos:
  - no crear una segunda migration de `registro_idx` salvo que falte en otro entorno; en este proyecto ya existe.
- Validación con consultas:
  - comparar `ventas_diarias` vs `ejecucion_asesores` por celula/periodo
  - comparar UI gerente vs agregado por `celula`

Secuencia de ejecución después de implementar
1. Sync `ventas_aliados`
2. Sync `ventas_empresarios`
3. Sync `productividad_asesores`
4. Recalcular SP VN
5. Verificar caso Diana / Equipo Antioquia en preview

Resultado esperado
- La UI de gerentes VN deja de mostrar el subtotal individual del líder y pasa a mostrar el total real de la célula.
- Rankings y SP Convención quedan alineados con la misma base transaccional.
- `ejecucion_asesores` deja de ser el cuello de botella que reintroduce el subconteo.
