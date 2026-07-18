# Carta Responsiva — Product Brief (cleaned transcript)

## Context

Branch managers take unsold, uninvoiced material under the **Mercancía Abordo** scheme. They need a signed **carta responsiva** acknowledging receipt of company material before leaving the branch.

Previously this was done manually (Word) or via a Power Apps + SharePoint + Power Automate stack built with Lili and Kevin.

## Problem with Power App

- Access issues: SharePoint lists, Power App, Power Automate permissions must be granted separately
- PDF generation failures
- Missing products, sellers, or branch data
- Manual registration step users forget → no compliance visibility
- Seguimiento tab broken (folio matching issues)
- Inventory lists stale: SAP exports took ~4 hours via Power Automate; Kevin only refreshed ~3 times; Isa manually adds missing product codes

## Goal

Migrate to the SO Portal ecosystem (same pattern as Cotizador / Permisos):

1. Reliable PDF generation (like Cotizador)
2. Automatic registration when a carta is generated
3. Admin view for Isa: who generated / who did not (by sucursal / period)

## v1 Scope

### In

- Select **sucursal** → **responsable** → products from branch catalog → quantities → **Generar carta**
- PDF with: responsible person statement, table (código, descripción, cantidad, UM, precio), Mercancía Abordo terms, responsible name for signature
- Auto-save on generate (folio on letter from day one)
- Edit carta after create (like Cotizador)
- Admin: historial, compliance report, catalog maintenance (add codes per sucursal)
- Desktop-first, responsive for mobile (same bar as Cotizador)

### Out (v1)

- Seguimiento (returns, remisiones, devoluciones)
- Live SAP inventory sync

## Business rules

- **Desired:** at least one carta per month per branch; Mondays start the week; unsold material returns same day or by Friday
- **Reality:** low compliance today due to Power App friction
- Primary users: AVEs, jefes de almacén (PC); gerentes/vendedores sometimes on mobile

## Inventory approach (v1)

Initial seed import + admin add-code per sucursal (matches Isa’s current workaround). Periodic SAP refresh policy pending Dani decision.

## Stakeholders

- **Isa** — product owner, admin compliance
- **Dani** — inventory refresh policy
- **Kevin** — historical SAP export process (reference only)
