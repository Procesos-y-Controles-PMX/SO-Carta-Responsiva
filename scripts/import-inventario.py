#!/usr/bin/env python3
"""
Import SAP branch inventory into cr_catalogo.

Source format: UTF-16 TSV (often saved as .XLS / .xls from SAP exports) with columns:
  Centro, Nombre 1, SKU, Material, Libre utilización, UMB, Valor libre util., Precio Antes IVA

Maps:
  Centro            -> cr_sucursales.codigo_sap
  SKU               -> cr_catalogo.codigo
  Material          -> cr_catalogo.descripcion
  UMB               -> cr_catalogo.unidad_medida
  Precio Antes IVA  -> cr_catalogo.precio

Environment:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Usage:
  python3 scripts/import-inventario.py --file path/to/Inventario.XLS --dry-run
  python3 scripts/import-inventario.py --file path/to/Inventario.XLS --apply
  python3 scripts/import-inventario.py --file path/to/Inventario.XLS --apply --deactivate-missing
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import urllib.error
import urllib.request
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


BATCH_SIZE = 500


def clean(value) -> str:
    return " ".join(str(value or "").strip().split())


def money(value) -> Decimal:
    if value is None or value == "":
        return Decimal("0.00")
    text = str(value).strip().replace("$", "").replace(",", "").replace('"', "")
    try:
        amount = Decimal(text or "0")
    except InvalidOperation:
        amount = Decimal("0")
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def api_request(path, method="GET", payload=None, prefer=None, extra_headers=None):
    base_url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    if extra_headers:
        headers.update(extra_headers)
    body = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        f"{base_url}/rest/v1/{path}",
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request) as response:
            content = response.read()
            return json.loads(content) if content else None, response.headers
    except urllib.error.HTTPError as error:
        detail = error.read().decode()
        raise RuntimeError(f"{method} {path}: {error.code} {detail}") from error


def api_get_all(path: str):
    """Paginate through PostgREST results (default page size 1000)."""
    rows = []
    offset = 0
    page = 1000
    while True:
        chunk, _ = api_request(
            f"{path}{'&' if '?' in path else '?'}limit={page}&offset={offset}",
            prefer="count=exact",
        )
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < page:
            break
        offset += page
    return rows


def detect_encoding(path: str) -> str:
    with open(path, "rb") as handle:
        bom = handle.read(2)
    if bom == b"\xff\xfe":
        return "utf-16"
    if bom == b"\xfe\xff":
        return "utf-16-be"
    return "utf-8-sig"


def parse_inventory(path: str):
    encoding = detect_encoding(path)
    with open(path, "r", encoding=encoding, newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters="\t,;")
        reader = csv.DictReader(handle, dialect=dialect)
        if not reader.fieldnames:
            raise SystemExit("No header row found in inventory file")

        # Normalize header whitespace (SAP exports often pad column names)
        field_map = {clean(name): name for name in reader.fieldnames}
        required = ["Centro", "SKU", "Material"]
        for name in required:
            if name not in field_map:
                raise SystemExit(
                    f"Missing column '{name}'. Found: {list(field_map)}"
                )

        centro_key = field_map["Centro"]
        sku_key = field_map["SKU"]
        material_key = field_map["Material"]
        umb_key = field_map.get("UMB")
        precio_key = next(
            (field_map[k] for k in field_map if "Precio" in k),
            None,
        )

        items = []
        skipped = 0
        for row in reader:
            centro = clean(row.get(centro_key)).upper()
            sku = clean(row.get(sku_key))
            descripcion = clean(row.get(material_key))
            if not centro or not sku or not descripcion:
                skipped += 1
                continue
            unidad = clean(row.get(umb_key)) if umb_key else ""
            precio = money(row.get(precio_key) if precio_key else None)
            items.append(
                {
                    "centro": centro,
                    "codigo": sku,
                    "descripcion": descripcion,
                    "unidad_medida": unidad or None,
                    "precio": float(precio),
                    "activo": True,
                }
            )
        return items, skipped


def chunks(items, size):
    for index in range(0, len(items), size):
        yield items[index : index + size]


def main():
    parser = argparse.ArgumentParser(description="Import SAP inventory into cr_catalogo")
    parser.add_argument("--file", required=True, help="Path to UTF-16 TSV / .XLS export")
    parser.add_argument("--dry-run", action="store_true", help="Parse and report only")
    parser.add_argument("--apply", action="store_true", help="Upsert into Supabase")
    parser.add_argument(
        "--deactivate-missing",
        action="store_true",
        help="Mark catalog rows not present in this file as activo=false (per matched branch)",
    )
    parser.add_argument(
        "--centro",
        action="append",
        default=[],
        help="Only import these SAP centers (repeatable). Default: all.",
    )
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        raise SystemExit("Pass --dry-run or --apply")

    items, skipped = parse_inventory(args.file)
    if args.centro:
        allow = {c.upper() for c in args.centro}
        items = [item for item in items if item["centro"] in allow]

    by_centro = {}
    for item in items:
        by_centro.setdefault(item["centro"], []).append(item)

    print(f"Filas válidas: {len(items)} (omitidas: {skipped})")
    print(f"Centros en archivo: {len(by_centro)}")
    for centro in sorted(by_centro):
        print(f"  {centro}: {len(by_centro[centro])} SKUs")

    if args.dry_run:
        return

    if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or not os.environ.get(
        "SUPABASE_SERVICE_ROLE_KEY"
    ):
        raise SystemExit(
            "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )

    branches = api_get_all("cr_sucursales?select=id,nombre,codigo_sap,activo")
    branch_by_centro = {
        clean(branch.get("codigo_sap")).upper(): branch
        for branch in branches
        if clean(branch.get("codigo_sap"))
    }

    missing_centros = sorted(set(by_centro) - set(branch_by_centro))
    if missing_centros:
        print("Centros sin sucursal en DB (se omiten):")
        print(json.dumps(missing_centros, ensure_ascii=False))

    upserted = 0
    matched_branch_ids = set()
    imported_keys = set()

    for centro, centro_items in sorted(by_centro.items()):
        branch = branch_by_centro.get(centro)
        if not branch:
            continue
        matched_branch_ids.add(branch["id"])
        payload = []
        for item in centro_items:
            payload.append(
                {
                    "id_sucursal": branch["id"],
                    "codigo": item["codigo"],
                    "descripcion": item["descripcion"],
                    "unidad_medida": item["unidad_medida"],
                    "precio": item["precio"],
                    "activo": True,
                }
            )
            imported_keys.add(f'{branch["id"]}:{item["codigo"]}')

        for batch in chunks(payload, BATCH_SIZE):
            api_request(
                "cr_catalogo?on_conflict=id_sucursal,codigo",
                method="POST",
                payload=batch,
                prefer="resolution=merge-duplicates,return=minimal",
            )
            upserted += len(batch)
        print(f"Upsert {centro} ({branch.get('nombre')}): {len(payload)}")

    deactivated = 0
    if args.deactivate_missing and matched_branch_ids:
        existing = api_get_all(
            "cr_catalogo?select=id,id_sucursal,codigo,activo&activo=eq.true"
        )
        to_deactivate = [
            row["id"]
            for row in existing
            if row["id_sucursal"] in matched_branch_ids
            and f'{row["id_sucursal"]}:{row["codigo"]}' not in imported_keys
        ]
        for batch in chunks(to_deactivate, BATCH_SIZE):
            ids = ",".join(batch)
            api_request(
                f"cr_catalogo?id=in.({ids})",
                method="PATCH",
                payload={"activo": False},
                prefer="return=minimal",
            )
            deactivated += len(batch)

    print(f"Upserted: {upserted}")
    print(f"Deactivated missing: {deactivated}")
    print(f"Branches touched: {len(matched_branch_ids)}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
