"""Actualiza los códigos de producto de la lista de precios de la calculadora
`prorrateo` contra el catálogo oficial.

Reglas, por cada código de la lista (`products[].codigo` y `nominaAntigua[].codigo`):
  1. Existe tal cual en el catálogo            -> se conserva.
  2. Es numérico, tiene menos de 13 dígitos y
     rellenado con ceros a la izquierda existe -> se corrige (Excel le quitó los ceros).
  3. Ninguna de las anteriores                 -> queda sin resolver y el pipeline falla.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field

CODE_LENGTH = 13
SECTIONS = ("products", "nominaAntigua")


@dataclass
class Change:
    section: str
    position: int
    before: str
    after: str
    nombre_catalogo: str


@dataclass
class Report:
    total: int = 0
    unchanged: int = 0
    changes: list[Change] = field(default_factory=list)
    unresolved: list[tuple[str, int, str]] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.unresolved

    def to_markdown(self) -> str:
        lines = [
            "### Códigos de producto — lista de precios `prorrateo`",
            "",
            f"- Códigos revisados: **{self.total}**",
            f"- Ya correctos: **{self.unchanged}**",
            f"- Corregidos: **{len(self.changes)}**",
            f"- Sin resolver: **{len(self.unresolved)}**",
        ]
        if self.changes:
            lines += ["", "| Sección | # | Antes | Después | Producto en catálogo |", "|---|---|---|---|---|"]
            lines += [
                f"| {c.section} | {c.position} | `{c.before}` | `{c.after}` | {c.nombre_catalogo.replace('|', '/')} |"
                for c in self.changes
            ]
        if self.unresolved:
            lines += ["", "**Sin resolver** (no existen en el catálogo):", ""]
            lines += [f"- {s}[{i}] `{code}`" for s, i, code in self.unresolved]
        return "\n".join(lines) + "\n"


def resolve_code(code: str, catalog) -> str | None:
    if code in catalog:
        return code
    if code.isdigit() and len(code) < CODE_LENGTH:
        padded = code.zfill(CODE_LENGTH)
        if padded in catalog:
            return padded
    return None


def update_price_list(price_list: dict, catalog) -> tuple[dict, Report]:
    """Devuelve una copia actualizada de la lista y el reporte. No modifica la entrada."""
    if not isinstance(price_list, dict) or not isinstance(price_list.get("products"), list):
        raise ValueError("La lista de precios no tiene el arreglo 'products'")
    updated = copy.deepcopy(price_list)
    report = Report()
    for section in SECTIONS:
        items = updated.get(section) or []
        for i, item in enumerate(items):
            if not isinstance(item, dict) or "codigo" not in item:
                continue
            report.total += 1
            code = str(item["codigo"]).strip()
            resolved = resolve_code(code, catalog)
            if resolved is None:
                report.unresolved.append((section, i, code))
            elif resolved == item["codigo"]:
                report.unchanged += 1
            else:
                item["codigo"] = resolved
                report.changes.append(Change(section, i, code, resolved, catalog[resolved].nombre))
    return updated, report
