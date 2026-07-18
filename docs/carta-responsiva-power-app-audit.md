# Carta Responsiva — Power App Audit (Generador de Carta Responsiva V2.0)

**Date:** July 17, 2026
**Scope:** Read-only audit of the live Power App (play mode), cross-referenced with the current Next.js/Supabase replacement in `carta-responsiva/frontend` and `db/carta-responsiva-schema.sql`.
**Method:** Live inspection via browser automation (welcome screen, sucursal/responsable/catalog pickers, cart, generate/register flow) plus one user-approved test transaction (folio `FI-170726-114415`, Mérida, Alejandro Javier Villalobos Azcorra, 5 TN of GRIS CPC 30R EXTRA MAYA 50KG) used to capture the real PDF and email output. No other production data was created, modified, or deleted.

**Environment limitations (read this first):** I had a *play*-mode URL only, not Studio/edit access. That means Power Apps formulas, SharePoint list schemas/permissions, and Power Automate flow steps (objective 10) could **not** be inspected directly — everything about them below is inferred from app behavior, not read from source. The Seguimiento (tracking) screen was not reached in this session (v1 explicitly excludes it per the brief, so this was deprioritized). Every finding below is labeled **Confirmed**, **Inferred**, or **Needs stakeholder confirmation**.

---

## A. Executive summary

The Power App works, but its architecture creates exactly the failure modes described in the brief. The generation flow is a **two-step process** — "Generar Carta" and a separate "Registrar" — and only the second step writes the record, produces the PDF, and sends the email. Nothing in the UI visually confirms success after "Registrar" is clicked (**Confirmed**: no banner, no dialog; the form just silently resets). The only proof a carta was registered is the email that lands in the generating user's inbox. This directly explains "manual registration being forgotten" from the brief — the app requires a second, unconfirmed click to actually count.

Product/responsable data shown to the user did not reliably match the sucursal selected during testing (**Confirmed** via reproduction — see D and L), which is consistent with "missing products/responsibles" and "stale inventory" complaints. SKU search by exact code returned zero results in testing (**Confirmed**).

The Next.js replacement already fixes the single biggest structural problem: generation and registration are one atomic action (**Confirmed** in `CartaForm.tsx`/`cartas.ts`). It also already implements the compliance/admin-visibility goal from the brief (**Confirmed** in `cumplimiento.ts`). However, it currently has **no email-sending code at all** (**Confirmed** — no email/SMTP/Resend references anywhere in the frontend), the legal/PDF text has several small wording departures from the real document, the PDF footer only supports one logo where the original has two, and the folio format is a deliberate, reasonable, but unreviewed departure from the original scheme. The `cr_usuarios.password` column is stored as plain text with no hashing — a real security gap that should be closed before this goes to production with real credentials.

## B. Current user journey

1. User opens the Power App (`apps.powerapps.com/play/...`), lands on a welcome screen: **"Bienvenido, {nombre del usuario que inició sesión}"**.
2. User selects a **sucursal** from a searchable dropdown (name + SAP plant code, e.g. "Mérida / E300"). **Confirmed**: both downstream actions (GENERAR, SEGUIMIENTO) are hard-blocked (no navigation occurs) until a sucursal is selected — this is enforced client-side.
3. User taps **GENERAR** → lands on the "Generar Carta" screen. A folio is already assigned, computed at screen-load time from the logged-in user's initials and the current timestamp (see E).
4. User selects a **responsable** from a dropdown scoped to the chosen sucursal.
5. User searches for a **SKU**, or picks from a short default list of items shown below the search box, enters a **cantidad**, and taps the **+** icon to add it to the cart on the right.
6. Subtotal / IVA (16%) / Total update live as items are added.
7. User taps **Generar Carta** — a transient toast ("Carta Responsiva en proceso…") appears; no PDF preview is shown. This step activates the **Registrar** button (previously greyed out).
8. User taps **Registrar** — this is the step that actually creates the SharePoint/back-end record, generates the real PDF, and sends the confirmation email. There is **no on-screen success confirmation**; the form silently clears and a new folio is pre-generated for the next carta.
9. The generating user receives an email with the PDF attached (see G). That email is the only evidence, inside the app itself, that the carta was registered.

## C. Screen-by-screen inventory

