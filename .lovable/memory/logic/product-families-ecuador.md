---
name: product-families-ecuador
description: Mapeo oficial de SKUs Siigo a familias FE y NUBE para Ecuador. Base para medallas, retos y cálculo de SP por familia.
type: feature
---

# Familias de Productos — Ecuador (pais = "ECU")

Fuente única de verdad: `src/lib/product-families.ts` (`PRODUCT_FAMILIES_BY_COUNTRY.ECU`).

## Familia FE (19 SKUs)
- FE (10 Doc), FE (20 Doc), FE (48 Doc), FE (50 Doc), FE (96 Doc),
  FE (100 Doc), FE (120 Doc), FE (240 Doc), FE (480 Doc), FE (600 Doc),
  FE (1200 Doc), FE (2400 Doc), FE ILI
- POS
- Contador 3, Contador 5, Contador 10, Contador 15, Contador Ilimitado
  (los planes "Contador N" forman parte de FE en Ecuador)

## Familia NUBE (5 SKUs)
- Esencial, Gestion Plus, Nube, Plus, Premium

## Notas
- Ecuador no tiene una familia CONTADOR separada en el cálculo de SP
  (los planes "Contador N" pertenecen a FE).
- Los registros en `ventas_diarias` ya vienen pre-categorizados como
  `producto = 'FE' | 'NUBE' | 'CONTADOR'`. La categoría `CONTADOR`
  excedente que aparece en datos históricos no suma SP de convención.
