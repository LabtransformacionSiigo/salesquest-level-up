"""Lectura del catálogo oficial de productos facturables LATAM (Excel).

El archivo trae un título en las primeras filas; la tabla empieza en la fila
cuyo primer encabezado es "Codigo producto". Los códigos se tratan siempre como
texto: varios empiezan por ceros (p. ej. 0020001000001) y otros son
alfanuméricos (UY130, MOD-065).
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

HEADER_MARKER = "codigo producto"
COLUMNS = {"codigo producto": "codigo", "nombre producto": "nombre"}


class CatalogError(ValueError):
    pass


@dataclass(frozen=True)
class Product:
    codigo: str
    nombre: str


def _norm_header(value) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _code(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    return text or None


def load_catalog(path: str | Path) -> dict[str, Product]:
    """Devuelve {codigo -> Product}. Si un código aparece varias veces (una fila
    por cada código homologado) se conserva la primera."""
    import openpyxl  # dependencia solo del pipeline

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        ws = wb.worksheets[0]
        rows = ws.iter_rows(values_only=True)
        index: dict[str, int] | None = None
        for row in rows:
            if row and _norm_header(row[0]) == HEADER_MARKER:
                index = {COLUMNS[h]: i for i, h in enumerate(map(_norm_header, row)) if h in COLUMNS}
                break
        if index is None or "codigo" not in index or "nombre" not in index:
            raise CatalogError(f"No se encontró la fila de encabezados '{HEADER_MARKER}' en {path}")

        catalog: dict[str, Product] = {}
        numeric_codes = 0
        for row in rows:
            raw = row[index["codigo"]] if len(row) > index["codigo"] else None
            if isinstance(raw, (int, float)):
                numeric_codes += 1
            codigo = _code(raw)
            if not codigo or codigo in catalog:
                continue
            nombre = row[index["nombre"]] if len(row) > index["nombre"] else None
            catalog[codigo] = Product(codigo=codigo, nombre=str(nombre or "").strip())
    finally:
        wb.close()

    if not catalog:
        raise CatalogError(f"El catálogo {path} no tiene productos")
    if numeric_codes:
        # Una celda numérica pierde los ceros a la izquierda: el Excel debe
        # guardar la columna de códigos como texto.
        raise CatalogError(
            f"{numeric_codes} códigos están guardados como número en {path}; "
            "formatea la columna 'Codigo producto' como texto para no perder ceros iniciales"
        )
    return catalog