| Screen | Confirmed elements |
|---|---|
| **Welcome** | Header banner ("Generador de Carta Responsiva V2.0", Promexma logo), "Bienvenido, {user}" heading, Sucursal combobox (required), GENERAR icon+label, SEGUIMIENTO icon+label, SALIR (logout) icon+label bottom-right. Background is a truck/pallet photo (intermittently failed to load on reload — minor asset-loading issue). |
| **Generar Carta** | Folio badge (top-left, auto-populated), Responsable combobox (required), SKU search box (required to add at least one line), a short unfiltered/default product list with per-row cantidad input + "+" button, a cart table (Producto / SKU / UM / Cantidad / Costo / Subtotal) with a delete icon per row, Subtotal/IVA 16%/Total summary, "Generar Carta" button, "Registrar" button (disabled until Generar Carta succeeds), Home icon (**Confirmed intermittently unresponsive** — see L). |
| **Seguimiento** | **Not reached this session** — gated behind sucursal selection like Generar; brief states it is broken today (folio matching issues) and it is explicitly out of v1 scope. *Needs stakeholder confirmation / follow-up session with Studio access if any data dependency must be preserved.* |
| **Info panel** (ⓘ icon, top bar) | "No description provided. Created by Procesos y Controles PMX." — **Confirmed**, useful for identifying app ownership/service account. |

## D. Exact field and validation requirements

| Field | Screen | Required? | Behavior observed |
|---|---|---|---|
| Sucursal | Welcome | Yes | Searchable combobox, shows "{Nombre} / {Código SAP}" (e.g. Mérida/E300). GENERAR and SEGUIMIENTO do nothing if empty. **Confirmed.** |
| Responsable | Generar Carta | Yes (implied) | Searchable combobox, list format "{NOMBRE COMPLETO}" + SAP code on second line. When correctly scoped (Mérida test), only Mérida-tagged people appeared. **Confirmed** working correctly for Mérida; **Confirmed bug** — during an earlier attempt with "Coatzacoalcos" selected, the SKU default gallery still showed Mérida-coded (`-E300`) items, suggesting the default/unsearched product gallery is not reliably scoped to the active sucursal. Needs stakeholder confirmation whether this is a caching/timing bug or a real data issue. |
| SKU search | Generar Carta | One line item minimum | Free-text box. **Confirmed bug**: typing an exact, visibly-listed SKU (`10011825`) returned zero results both with waiting and re-typing. The only way products got into the cart in testing was via the unfiltered default gallery's "+" button, not via search. |
| Cantidad (per line) | Generar Carta | Yes, >0 | Plain numeric input per catalog row; accepted whole numbers (tested with 5). Decimal precision not verified live but replacement code assumes 3 decimals. |
| Generar Carta button | Generar Carta | — | Enabled once responsable + ≥1 line item are present (empty sucursal blocks reaching the screen at all). Produces a toast, no visible PDF. |
| Registrar button | Generar Carta | — | Disabled until "Generar Carta" is clicked once. Click produces **no visible confirmation** — the form resets silently and a fresh folio appears. |

## E. Calculations and folio rules

