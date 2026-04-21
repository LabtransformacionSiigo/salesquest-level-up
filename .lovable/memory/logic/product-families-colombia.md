---
name: product-families-colombia
description: Mapeo oficial de SKUs Siigo a familias FE, NUBE y CONTADOR para Colombia. Base para medallas, retos y cálculo de SP por familia.
type: feature
---

# Familias de Productos — Colombia (pais = "COL")

Fuente única de verdad: `src/lib/product-families.ts` (`PRODUCT_FAMILIES_BY_COUNTRY.COL`).

## Familia FE (23 SKUs)
Facturación Electrónica + Nómina + POS:
- FE (24 Doc), FE (24 Doc) WP, FE (60 Doc), FE (80 Doc), FE (100 Doc),
  FE (120 Doc), FE (120 Doc) WP, FE (260 Doc), FE (300 Doc), FE (1500 Doc), FE PRO
- Nomina Base, Nomina Lite 2 (24 Doc), Nomina Lite 10 (120 Doc),
  Nomina Lite 25 (300 Doc), Nomina Plus, Nomina Pro
- POS, POS INICIO, POS AVANZADO, POS ESENCIAL, Pos Gastrobar PRO, Siigo POS

## Familia NUBE (11 SKUs)
- Contai Ili, Mto, Nomina Ili
- Nuevo Siigo Nube, Nuevo Siigo Nube Emprendedor, Nuevo Siigo Nube Premium
- Nube Profesional Independiente
- SCI Ili, SCI - Fusionado Ili
- Siigo Nube Lite, Siigo Pyme

## Familia CONTADOR (1 SKU)
- Contador

CONTADOR **no cuenta** como FE ni como NUBE para SP de convención.

## Notas
- En `ventas_diarias` los registros COL ya vienen pre-categorizados con
  `producto = 'FE' | 'NUBE' | 'CONTADOR'` (no SKU detallado), por lo que
  el conteo agregado proviene directamente de `ejecucion_asesores.ventas_fe`,
  `ventas_nube`, `ventas_total`.
- Los SKUs detallados se usan en los selectores de Admin (Medallas/Retos)
  para definir reglas a nivel de producto cuando aplique.
