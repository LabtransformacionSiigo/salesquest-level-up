---
name: product-family-application
description: Cómo se aplica el mapeo de familias FE/NUBE/CONTADOR en cálculo de unidades, ACV, medallas y retos.
type: feature
---

# Aplicación del mapeo de familias

## Fuente única
`src/lib/product-families.ts` exporta:
- `PRODUCT_FAMILIES_BY_COUNTRY` — listas oficiales por país.
- `resolveProductFamily(producto, pais)` — clasifica un SKU.
- `getSkusForCountry(pais, family?)` — SKUs disponibles para selectores.
- `getFamiliesForCountry(pais)` — familias válidas (MEX no tiene CONTADOR).
- `SUPPORTED_COUNTRIES`, `COUNTRY_LABELS`.

## Cálculo de unidades / ACV (Aliados / Empresarios)
La fuente de verdad para los conteos por familia es la tabla
`ejecucion_asesores`, que ya viene pre-categorizada desde Databricks
(`ventas_fe`, `ventas_nube`, `ventas_total`, `acv_total`). El hook
`useGamificationMetrics` agrega estos campos por equipo y por mes y los
expone en `ejecucion` y `metaAsesor`. **No se reclasifica en cliente**;
la utilidad sirve para validar y para los selectores de admin.

## Admin Medallas (`AdminMedallas.tsx`)
Form con selectores en cascada:
1. **País** (COL, ECU, MEX, URU) — define el set de SKUs y familias.
2. **Familia** (FE / NUBE / CONTADOR según país) — limita el SKU.
3. **Producto** (SKU oficial) — opcional; vacío = aplica a toda la familia.

`familia` se usa solo en UI; al guardar se persiste `pais`, `producto`,
`canal`, `condicion_tipo` en `catalogo_medallas`.

## Admin Retos / Especialista (`AdminEspecialista.tsx`)
El selector "Familia" del EditDrawer ahora se filtra dinámicamente con
`getFamiliesForCountry(form.pais)` para evitar combinaciones inválidas
(ej. `pais=MEX, familia=CONTADOR`).

## Reglas duras
- **CONTADOR** nunca suma a FE ni a NUBE para SP de convención.
- **México**: "Nube Facturacion" y "Nube Facturacion Duo" son **FE**, no NUBE.
- **México** no tiene familia CONTADOR.
- **Ecuador**: "Contador 3/5/10/15/Ilimitado" pertenecen a **FE**.