- **Folio format (Confirmed, reproduced 3×):** `{INICIALES_USUARIO}-{DDMMYY}-{HHMMSS}`, e.g. `FI-170726-113723`, `FI-170726-114415`, `FI-170726-115032` for the same user across the session. It is generated client-side the moment the Generar Carta screen loads/resets — **not** tied to the sucursal, and **not** a sequential counter. Two users generating at the same second with the same initials could theoretically collide (no random suffix was observed, unlike the replacement's folio generator).
- **Subtotal** = Σ(cantidad × costo unitario) across cart lines. **Confirmed**: 5 × $3,851.21 = $19,256.05.
- **IVA** = Subtotal × 0.16, displayed as its own rounded line item. **Confirmed**: $19,256.05 × 0.16 = $3,080.968 → displayed **$3,080.97** (standard round-half-up to 2 decimals).
- **Total** = Subtotal + IVA, independently rounded to 2 decimals: **Confirmed** $22,337.02 (matches $19,256.05 + $3,080.97 exactly, so no compounding rounding error was observed in this single-line test — multi-line rounding behavior wasn't verified).
- **Replacement comparison:** `generarFolio()` in `lib/folio.ts` uses `{PREFIJO_SUCURSAL}-{YYYYMMDD}-{HHMMSSmmm}{RR}` (sucursal-prefix based, millisecond + 2-digit random suffix for collision resistance) — a different, arguably better-engineered scheme, but a **hard behavioral change** from the original that stakeholders should explicitly sign off on (old folios cannot be pattern-matched by the new logic and vice versa). IVA math is identical (×0.16) in both systems — **Confirmed match**.

## F. PDF specification (from one real, user-approved generated sample)

**Title / branding:** No header logo observed on page 1 of the PDF itself (the Promexma banner is a *web app* element, not part of the PDF). Top of page starts directly with the meta line.

**Meta line:** `Folio: FI-170726-114415` only — no "Fecha" shown in this line (date appears later, in the closing sentence).

**Title banner** (dark gray background, white bold uppercase text): `CARTA RESPONSIVA MATERIAL A BORDO`

**Introductory wording (exact, transcribed from the real PDF):**
> "Yo, ALEJANDRO JAVIER VILLALOBOS AZCORRA, como parte del equipo de la sucursal E300, hago constar que he recibido material de la empresa Proveedora Mexicana de Materiales los productos específicos de la presente carta."

(Note: this sentence is run-on in the source document — no period before "los productos". Transcribed literally; likely a pre-existing wording defect worth fixing rather than replicating.)

**Product table** — header "SALIDA DE MATERIAL" (red banner, white bold uppercase). Columns, in order: **CÓDIGO | DESCRIPCIÓN | CANT. | UM | P.U. | PRECIO**. Note "P.U." = unit price, "PRECIO" = extended/line amount (not unit price) — column 6 is a computed total, not a unit cost.

Row observed: `10011825 | GRIS CPC 30R EXTRA MAYA 50KG | 5.000 | TN | $3,851.21 | $19,256.05`

**Totals block** (right-aligned): `SUBTOTAL $19,256.05` / `IVA %16 $3,080.97` / `TOTAL $22,337.02`

**Operational/legal terms (exact):**
> "Estoy, así mismo enterado de que:"
> - "Estos productos me han sido entregados con el fin de venderlos entre mis clientes como parte del esquema de "Venta de Material a Bordo""
> - "Al cerrar una venta tengo el compromiso de confirmarlo a mi respectiva sucursal, así como entregar los documentos comprobantes (remisión manual, recibo de caja) y efectivo recibido en el mismo día que se realice."
> - "Los productos no vendidos serán regresados a la sucursal más tardar el viernes de esta semana."
>
> "Me comprometo a realizar la reposición monetaria de los productos en caso de extravío u omisión del retorno el viernes."
>
> "Confirmo de leído el presente anexo y estando conforme de su contenido."

**Date/city wording (exact):** `Lo firmo en la ciudad de Mérida con fecha al 17/07/2026`

**Signature labels (exact, two-column, blank underline — no printed name above either line):**
- "Nombre, puesto y firma de la persona que retira el material."
- "Nombre, puesto y firma de la persona que entrega el material."

**Footer:** Two logos side by side — **Construrama** and **Promexma** (both, not just Promexma).

## G. Email specification (from the one real send)

- **Trigger:** fires on **Registrar**, not on Generar Carta. **Confirmed.**
- **Sender:** the generating user's own mailbox (not a shared/service account) — `Fernando Inaki Corella Fernandez`. **Confirmed.**
- **Recipients:** the generating user themself, plus **"Solicitudes Comerciales PMX"** (shown in Outlook with an unresolved-contact icon — likely a shared mailbox or distribution list; exact membership needs stakeholder confirmation). No other CC/BCC observed.
- **Subject:** `CARTA RESPONSIVA {folio}` — e.g. `CARTA RESPONSIVA FI-170726-114415`.
- **Body (exact, Spanish, single line):** "Se adjunta la carta responsiva generada el 17/07/2026 con el folio FI-170726-114415." — followed by a Promexma "**SMART PROCESS**" logo/branding block. ("Smart Process" may be the internal name of the automation/flow — worth asking Kevin or the Procesos y Controles PMX team.)
- **Attachment filename:** `CARTA-{folio}.pdf` — e.g. `CARTA-FI-170726-114415.pdf` (99 KB).
- **Mandatory for v1?** Not directly testable, but since it's the *only* success confirmation the current app gives, it is functionally load-bearing today. Whether the replacement needs to send it is a product decision — **Needs stakeholder confirmation** (Isa) — but recommend at least an in-app success confirmation regardless, since relying on email as the sole "did this work" signal is part of what causes registration to go unnoticed.

## H. Data sources and proposed Supabase mapping

Because Studio/SharePoint access wasn't available this session, list names, exact column types, and row counts below are **inferred** from app behavior, not read directly from SharePoint. Recommend a short follow-up session with edit access, or a CSV export from Isa/Dani (already requested in `docs/carta-responsiva-data-requests.md`), to firm these up.

| Data source | What was observed | Proposed Supabase mapping | Status |
|---|---|---|---|
| **Sucursales** | Combobox with ~13+ entries seen while scrolling: Mérida (E300), Cancún (E301), Chetumal (E304), Campeche (E305), Playa del Carmen (E306), Villahermosa (E307), Orizaba (E308), Xalapa (E311), Coatzacoalcos (E312), Veracruz (E313), Nicolás Romero (E314), plus at least one more between Cancún and Chetumal not fully captured (likely Cd. del Carmen, E302 or E303). | `cr_sucursales` — **gap:** current schema has `nombre` + `prefijo_folio` + `region` but **no column for the SAP plant code** (E300 etc.) that appears in the app UI and in the PDF's legal text ("de la sucursal E300"). Recommend adding `codigo_sap text`. | Inferred (partial list); full list still needed from Isa per existing data-requests doc. |
| **Responsables** | Per-sucursal list, "NOMBRE COMPLETO" + SAP code. Confirmed correctly scoped for Mérida (5 names seen: Alejandro Javier Villalobos Azcorra, Cristopher Riera Sauri, Dulce Marilu Aguilar Huchim, Raul Alejandro Ramon Azcorra, Claudia Yulissa Rodriguez Ordaz). | `cr_responsables` — matches existing schema (`id_sucursal`, `nombre`). No new columns needed. | Confirmed for one branch; scoping bug seen for another (see D). |
| **Products/inventory** | Default gallery showed 4 items, all suffixed "-E300" for display only; the PDF's actual `CÓDIGO` column stores the bare SKU (no suffix) — the "-E300" is a UI convention, not part of the stored code. | `cr_catalogo` — matches existing schema. Confirm with Isa/Dani whether `codigo` should be globally unique or only unique per-sucursal (schema currently enforces the latter via `unique (id_sucursal, codigo)`, which appears correct). | Confirmed structurally; SKU **search is broken** in the source app (see D), so its true filtering logic (contains vs. exact-match) could not be reverse-engineered. |
| **Users/access** | Only one login was observed (Cemex SSO — `fernando.corella@ext.cemex.com`); no evidence of a branch-scoped restriction — the same user could freely pick Coatzacoalcos, Mérida, etc. | `cr_usuarios` — **security gap:** schema stores `password text not null` with **no hashing**. Recommend either bcrypt/argon2 hashing before storing, or dropping local passwords entirely in favor of the SO Portal SSO handoff that's already implemented (`app/auth/handoff`). | Confirmed password column is plaintext in the SQL; login mechanism not independently verified against SharePoint. |
| **Generated letters** | Confirmed one full record's shape via the generated PDF/email (folio, sucursal, responsable, items, subtotal/iva/total, timestamp). | `cr_cartas` / `cr_carta_items` — matches existing schema well. | Confirmed via one live sample. |
| **Seguimiento/devoluciones** | Not reached; brief states it's broken (folio matching) and out of v1 scope. | N/A for v1. | Not inspected — flagged as a possible follow-up if any hidden dependency surfaces later. |

## I. Power Automate/connector dependencies

**Not directly inspectable** without Studio/flow access. Inferred from behavior:

- A flow (or Power Apps native `Notify`/`SendEmail`-equivalent step) fires on **Registrar**, not Generar — most likely triggered by writing to a SharePoint list ("Cartas" or similar), which cascades to PDF generation and an email send. The "SMART PROCESS" branding on the email suggests a named internal automation, possibly documented by the "Procesos y Controles PMX" team.
- **SAP export dependency** (from the brief, not independently re-verified this session): inventory refresh took ~4 hours via Power Automate, and Kevin only ran it ~3 times, meaning the catalog is largely static/manually patched by Isa. This is consistent with the small, seemingly hand-curated default gallery observed.
- **Needs stakeholder confirmation:** exact flow name(s), trigger conditions, PDF rendering engine used (Power Automate "Populate a Microsoft Word template" vs. a third-party PDF connector — the visual quality/precision of the sample suggests a template-based generator, not a canvas export), and the full membership of "Solicitudes Comerciales PMX".

## J. Roles and permissions

- **Who can open the app:** Any Cemex-authenticated user with the app shared to them (SSO via `m365.cloud.microsoft`, observed in the CEMEX logo link). Not independently testable beyond my own account.
- **Sucursal scoping:** **Confirmed** — no restriction observed. My test account was able to select and generate a carta for a sucursal seemingly unrelated to any assigned "home" branch, and the underlying data mismatch bug (D) suggests the app **does not scope by user's home branch at all** at the UI level. This may be exactly what the brief means by "complicated permissions" — the SharePoint-list-level grants are separate from (and don't restrict) in-app sucursal selection, so a user can pick a branch they have no item-level access to and get an incomplete/wrong catalog silently, rather than a clear error.
- **Who can generate/register/edit/view history:** Generation confirmed open to any authenticated user. Edit/history/admin capabilities were not reached (Seguimiento not tested; no separate "admin" screen was found in play mode).
- **Replacement comparison:** the Next.js app already has explicit `admin`/`operador` roles with `id_sucursal` scoping enforced in code (`userCanAccessSucursal`, disabled sucursal `<select>` for scoped operators) — this is a **meaningful, already-built improvement** over the observed Power App behavior, assuming it's correctly enforced server-side too (client-side scoping alone is not a real security boundary — **Needs verification** that Supabase RLS policies mirror this logic, since the current schema doesn't show any RLS statements).

