#!/usr/bin/env python3
"""
Import historical Cartas Responsivas from a SharePoint/Excel export into cr_cartas / cr_carta_items.

BLOCKED until you provide the export file. Do not run against production without a dry-run first.

Required export columns (header names are matched case-insensitively; aliases accepted):
  - folio                  (unique; idempotent key)
  - fecha / created_at     (ISO or Excel date)
  - centro / codigo_sap / sucursal  (branch code preferred; name fallback)
  - responsable            (nombre_responsable snapshot)
  - codigo                 (line item SKU)
  - descripcion            (line item description)
  - cantidad
  - unidad / unidad_medida (optional)
  - precio                 (optional; default 0)
  - subtotal / iva / total (optional; recomputed from lines if missing)

Environment (same as other Carta importers):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Usage:
  python3 scripts/import-cartas-history.py --file path/to/cartas.xlsx --dry-run
  python3 scripts/import-cartas-history.py --file path/to/cartas.xlsx --apply

Idempotent by folio: existing cartas are skipped (or replaced with --replace).
Unknown centros (no matching cr_sucursales.codigo_sap / nombre) are skipped and logged.
Cartas are attributed to --user-email (must exist in cr_usuarios).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from openpyxl import load_workbook

TERMS_PLACEHOLDER = (
    "Términos Mercancía Abordo (importación histórica). "
    "Ver documento oficial vigente al momento de la firma."
)


def clean(value):
    return " ".join(str(value or "").strip().split())


def normalized(value):
    decomposed = unicodedata.normalize("NFD", clean(value))
    return "".join(char for char in decomposed if not unicodedata.combining(char)).upper()


def money(value) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    if isinstance(value, Decimal):
        amount = value
    else:
        amount = Decimal(str(value).replace(",", "").strip() or "0")
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def api_request(path, method="GET", payload=None, prefer=None):
    base_url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
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
            return json.loads(content) if content else None
    except urllib.error.HTTPError as error:
        detail = error.read().decode()
        raise RuntimeError(f"{method} {path}: {error.code} {detail}") from error


HEADER_ALIASES = {
    "folio": {"folio", "no_folio", "numero_folio", "carta"},
    "fecha": {"fecha", "created_at", "fecha_carta", "date"},
    "centro": {"centro", "codigo_sap", "sap", "sucursal", "branch", "nombre_sucursal"},
    "responsable": {"responsable", "nombre_responsable", "nombre"},
    "codigo": {"codigo", "sku", "material", "codigo_material"},
    "descripcion": {"descripcion", "descripción", "concepto", "producto"},
    "cantidad": {"cantidad", "qty", "cant"},
    "unidad": {"unidad", "unidad_medida", "um", "uom"},
    "precio": {"precio", "precio_unitario", "unit_price"},
    "subtotal": {"subtotal"},
    "iva": {"iva", "tax"},
    "total": {"total"},
}


def map_headers(row):
    mapping = {}
    for idx, cell in enumerate(row):
        key = normalized(cell).replace(" ", "_")
        for field, aliases in HEADER_ALIASES.items():
            if key in {normalized(a).replace(" ", "_") for a in aliases}:
                mapping[field] = idx
                break
    required = ["folio", "centro", "responsable", "codigo", "descripcion", "cantidad"]
    missing = [name for name in required if name not in mapping]
    if missing:
        raise SystemExit(f"Missing required columns: {', '.join(missing)}")
    return mapping


def parse_date(value):
    if value is None or value == "":
        return datetime.now(timezone.utc).isoformat()
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    text = clean(value)
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    return datetime.now(timezone.utc).isoformat()


def load_rows(path, sheet_name=None):
    workbook = load_workbook(path, data_only=True, read_only=True)
    sheet = workbook[sheet_name] if sheet_name else workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        raise SystemExit("Empty workbook")
    headers = map_headers(rows[0])
    grouped = defaultdict(lambda: {"meta": None, "items": []})
    for row in rows[1:]:
        if not row or all(cell is None or str(cell).strip() == "" for cell in row):
            continue
        folio = clean(row[headers["folio"]])
        if not folio:
            continue
        if grouped[folio]["meta"] is None:
            grouped[folio]["meta"] = {
                "folio": folio,
                "fecha": parse_date(row[headers["fecha"]] if "fecha" in headers else None),
                "centro": clean(row[headers["centro"]]),
                "responsable": clean(row[headers["responsable"]]),
                "subtotal": money(row[headers["subtotal"]]) if "subtotal" in headers else None,
                "iva": money(row[headers["iva"]]) if "iva" in headers else None,
                "total": money(row[headers["total"]]) if "total" in headers else None,
            }
        grouped[folio]["items"].append(
            {
                "codigo": clean(row[headers["codigo"]]).upper(),
                "descripcion": clean(row[headers["descripcion"]]),
                "cantidad": float(row[headers["cantidad"]] or 0),
                "unidad_medida": clean(row[headers["unidad"]]) if "unidad" in headers else None,
                "precio": float(money(row[headers["precio"]]) if "precio" in headers else 0),
            }
        )
    return grouped


def load_branches():
    data = api_request("cr_sucursales?select=id,nombre,codigo_sap,iva_porcentaje&activo=eq.true")
    by_sap = {}
    by_name = {}
    for branch in data or []:
        if branch.get("codigo_sap"):
            by_sap[normalized(branch["codigo_sap"])] = branch
        by_name[normalized(branch["nombre"])] = branch
    return by_sap, by_name


def resolve_user(email: str):
    encoded = urllib.parse.quote(email.strip().lower())
    rows = api_request(f"cr_usuarios?select=id,email&email=eq.{encoded}&limit=1")
    if not rows:
        raise SystemExit(f"User not found in cr_usuarios: {email}")
    return rows[0]


def folio_exists(folio: str) -> str | None:
    encoded = urllib.parse.quote(folio)
    rows = api_request(f"cr_cartas?select=id&folio=eq.{encoded}&limit=1")
    return rows[0]["id"] if rows else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, help="Path to SharePoint/Excel Cartas export")
    parser.add_argument("--sheet", default=None)
    parser.add_argument("--user-email", required=True, help="cr_usuarios email for id_usuario")
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--apply", action="store_true", help="Write to database (disables dry-run)")
    parser.add_argument("--replace", action="store_true", help="Delete+reinsert existing folios")
    args = parser.parse_args()

    dry_run = not args.apply
    if "NEXT_PUBLIC_SUPABASE_URL" not in os.environ or "SUPABASE_SERVICE_ROLE_KEY" not in os.environ:
        raise SystemExit("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")

    if not os.path.isfile(args.file):
        raise SystemExit(f"File not found: {args.file}\nProvide the Cartas history export, then re-run.")

    user = resolve_user(args.user_email)
    by_sap, by_name = load_branches()
    grouped = load_rows(args.file, args.sheet)

    created = skipped = unknown = 0
    for folio, payload in grouped.items():
        meta = payload["meta"]
        items = [item for item in payload["items"] if item["codigo"] and item["cantidad"] > 0]
        if not items:
            skipped += 1
            continue

        branch = by_sap.get(normalized(meta["centro"])) or by_name.get(normalized(meta["centro"]))
        if not branch:
            print(f"SKIP unknown centro: {meta['centro']} (folio {folio})")
            unknown += 1
            continue

        existing_id = folio_exists(folio)
        if existing_id and not args.replace:
            print(f"SKIP existing folio: {folio}")
            skipped += 1
            continue

        subtotal = sum(Decimal(str(i["cantidad"])) * Decimal(str(i["precio"])) for i in items)
        subtotal = money(subtotal)
        iva_pct = Decimal(str(branch.get("iva_porcentaje") or 16))
        iva = money(subtotal * iva_pct / Decimal("100"))
        total = money(subtotal + iva)
        if meta["subtotal"] is not None:
            subtotal = meta["subtotal"]
        if meta["iva"] is not None:
            iva = meta["iva"]
        if meta["total"] is not None:
            total = meta["total"]

        print(
            f"{'DRY' if dry_run else 'WRITE'} {folio} → {branch['nombre']} "
            f"({len(items)} items, total {total})"
        )
        if dry_run:
            created += 1
            continue

        if existing_id and args.replace:
            api_request(f"cr_cartas?id=eq.{existing_id}", method="DELETE")

        carta = api_request(
            "cr_cartas",
            method="POST",
            prefer="return=representation",
            payload={
                "folio": folio,
                "id_sucursal": branch["id"],
                "id_responsable": None,
                "nombre_responsable": meta["responsable"] or "SIN RESPONSABLE",
                "id_usuario": user["id"],
                "terminos_snapshot": TERMS_PLACEHOLDER,
                "subtotal": float(subtotal),
                "iva": float(iva),
                "total": float(total),
                "created_at": meta["fecha"],
                "updated_at": meta["fecha"],
            },
        )
        carta_id = carta[0]["id"]
        api_request(
            "cr_carta_items",
            method="POST",
            prefer="return=minimal",
            payload=[
                {
                    "id_carta": carta_id,
                    "id_catalogo": None,
                    "codigo": item["codigo"],
                    "descripcion": item["descripcion"],
                    "cantidad": item["cantidad"],
                    "unidad_medida": item["unidad_medida"] or None,
                    "precio": item["precio"],
                }
                for item in items
            ],
        )
        created += 1

    print(
        f"Done. processed={created} skipped={skipped} unknown_centros={unknown} "
        f"mode={'dry-run' if dry_run else 'apply'}"
    )
    if dry_run:
        print("Re-run with --apply to write.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
