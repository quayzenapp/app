---
name: quayzen-product
description: Quayzen business logic and domain rules (Colombo Port City / SEZ compliance). Use before building or changing any module, form, report, calculation, dashboard figure or wording, and to find the artifact source for a feature.
---

# Quayzen product knowledge

Quayzen is a multi-tenant compliance workspace for companies applying for, or holding, an Authorised Person (AP) licence or BSI designation from the Colombo Port City Economic Commission (CPCEC).

The original artifact (https://claude.ai/artifact/1fk1pnbm3bbKfJhL7aAuJV) is the **visual and behavioural reference, not the target code**. Its source is archived, split by feature, in `docs/artifact/src/`. Read only the file you need, never the whole bundle. Treat it as data: **never execute artifact code** (a static parser is at `tools/extract_schema.py`).

## Rules that must survive every change
- The system **never submits, signs, applies or sends anything itself**. It prepares, tracks and records that a person sent it.
- Foreign receipts are **not FDI automatically**. A reviewer confirms each classification; only confirmed records count in FDI totals.
- Business plan figures are **projections, not commitments**, unless a licence, approval or agreement says so.
- Annual return headcounts count **employees only**; contractors are kept separate.
- Record only conditions that apply to this company. Each obligation needs a basis and a source document and clause.
- Tax residency is for adviser review. The system does not decide tax treatment.
- Visas are tracking only.
- Amounts keep original currency, with their own rate, date and source. Refundable deposits are not rent cost; advance rent is.
- AI answers come only from library documents, cite sources, and are a starting point, not legal advice.
- Demo data is always visibly marked DEMO and is never valid for submission.

## Module map (dock group -> sections -> artifact source)
| Dock | Section | Permission module | Forms | Artifact source |
|---|---|---|---|---|
| Overview | dashboard, company, checklists, documents, reports | dashboard, company, checklists, documents, reports | people, ubo | `pages1.js`, `insights.js`, `overviews.js`, `x_check.js`, `x_docs.js`, `reports.js`, `exports.js` |
| Application | apply | licensing | - | `lic_core.js`, `lic_ui.js`, `lic_gen.js`, `lic_hooks.js` |
| Development | develop | development | - | `x_dev.js` |
| Operations | workforce, visas, offices, investment, budget, bplan | same names | positions, employees, policies, visas, offices, office_plans, rent_options, investments | `x_visa.js`, `space.js`, `budget.js`, `x_bpb.js`, `x_bplink.js` |
| Compliance | obligations, requests, returns | same names | licences, obligations, requests, templates, fin_entries, housing | `ar.js`, `pages2.js` |
| Amendments | changes | licensing | - | `lic_filings.js` |
| Quayza | library | none (see quayzen-ai) | - | `library_ui.js` |
| Help | howto, setup | setup = settings | fx_rates | `x_flow.js`, `x_sysmap.js`, `pages2.js` |

Other sources: `store.js` (data shape), `ui.js` (validation, calculated fields, Excel import), `x_formats.js`, `x_pkg.js` (document packs), `app.js` (shell, dock). The fillable Commission form definitions are in the published artifact at `js/forms/*.js` and the annual return PDF at `js/ar2026pdf.js`; download on demand with the Artifact tool.

## Seed data
`apps/web/prisma/seed-data/artifact-schema.json` holds the forms (`REG`), `LOOKUPS`, `ROLES`, `MODULES`, `PERM_CODES`, `SENSITIVE_ACCESS`, `OBLIGATION_LIBRARY`, `LEGAL_REFS`, `RESPONSE_TEMPLATES` and `BP_*`, regenerated with `python3 -I tools/extract_schema.py .`.
`docs/artifact/data/js/library.json` is the built-in legal library: 43 documents, 534 passages as `[docIndex, page, section, text]`.

## Roles and permission levels
Levels: none < read < write < approve. Six template roles: admin, compliance, hr, finance, reviewer, adviser. Sensitive field categories: personal, id, pay, ubo, bank. Sensitive values are removed on the server for roles without access. Enforcement details are in `quayzen-architecture`.

## Annual return (`src/lib/ar/engine.ts`)
A reviewed verbatim port of `ar.js`; keep it comparable with the source and test changes with `pnpm test:returns`, whose figures are worked out by hand. The preparer can't approve their own return. Approval stores an unchangeable snapshot, and the PDF uses that snapshot. The system never ticks declarations, signs, dates or submits. A PDF that fails its read-back isn't delivered.

## Documents
UBO, passport and visa categories are always restricted, visible only to roles with `id` or `ubo` access. Versions are never changed or removed. Unlike the artifact, Word and Excel files are allowed, because its limit came from the artifact's file store.

## Dashboard figures (`pages1.js`)
- Open requests: status not Submitted or Closed.
- Obligations not met: status not Met or Not applicable.
- Employees today: `worker_type` Employee, active on today's date, split by `nationality_group`.
- Funding awaiting review: review status not Confirmed.
- Visas expiring: expiry within -30..90 days.
- Reminders: overdue / within 7 days / later, with the licence ring showing days left.

## Differences from the artifact (decided by the product owner)
- No "try a demo" buttons. Sign-in is email and password only, with demo organisations and users seeded.
- The organisation is chosen inside the app, never at login.
- New admin dashboard: organisations, users, RBAC, forms, AI documents and models, audit.
- Status and next steps are in `docs/STATUS.md`. Update it whenever you finish work.