## K. Reusable assets/data/logic

- **Legal/operational terms text** — largely reusable; needs the wording corrections in F/L applied.
- **Calculation logic** (IVA 16%, subtotal/total) — directly reusable, already matches.
- **Compliance/admin reporting concept** ("who generated / who did not, by sucursal/period") — **already built** in `cumplimiento.ts`, matches the brief's goal #3 well.
- **Sucursal + responsable + catalog data model** — structurally reusable; needs the `codigo_sap` addition (H) and an authoritative data export (already requested from Isa/Dani per `carta-responsiva-data-requests.md`).
- **PDF layout/branding direction** (dark-gray title banner, red table header, two-column signature block) — reusable as a visual reference; current `CartaPDFDocument.tsx` is already stylistically close and should be reconciled against the exact text in F.

## L. Gaps in the current Next.js replacement

Ordered roughly by impact:

1. **Email is entirely unimplemented.** No SMTP/Resend/email code exists anywhere in the frontend (**Confirmed** via repo search). If email is required for v1, this is a blocking gap, not a polish item.
2. **No in-app success confirmation on generate**, mirroring (not yet fixing) the original's silent-registration problem — actually the replacement is *better* here since generation+registration is atomic, but there's still no explicit "✅ Carta {folio} registrada" confirmation UI beyond a toast (`toast.success` in `CartaForm.tsx` — confirm this is prominent enough).
3. **PDF wording departs from the real document in 4 places** (F): missing sucursal SAP-code + full company name in the intro; dropped quotes around "Venta de Material a Bordo"; different parenthetical grouping and word choice in bullet 2 ("comprobatorios" vs "comprobantes"); bullet 3 adds "el mismo día o" that isn't in the actual current PDF (though it may reflect the *intended* policy per the brief — needs Isa's call on which is authoritative).
4. **PDF footer supports only one logo**; the real document uses two (Construrama + Promexma) side by side.
5. **No `codigo_sap` field** anywhere in the schema or UI, despite the original app/PDF surfacing it prominently (both in the responsable/product pickers and in the legal intro paragraph).
6. **Folio format is a significant, unreviewed departure** from the original (sucursal-prefix + full date vs. user-initials + short date) — likely an improvement, but a decision stakeholders should explicitly make, not inherit silently.
7. **`cr_usuarios.password` is plaintext** in the schema (`password text not null`, sample seed values like `'changeme'`) — needs hashing or removal in favor of the already-built SO Portal SSO handoff before this touches real credentials.
8. **No visible RLS policies** in `carta-responsiva-schema.sql` — the admin/operador scoping is enforced only in the React layer today; needs server-side enforcement to be a real security boundary.
9. Minor: PDF meta line shows Folio+Fecha together where the original shows only Folio (cosmetic, arguably an improvement, but worth a conscious decision if pixel-parity is desired).

