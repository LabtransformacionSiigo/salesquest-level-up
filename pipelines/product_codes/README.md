# Pipeline de códigos de producto — calculadora `prorrateo`

Mantiene los códigos de producto de la lista de precios de la Databricks App
`prorrateo` (Calculadora de Venta Cruzada) alineados con el catálogo oficial
`data/productos/Productos_LATAM.xlsx`.

## Cómo actualizar códigos
1. Reemplaza `data/productos/Productos_LATAM.xlsx` con la nueva exportación
   (la columna **Codigo producto** debe estar como texto para conservar ceros iniciales).
2. Abre un PR. El workflow **Códigos de producto (prorrateo)** corre pruebas,
   valida el catálogo y publica en el resumen del job el plan de cambios.
3. Al hacer merge a `main`, el job *Aplicar y desplegar* escribe la lista corregida
   en el workspace y redespliega la app.

## Reglas
- Código que existe en el catálogo → se conserva.
- Código numérico de menos de 13 dígitos cuya versión con ceros a la izquierda
  existe → se corrige (p. ej. `20001000001` → `0020001000001`).
- Cualquier otro → el pipeline falla y no escribe nada.

Se revisan `products[].codigo` y `nominaAntigua[].codigo` en:
- la semilla del código de la app: `<source_code_path>/seed/price_list.json` (requiere redespliegue);
- la lista publicada por un admin, si existe: `<DATA_DIR>/price_list.json`.

## Configuración en GitHub
Secretos del repositorio (o del environment `production`):

| Secreto | Uso |
|---|---|
| `DATABRICKS_HOST` | `https://adb-2472073628161257.17.azuredatabricks.net` |
| `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET` | OAuth M2M de un service principal (recomendado) |
| `DATABRICKS_TOKEN` | Alternativa: token personal |

La identidad usada necesita **CAN MANAGE** sobre la app `prorrateo` y permiso de
escritura en su carpeta de código fuente. Variable opcional: `PRORRATEO_APP_NAME`.

## Local
```bash
pip install -r pipelines/product_codes/requirements.txt
python -m unittest discover -s pipelines/product_codes -t . -p "test_*.py"
python -m pipelines.product_codes.cli validate --catalog data/productos/Productos_LATAM.xlsx
DATABRICKS_HOST=... DATABRICKS_TOKEN=... python -m pipelines.product_codes.cli plan --catalog data/productos/Productos_LATAM.xlsx
```
