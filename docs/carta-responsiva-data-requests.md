# Carta Responsiva — Data requests for Isa / Dani

Use this checklist when gathering inputs to seed production data. Development can proceed with sample data until these arrive.

## From Isa

- [ ] **Sucursales** — full list with names aligned to Cotizador where possible
- [ ] **Responsables** — per sucursal: people allowed to appear on / generate cartas (nombre completo)
- [ ] **Catálogo por sucursal** — export from Power App / SharePoint: código, descripción, unidad de medida, precio
- [ ] **PDF legal text** — exact wording from current Power App carta responsiva (Mercancía Abordo terms)
- [ ] **Admin users** — emails for Isa and other admins (`rol: admin`)
- [ ] **Operator users** — emails per sucursal for gerentes / AVEs / jefes de almacén (`rol: operador`, optional `id_sucursal`)

## From Dani

- [ ] **Inventory refresh policy** — one of:
  - Periodic SAP import (frequency TBD)
  - Seed once + admin/operator add-code only (current v1 default)
  - Request-to-Isa workflow for new codes

## Format suggestions

| Dataset | Preferred format |
|---------|------------------|
| Sucursales | CSV: `nombre`, `prefijo_folio`, `region` |
| Responsables | CSV: `sucursal_nombre`, `nombre` |
| Catálogo | CSV per sucursal or one file with `sucursal_nombre`, `codigo`, `descripcion`, `unidad_medida`, `precio` |
| Usuarios | CSV: `email`, `nombre_completo`, `rol`, `sucursal_nombre` (optional), `password` (initial) |

## Portal configuration

- Register app slug: `carta-responsiva` in SO Portal
- Set `PORTAL_HANDOFF_SECRET` (shared with portal)
- Set `NEXT_PUBLIC_PORTAL_URL` for production redirects

## Notes

- Folio prefix should match sucursal `prefijo_folio` (e.g. `MER-20260717-...`)
- Product prices are snapshotted on the carta at generation time
- Seguimiento / returns tracking is **not** in v1 scope