## M. Recommended v1 scope

Confirms the brief's stated v1 scope is sound and, in most areas, already substantially built:

- Sucursal → responsable → SKU search → quantities → cart → totals → generate — **in place**, working end-to-end in the code reviewed.
- Auto-save/auto-register on generate (single action, no separate "Registrar") — **in place**, and is the single most important behavioral fix vs. the source app.
- Edit after create — **in place** (`app/(auth)/cartas/[id]/page.tsx`, `updateCarta`).
- Admin historial/compliance/catalog maintenance — **in place** (`cumplimiento.ts`, `/catalogo`, `/responsables` routes).
- **Recommend adding to v1** (not currently present): (a) email notification if stakeholders confirm it's required for adoption/trust, since it's currently the only success signal users had; (b) `codigo_sap` on sucursales, surfaced in the responsable/catalog pickers and the PDF intro paragraph, to match the legal text users are used to seeing; (c) password hashing or full SSO-only auth before go-live.

## N. Deferred functionality

- **Seguimiento / devoluciones / remisiones** — confirmed out of v1 scope per the brief; not inspected this session. If a future audit needs it, it will require either Studio access or a working SharePoint export, since the folio-matching bug described in the brief means the in-app screen itself may not be a reliable source of truth.
- **Live SAP inventory sync** — explicitly out of v1 per the brief; current approach (seed + admin add-code) matches what was observed (small, apparently hand-maintained catalog).

