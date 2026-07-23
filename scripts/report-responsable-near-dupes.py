#!/usr/bin/env python3
"""
Report near-duplicate responsables within the same sucursal.

Flags pairs where one normalized name is a prefix of the other (e.g.
TOMAS ADRIAN NAJERA vs TOMAS ADRIAN NAJERA CHAVEZ), or token Jaccard
similarity is high. Does NOT auto-merge — output is for manual review.

Usage:
  python3 scripts/report-responsable-near-dupes.py
  python3 scripts/report-responsable-near-dupes.py --csv near-dupes.csv
  python3 scripts/report-responsable-near-dupes.py --min-jaccard 0.7

Environment:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import unicodedata
import urllib.error
import urllib.request
from typing import Dict, List, Optional, Set


def clean(value) -> str:
    return " ".join(str(value or "").strip().split())


def normalized(value) -> str:
    decomposed = unicodedata.normalize("NFD", clean(value))
    return "".join(char for char in decomposed if not unicodedata.combining(char)).upper()


def api_request(path: str):
    base_url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }
    request = urllib.request.Request(
        f"{base_url}/rest/v1/{path}",
        headers=headers,
        method="GET",
    )
    try:
        with urllib.request.urlopen(request) as response:
            content = response.read()
            return json.loads(content) if content else []
    except urllib.error.HTTPError as error:
        detail = error.read().decode()
        raise RuntimeError(f"GET {path}: {error.code} {detail}") from error


def api_get_all(path: str):
    rows = []
    offset = 0
    page = 1000
    while True:
        sep = "&" if "?" in path else "?"
        chunk = api_request(f"{path}{sep}limit={page}&offset={offset}")
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < page:
            break
        offset += page
    return rows


def token_set(name: str) -> Set[str]:
    return {part for part in name.split() if part}


def jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def pair_reason(left: str, right: str, min_jaccard: float) -> Optional[str]:
    if left == right:
        return "exact_normalized"
    shorter, longer = (left, right) if len(left) <= len(right) else (right, left)
    if longer.startswith(shorter + " ") or longer.startswith(shorter):
        # Require at least 2 tokens in the shorter name to avoid "ANA" noise
        if len(shorter.split()) >= 2:
            return "prefix"
    score = jaccard(token_set(left), token_set(right))
    if score >= min_jaccard and len(token_set(left) & token_set(right)) >= 2:
        return f"jaccard:{score:.2f}"
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", help="Write pairs to this CSV path")
    parser.add_argument(
        "--min-jaccard",
        type=float,
        default=0.75,
        help="Minimum token Jaccard similarity (default 0.75)",
    )
    parser.add_argument(
        "--include-inactive",
        action="store_true",
        help="Include inactive responsables",
    )
    args = parser.parse_args()

    if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or not os.environ.get(
        "SUPABASE_SERVICE_ROLE_KEY"
    ):
        raise SystemExit(
            "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
        )

    path = (
        "cr_responsables?select=id,id_sucursal,nombre,nombre_normalizado,activo,"
        "cr_sucursales(nombre,codigo_sap)"
    )
    if not args.include_inactive:
        path += "&activo=eq.true"

    rows = api_get_all(path)
    by_branch: Dict[str, List] = {}
    for row in rows:
        by_branch.setdefault(row["id_sucursal"], []).append(row)

    pairs = []
    for branch_id, items in by_branch.items():
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                left = items[i]
                right = items[j]
                left_key = left.get("nombre_normalizado") or normalized(left["nombre"])
                right_key = right.get("nombre_normalizado") or normalized(right["nombre"])
                reason = pair_reason(left_key, right_key, args.min_jaccard)
                if not reason:
                    continue
                branch = left.get("cr_sucursales") or {}
                pairs.append(
                    {
                        "id_sucursal": branch_id,
                        "sucursal": branch.get("nombre") or "",
                        "codigo_sap": branch.get("codigo_sap") or "",
                        "reason": reason,
                        "id_a": left["id"],
                        "nombre_a": left["nombre"],
                        "activo_a": left.get("activo"),
                        "id_b": right["id"],
                        "nombre_b": right["nombre"],
                        "activo_b": right.get("activo"),
                        "sugerido_survivor": (
                            left["id"]
                            if len(left["nombre"]) >= len(right["nombre"])
                            else right["id"]
                        ),
                        "sugerido_nombre": (
                            left["nombre"]
                            if len(left["nombre"]) >= len(right["nombre"])
                            else right["nombre"]
                        ),
                    }
                )

    pairs.sort(key=lambda p: (p["sucursal"], p["nombre_a"], p["nombre_b"]))

    print(f"Responsables leídos: {len(rows)}")
    print(f"Pares cercanos: {len(pairs)}")
    for pair in pairs[:50]:
        print(
            f"- {pair['sucursal']} ({pair['codigo_sap']}): "
            f"{pair['nombre_a']}  <->  {pair['nombre_b']}  [{pair['reason']}]"
        )
    if len(pairs) > 50:
        print(f"... y {len(pairs) - 50} más")

    if args.csv:
        fieldnames = [
            "id_sucursal",
            "sucursal",
            "codigo_sap",
            "reason",
            "id_a",
            "nombre_a",
            "activo_a",
            "id_b",
            "nombre_b",
            "activo_b",
            "sugerido_survivor",
            "sugerido_nombre",
        ]
        with open(args.csv, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(pairs)
        print(f"CSV escrito: {args.csv}", file=sys.stderr)

    return 0 if pairs else 0


if __name__ == "__main__":
    raise SystemExit(main())
