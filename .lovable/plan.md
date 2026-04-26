Plan de corrección definitiva para SP Convención

Objetivo: que MiPerformance, Ranking, Header y Sidebar muestren exactamente el mismo SP Convención anual acumulado, sin usar `profile.sp_totales`, `sp_convencion` ni el SP mensual de `useGamificationMetrics` para esta moneda.

Cambios propuestos

1. Centralizar el cálculo anual en `src/lib/sp-convencion-anual.ts`
- Mantener `computeSpConvencionAnualForCelula` como fuente para gerentes/equipos VN.
- Ajustarla para que replique el cálculo que hoy da 1,414 en MiPerformance/Header/Sidebar:
  - aplicar fallback de split FE/Nube cuando meses antiguos tienen `meta_fe/meta_nube = 0` pero sí tienen `meta_total` o `meta_total_und`;
  - conservar la fórmula exacta por mes:
    `cap(pct_fe,300) + cap(pct_nube * 2,300) + cap(pct_acv,300)`;
  - mantener match por célula y fallback por nombre normalizado del gerente.
- Agregar `computeSpConvencionAnualForAsesor`, pero adaptado al esquema real del proyecto:
  - `ejecucion_asesores` no tiene `familia`, `unidades` ni `nombre_asesor`; usa `ventas_fe`, `ventas_nube`, `ventas_total`, `acv_total`, `documento_asesor`;
  - `productividad_asesores` usa `anio_mes`, `asesor`, `meta`, `acv_f`, no `mes/meta_acv/nombre_asesor`;
  - matching por nombre normalizado y, cuando exista, por documento desde `metas_asesores`.

2. Corregir la card hero de `src/pages/MiPerformance.tsx`
- Crear estado local `spConvencionAnualDisplay`.
- Para VN gerentes/equipos: calcular con `computeSpConvencionAnualForCelula` usando célula + nombre del perfil.
- Para VN asesores: calcular con `computeSpConvencionAnualForAsesor`.
- Reemplazar el valor actual de la card hero (`profile?.sp_totales || 0`) por ese valor anual.
- Mantener SP Canje como está.
- Seguir sincronizando el total anual al store global para que Header/Sidebar permanezcan alineados.

3. Corregir Ranking VN en `src/pages/Rankings.tsx`
- Tab Asesores/Comerciales:
  - dejar de asignar SP por célula a cada asesor;
  - calcular `sp_totales` con `computeSpConvencionAnualForAsesor` para cada asesor.
- Tab Gerentes/Equipos:
  - usar exclusivamente `computeSpConvencionAnualForCelula`;
  - pasar siempre `celula` y `gerenteInfo?.nombre` como fallback;
  - garantizar que las filas `ventas_gerente_mensual`, `metas_asesores` y `metas_acv_gerentes` incluyan país/canal para evitar cruces incorrectos;
  - eliminar dependencias de `sp_convencion`/`sp_totales` para ordenar o mostrar SP Convención VN.

4. No tocar Header/Sidebar
- No modificar `src/components/layout/Header.tsx` ni `src/components/layout/Sidebar.tsx`, salvo que el build obligue a ajustar imports por tipos.
- Deben seguir mostrando el valor correcto ya observado: 1,414.

5. Verificación
- Validar en código que ya no exista uso de `profile.sp_totales`, `sp_convencion` o `useGamificationMetrics.spConvencion` para mostrar SP Convención en:
  - card hero de MiPerformance;
  - Ranking asesores;
  - Ranking gerentes.
- Ejecutar búsqueda y build/lint si está disponible.
- Verificar el caso Diana Maria Naranjo Mattheus:
  - Header: 1,414;
  - Sidebar: 1,414;
  - Card hero MiPerformance: 1,414;
  - Ranking: SP = 1,414 para su fila/equipo correspondiente.

Archivos a modificar
- `src/lib/sp-convencion-anual.ts`
- `src/pages/MiPerformance.tsx`
- `src/pages/Rankings.tsx`

Archivos a no modificar
- `src/hooks/useGamificationMetrics.ts`
- `src/components/layout/Header.tsx`
- `src/components/layout/Sidebar.tsx`
- archivos autogenerados de la integración backend.