"""Pipeline de códigos de producto para la app de Databricks `prorrateo`.

Uso (desde la raíz del repo):
  python -m pipelines.product_codes.cli validate --catalog data/productos/Productos_LATAM.xlsx
  python -m pipelines.product_codes.cli plan  --catalog ... --app prorrateo --out build/product-codes
  python -m pipelines.product_codes.cli apply --catalog ... --app prorrateo --out build/product-codes

- validate: solo revisa el catálogo (y una lista local con --price-list). No usa red.
- plan:     descarga las listas de precios de la app y muestra qué códigos cambiarían.
- apply:    igual que plan, escribe las listas corregidas y redespliega la app.

La app sirve la lista publicada por un admin (`<DATA_DIR>/price_list.json`) y, si
no hay ninguna, la semilla del código (`<source>/seed/price_list.json`). El
pipeline corrige las dos para que no reaparezcan códigos viejos.

Termina con código 1 si algún código no existe en el catálogo.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .catalog import load_catalog
from .price_list import Report, update_price_list


@dataclass
class Target:
    key: str          # nombre corto para archivos y reporte
    path: str         # ruta en el workspace
    redeploy: bool    # la app solo lee la semilla al desplegar


def _summary(text: str) -> None:
    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(text + "\n")


SEED = "seed/price_list.json"


def _targets(db, app_name: str) -> tuple[list[Target], str, str | None]:
    """Devuelve (archivos a corregir, carpeta de código fuente, carpeta del snapshot desplegado)."""
    app = db.get_app(app_name)
    active = app.get("active_deployment") or {}
    source = app.get("default_source_code_path") or active.get("source_code_path")
    if not source:
        raise SystemExit(f"La app {app_name} no tiene source_code_path")
    data_dir = os.environ.get("PRORRATEO_DATA_DIR")
    if not data_dir:
        sp = app.get("service_principal_client_id")
        if not sp:
            raise SystemExit(f"La app {app_name} no tiene service principal; define PRORRATEO_DATA_DIR")
        data_dir = f"/Workspace/Users/{sp}/prorrateo-data"
    deployed = (active.get("deployment_artifacts") or {}).get("source_code_path")
    return [
        Target("seed", f"{source.rstrip('/')}/{SEED}", redeploy=True),
        Target("published", f"{data_dir.rstrip('/')}/price_list.json", redeploy=False),
    ], source, deployed


def cmd_validate(args) -> int:
    catalog = load_catalog(args.catalog)
    print(f"Catálogo OK: {len(catalog)} códigos de producto en {args.catalog}")
    if not args.price_list:
        return 0
    data = json.loads(Path(args.price_list).read_text(encoding="utf-8"))
    _, report = update_price_list(data, catalog)
    _summary(report.to_markdown())
    return 0 if report.ok else 1


def cmd_sync(args, apply: bool) -> int:
    from .databricks import Databricks

    catalog = load_catalog(args.catalog)
    db = Databricks()
    targets, source, deployed = _targets(db, args.app)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    pending: list[tuple[Target, dict, dict, Report]] = []
    for t in targets:
        current = db.read_json(t.path)
        if current is None:
            _summary(f"_{t.key}: `{t.path}` no existe, se omite._\n")
            continue
        (out / f"{t.key}.before.json").write_text(json.dumps(current, ensure_ascii=False, indent=1), encoding="utf-8")
        updated, report = update_price_list(current, catalog)
        (out / f"{t.key}.after.json").write_text(json.dumps(updated, ensure_ascii=False, indent=1), encoding="utf-8")
        _summary(f"**{t.key}** — `{t.path}`\n\n" + report.to_markdown())
        pending.append((t, current, updated, report))

    if not pending:
        print("No se encontró ninguna lista de precios.", file=sys.stderr)
        return 1
    if any(not r.ok for *_, r in pending):
        print("Hay códigos sin resolver: no se escribe nada.", file=sys.stderr)
        return 1
    changed = [(t, before, after) for t, before, after, r in pending if r.changes]

    # La app carga la semilla al arrancar: si el snapshot desplegado no tiene la
    # semilla actual (p. ej. un despliegue anterior falló tras escribirla), hay
    # que redesplegar aunque esta corrida no cambie nada.
    seed_now = next((after for t, _, after, _ in pending if t.key == "seed"), None)
    stale_deploy = bool(deployed) and seed_now is not None and db.read_json(f"{deployed.rstrip('/')}/{SEED}") != seed_now
    needs_deploy = stale_deploy or any(t.redeploy for t, *_ in changed)

    if not changed and not needs_deploy:
        _summary("Sin cambios: todos los códigos ya coinciden con el catálogo y la app está al día.")
        return 0
    if not apply:
        _summary(
            f"Plan: se actualizarían {len(changed)} archivo(s)"
            + (" y se redesplegaría la app" if needs_deploy else "")
            + ". Ejecuta `apply` para aplicarlo."
        )
        return 0

    stamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    for t, before, updated in changed:
        # Evita pisar una lista que alguien publicó mientras corría el pipeline.
        if db.read_json(t.path) != before:
            print(f"{t.path} cambió durante la ejecución; vuelve a correr el pipeline.", file=sys.stderr)
            return 1
        if t.key == "published":
            updated["codesSyncedAt"] = stamp
            # Misma convención de historial que usa la app al publicar.
            history = t.path.rsplit("/", 1)[0] + f"/price_lists/{stamp.replace(':', '-').replace('.', '-')}.json"
            db.write_json(history, updated)
        db.write_json(t.path, updated)
        _summary(f"Escrito `{t.path}`")

    if needs_deploy and not args.no_deploy:
        dep = db.deploy_app(args.app, source)
        _summary(f"App `{args.app}` redesplegada (deployment `{dep['deployment_id']}`).")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="product_codes", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("validate", "plan", "apply"):
        s = sub.add_parser(name)
        s.add_argument("--catalog", required=True, help="Excel de productos facturables LATAM")
        if name == "validate":
            s.add_argument("--price-list", help="price_list.json local a verificar")
        else:
            s.add_argument("--app", default=os.environ.get("PRORRATEO_APP_NAME", "prorrateo"))
            s.add_argument("--out", default="build/product-codes", help="carpeta para los JSON antes/después")
        if name == "apply":
            s.add_argument("--no-deploy", action="store_true", help="escribe los archivos sin redesplegar la app")
    args = p.parse_args(argv)
    if args.cmd == "validate":
        return cmd_validate(args)
    return cmd_sync(args, apply=args.cmd == "apply")


if __name__ == "__main__":
    sys.exit(main())
