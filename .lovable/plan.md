## Objetivo

Agregar una fila/card de **Total SP Convención 2026** al final del Historial Mensual, mostrando la suma de los SP mensuales ya calculados. No se modifica ninguna fórmula, fuente de datos ni hook (`useGamificationMetrics` queda intacto).

## Cambios visuales

### 1. `src/pages/MiPerformance.tsx` — `VnHistorialSection` (tabla)

Aplica a **asesores y gerentes** de todos los canales VN (VN_ALIADOS, VN_EMPRESARIOS) en COL, MEX, ECU, URU, ya que esta misma sección se usa para todos.

- Calcular `totalSp` como la suma de `spTotal` por mes usando exactamente la fórmula ya existente:
  `spTotal = (hasMetaFe ? cap(pct_fe) : 0) + (hasMetaNube ? cap(pct_nube)*2 : 0) + (hasMetaAcv ? cap(pct) : 0)` con `cap = min(300, round(v))`.
- Contar `mesesConDatos` como la cantidad de meses cuyo `spTotal > 0` (meses futuros sin datos quedan en 0 y no cuentan, según test 6).
- Agregar un `<tfoot>` al final de la tabla con una fila destacada:
  - Celda izquierda (colSpan 9): `⚡ Total SP Convención 2026` + subtítulo `Acumulado {mesesConDatos} meses`.
  - Celda derecha: badge grande naranja/dorado con `+{totalSp.toLocaleString()}`.
  - Estilos: fondo `bg-orange/10`, borde superior, texto `text-orange` grande y negrita (`text-2xl font-scoreboard font-black`).

### 2. `src/components/performance/EquipoMensualGrid.tsx` — grid de cards (vista equipo gerente)

- Calcular `totalSp = meses.reduce((s, m) => s + m.sp_mes, 0)` (los `sp_mes` ya están con cap aplicado).
- Calcular `mesesConDatos = meses.filter(m => m.sp_mes > 0).length`.
- Después del `grid` de cards, agregar una **card destacada** con:
  - Fondo `bg-gradient-to-r from-orange/15 to-primary/10` con borde `border-orange/40`.
  - Título: `⚡ Total SP Convención 2026`.
  - Valor grande (`text-4xl font-scoreboard font-black text-orange`): `+{totalSp.toLocaleString()}` SP.
  - Subtítulo: `Acumulado {mesesConDatos} mes(es)`.

## Notas de cumplimiento de tests

- **Test 1–4** (Aliados/Empresarios COL y México, asesores y gerentes): la suma se hace sobre el mismo arreglo que ya alimenta la tabla, así que será idéntica al ejemplo 211 + 313 + 383 + 507 = 1414.
- **Test 5** (mes con fallback proporcional): si `spTotal > 0` se incluye automáticamente.
- **Test 6** (meses futuros): `sp = 0` ⇒ no suma y no incrementa el contador de meses.
- **Test 7** (cap 300%): el cap ya está aplicado en `spTotal`/`sp_mes`, la suma lo respeta.

## Lo que NO se toca

- `useGamificationMetrics`, fórmula SP, fuentes de datos (`ventas_gerente_mensual`, `metas_asesores`, `productividad_asesores`, `metas_acv_gerentes`).
- Edge functions de sincronización (incluyendo `sync-vn-mexico`, que ya alimenta las mismas tablas).
- Lógica de carga por país/canal: México ya entra por la misma ruta de datos consolidados.

## Archivos a editar

- `src/pages/MiPerformance.tsx` (componente `VnHistorialSection`)
- `src/components/performance/EquipoMensualGrid.tsx`
