

# Parametrización de Retos y Rachas para Venta Cruzada (VC)

## Objetivo
Habilitar en el backend y en los formularios de admin la creación de los retos diarios, semanales, mensuales y rachas definidos para VC, con sus KPIs (ACV+, Upgrades, Conversiones, Cumplimiento), familias (Nube / Legacy), y multiplicadores.

## Cambios de Base de Datos

### 1. Tabla `catalogo_retos` — nuevas columnas
- `canal text` (default `'VC'`) → para filtrar retos por canal igual que medallas/rachas.
- `kpi text` → valores: `acv_plus`, `upgrades`, `conversiones`, `cumplimiento_pct`.
- `familia_vc text` → valores: `NUBE`, `LEGACY`, `AMBAS` (Legacy = Pyme + Ilimitada).
- `umbral_secundario numeric` (nullable) → para retos con dos umbrales (ej. Nube vs Legacy en el mismo reto, si se decide unificar; opcional).
- `dias_consecutivos integer` (nullable) → no aplica aquí pero se reserva.
- Índice por `(canal, ventana_tiempo, activo)`.

### 2. Tabla `config_rachas` — nuevas columnas
- `kpi text` (default `acv_plus`).
- `familia_vc text` → `NUBE`, `LEGACY`, `AMBAS`.
- `umbral_legacy numeric` (nullable) → permite definir el umbral diferenciado Legacy en la misma racha.
- `dias_lun_mie boolean` (default false) → marca la condición "lunes a miércoles consecutivos".
- El `multiplicador_sp` ya existe (se usará 2.0 para "El artillero").

### 3. Seed de catálogo VC (insert tool, no migración)
Insertar los retos y racha pedidos:
- **Día — "El golazo del día"** × 2 registros (Nube $15M / Legacy $75M), `ventana_tiempo='diario'`, `kpi='acv_plus'`, `sp_otorgados=2`.
- **Semana — "La Jugada de la semana"**, `ventana_tiempo='semanal'`, `kpi='upgrades'`, `umbral=20`, `sp=5`, `familia_vc='AMBAS'`.
- **Mes — "La bota de oro"**, `ventana_tiempo='mensual'`, `kpi='cumplimiento_pct'`, `umbral=120`, `sp=20`, `familia_vc='AMBAS'`.
- **Mes — "Contraataque"**, `ventana_tiempo='mensual'`, `kpi='conversiones'`, `umbral=33`, `sp=10`, `familia_vc='NUBE'`.
- **Racha — "El artillero"**, `kpi='acv_plus'`, `umbral_verde=12000000`, `umbral_legacy=70000000`, `dias_lun_mie=true`, `multiplicador_sp=2.0`, `canal='VC'`.

> Nota: "TV" es un reconocimiento de fin de ciclo (no se gestiona como reto recurrente); se documenta como regla pero no se inserta en `catalogo_retos`.

## Cambios en Frontend

### `src/pages/admin/AdminEspecialista.tsx` (form de retos)
- Agregar selector **Canal** (VC / VN_ALIADOS / VN_EMPRESARIOS).
- Agregar selector **KPI de medición**: ACV+, Upgrades, Conversiones, % Cumplimiento.
- Agregar selector **Familia VC**: Nube / Legacy / Ambas (visible solo si `canal='VC'`).
- Renombrar dinámicamente la etiqueta del campo "Valor" según KPI:
  - ACV+ → "Monto ACV+ requerido (COP)"
  - Upgrades → "Upgrades requeridos"
  - Conversiones → "% conversión sobre cuota"
  - Cumplimiento → "% de cumplimiento"
- Mostrar chips de canal + KPI + familia en la lista de retos.

### `src/pages/admin/AdminRachas.tsx` (form de rachas)
- Agregar selector **Familia VC** (Nube / Legacy / Ambas).
- Agregar campo **Umbral Legacy** (visible si familia = Ambas o Legacy).
- Agregar toggle **"Lunes a miércoles consecutivos"** (`dias_lun_mie`).
- Mostrar el multiplicador como destacado (`2x`, `1.75x`, etc.).

### `src/lib/vc-advisor-metrics.ts` (referencia)
- Documentar en código (comentarios) que `upgrades` y `conversiones` se leen desde `ventas` (campos `recurrencia` / `bloque_venta`) — sin cambio funcional en este plan; el motor de evaluación se ajusta en una segunda fase.

## Detalles Técnicos
- Migración SQL para añadir columnas (idempotente con `IF NOT EXISTS`).
- RLS existente en `catalogo_retos` y `config_rachas` ya cubre admin + especialista por país/operación → no se modifica.
- Memoria a guardar: `mem://features/retos-vc-catalog-2026` con la definición exacta de los retos VC.

## Archivos a editar
1. Migración SQL (nuevas columnas en `catalogo_retos` y `config_rachas`).
2. Insert seed (5 retos + 1 racha VC).
3. `src/pages/admin/AdminEspecialista.tsx`.
4. `src/pages/admin/AdminRachas.tsx`.
5. `mem://features/retos-vc-catalog-2026` (nueva).
6. `mem://index.md` (referencia a la nueva memoria).

## Fuera de alcance (siguiente iteración)
- Motor de evaluación automática de retos VC (cron + edge function que lee `ventas` y otorga SP).
- Vista de retos para el usuario VC (`Retos.tsx`) — actualmente lee `catalogo_retos`; se adaptará al nuevo schema cuando se conecte el motor.