## O. Questions requiring Isa, Dani, or Kevin

1. **Isa:** Is the folio format allowed to change from `{iniciales}-{DDMMYY}-{HHMMSS}` to a sucursal-prefix format, or do any downstream/manual processes depend on parsing the old pattern?
2. **Isa:** Which of the two versions of terms bullet #3 is correct — "regresados a la sucursal más tardar el viernes" (what the current PDF actually says) or "el mismo día o a más tardar el viernes" (what the brief's stated business rule says, and what the replacement currently has)?
3. **Isa:** What is "Solicitudes Comerciales PMX" exactly (distribution list membership), and should the replacement's email (if built) go to the same address, a different one, or per-sucursal addresses?
4. **Isa/Dani:** Should `codigo_sap` (E300, E301, ...) be added to `cr_sucursales` and surfaced in the UI/PDF, matching the original?
5. **Dani:** Confirm the inventory refresh policy decision referenced in the data-requests doc (periodic SAP import vs. seed+add-code vs. request-to-Isa) — still marked pending there.
6. **Kevin:** What system/flow actually renders the PDF and sends the email today (Power Automate "Populate a Microsoft Word template," a third-party connector, or something else)? This affects how closely the replacement's `@react-pdf/renderer` output can/should match pixel-for-pixel.
7. **Isa/Kevin:** Is email sending a hard requirement for v1 given it's currently the only success confirmation, or is an in-app confirmation sufficient once generation is already atomic (as it is in the replacement)?
8. **Isa:** Should any user be able to generate a carta for any sucursal (as observed in the live app), or should access be scoped to a user's assigned branch (as the replacement already enforces in the UI layer)? This affects whether the observed lack of scoping is a bug to fix or existing intended flexibility to preserve.

## P. Migration checklist

- [ ] Get authoritative CSV exports from Isa/Dani for sucursales (with `codigo_sap`), responsables, and catálogo (already requested in `carta-responsiva-data-requests.md`).
- [ ] Add `codigo_sap text` to `cr_sucursales`; backfill from the export.
- [ ] Decide and document the final folio format with Isa (O.1); update `lib/folio.ts` and any related display logic accordingly.
- [ ] Correct the 4 wording gaps in `lib/carta/terms.ts` / `CartaPDFDocument.tsx` against the exact text in section F, pending Isa's answer to O.2.
- [ ] Add the second footer logo (Construrama) to `CartaPDFDocument.tsx`; source both logo assets at production resolution.
- [ ] Decide whether to build email sending for v1 (O.7); if yes, confirm sender/recipient/subject/body/attachment-name spec against section G, and implement (no code exists today).
- [ ] Hash `cr_usuarios.password` (or remove local password auth entirely in favor of the SO Portal handoff already implemented) before any real credentials are stored.
- [ ] Add Supabase RLS policies mirroring the `admin`/`operador` + `id_sucursal` scoping currently enforced only client-side.
- [ ] Confirm SKU search semantics with Isa/Kevin (contains vs. exact, whether it should search description too) since the source app's search could not be validated as functional during this audit.
- [ ] Decide whether any Seguimiento data dependency must be preserved before that feature is fully deferred (requires Studio/SharePoint access to verify).

