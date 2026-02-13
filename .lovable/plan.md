
# Plan de Migración - Estado Actual

## ✅ Fase 1 - Completada
- CHECK constraints en sales, products, levels, profiles, medals
- 7 índices de rendimiento
- FKs corregidas con ON DELETE SET NULL
- Trigger `calculate_sale_xp` para cálculo automático de XP
- Políticas RLS de `manager_cells` corregidas a `authenticated`
- Políticas INSERT en `sales` para gerentes y admins

## ✅ Fase 2 - Completada
- `profiles.level` (texto) → `profiles.level_id` (FK a `levels.id`)
- `profiles.segment` eliminado (se deriva de `cells.segment` via `cell_id`)
- `ranking_view` actualizada para usar `cells.segment`
- Código frontend, hooks, edge functions actualizados

## Pendiente (Futuro)
- Crear ENUMs para `medals.category` y `medals.condition_type`
- Crear ENUM o tabla de referencia para `country`
- Habilitar leaked password protection
