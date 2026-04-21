---
name: product-families-uruguay
description: Mapeo oficial de SKUs Siigo a familias FE y NUBE para Uruguay. Base para medallas, retos y cálculo de SP por familia.
type: feature
---

# Familias de Productos — Uruguay (pais = "URU")

Fuente única de verdad: `src/lib/product-families.ts` (`PRODUCT_FAMILIES_BY_COUNTRY.URU`).

## Familia FE (13 SKUs)
- API, FE (5 Doc), FE (5 Doc 2023), FE (50 Doc), FE (100 Doc),
  FE (Geocom), FE (Libre), FE (Literal E) POS, FE (Monotributo),
  FE (PRO), FE (Resonance), POS, POS Movil

## Familia NUBE (18 SKUs)
- Emprendedor, Figaro, Figaro + FE, Figaro Educativo
- POS, Premium, Pyme
- Recibos SE, Recibos SE 1 a 15, Recibos SE 16 a 30,
  Recibos SE 31 a 60, Recibos SE 60 a 120
- Worky, Worky Educativo
- Contador, Conty Educativo, Conty Educativo(Inst), Conty Full

## Notas
- "POS" aparece tanto en FE como en NUBE: cuando el SKU es ambiguo se
  resuelve usando el catálogo de Databricks (`tipo_producto`) que ya
  pre-categoriza el registro a `FE` o `NUBE`.
- Los planes "Contador" y "Conty" en Uruguay forman parte de NUBE
  (a diferencia de Colombia, donde "Contador" es familia separada).