---

## Prioritized list of changes needed in the current replacement

1. **High** — Fix PDF legal-text wording gaps (F/L.3) and confirm bullet #3 with Isa (O.2).
2. **High** — Decide on and implement (or explicitly defer) email sending (L.1, O.7); today it's the only success signal, which is a compliance risk in reverse (silently *not* sending could look the same as success in the app either way, once generation is atomic — but stakeholders relying on the email to know a carta happened need a replacement notification path).
3. **High** — Hash passwords or drop local auth in favor of SSO handoff (L.7).
4. **Medium** — Add `codigo_sap` to schema/UI/PDF (L.5, H).
5. **Medium** — Add second PDF footer logo (L.4).
6. **Medium** — Add Supabase RLS to enforce role/sucursal scoping server-side (L.8).
7. **Low** — Reconcile folio format decision with Isa and document it (L.6, O.1).
8. **Low** — Confirm and, if needed, adjust PDF meta-line layout (Folio-only vs Folio+Fecha) for visual parity (L.9).

## Proposed final `cr_*` schema — changes from the existing SQL

Building on `db/carta-responsiva-schema.sql`:

```sql
-- cr_sucursales: add SAP plant code, used in UI pickers and PDF legal text
alter table cr_sucursales add column if not exists codigo_sap text;

-- cr_usuarios: password must be hashed, not plaintext
-- Option A (keep local auth): store a bcrypt/argon2 hash instead of plaintext,
-- rename column to make the contract explicit.
alter table cr_usuarios rename column password to password_hash;
-- (application layer must hash on write and verify with a constant-time compare)

-- Option B (recommended if SO Portal SSO handoff is the primary path):
-- drop local password auth entirely once handoff is fully wired up.
-- alter table cr_usuarios drop column password_hash;

-- cr_cartas: track notification status if email is implemented
alter table cr_cartas add column if not exists email_enviado boolean not null default false;
alter table cr_cartas add column if not exists email_enviado_at timestamptz;

-- Optional: capture the legal terms version applied to each carta, so future
-- wording changes don't retroactively alter historical PDFs' apparent basis
alter table cr_cartas add column if not exists terminos_version text;

-- Row Level Security (none present in the current draft — needed to make
-- the admin/operador + id_sucursal scoping a real boundary, not just UI logic)
alter table cr_cartas enable row level security;
alter table cr_carta_items enable row level security;
alter table cr_catalogo enable row level security;
alter table cr_responsables enable row level security;
-- (policies themselves depend on how auth.uid()/session claims map to cr_usuarios;
--  needs design work alongside the SSO handoff, not a copy-paste snippet)
```

## Datasets/exports still needed from SharePoint or SAP

(Restates and slightly extends the existing `carta-responsiva-data-requests.md` in light of this audit)

- Full sucursales list **including SAP plant code** (`nombre`, `prefijo_folio` decision, `codigo_sap`, `region`).
- Full responsables list per sucursal.
- Full catálogo per sucursal (`codigo`, `descripcion`, `unidad_medida`, `precio`) — current default gallery only exposed 4 sample rows for one branch; true size/shape unknown.
- Exact, current membership of the "Solicitudes Comerciales PMX" distribution list, if email is kept.
- The Power Automate flow definition (or a walkthrough from Kevin) covering PDF generation and email send, since this audit could not access Studio.
- Any existing folio history, if the folio format decision (O.1) requires backward compatibility.

## Screenshots / visual observations captured this session

- Welcome screen (sucursal picker open, showing branch name + SAP code pairs).
- Generar Carta screen, empty state and populated-cart state (folio, responsable, SKU list, totals, two-button generate/register split).
- Real generated PDF (`CARTA-FI-170726-114415.pdf`) — full page, used as the primary source for section F.
- Real received email in Outlook — sender/recipients, subject, body, attachment — used as the primary source for section G.

---

*Everything above not explicitly marked "Confirmed" should be treated as inferred from limited access and cross-checked with Isa/Dani/Kevin before being used to finalize requirements.*
