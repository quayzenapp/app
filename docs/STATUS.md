# Quayzen status (update whenever work finishes)

Last updated: 2026-11-03

## Working and tested
- Infrastructure: Postgres + pgvector, Keycloak with realm import and themed sign-in.
- Auth: email and password sign-in, federated sign-out, disabled and unknown users refused.
- Multi-tenancy: shared database with row level security, organization switcher, tampered cookies ignored.
- RBAC: 18 modules, 4 levels, 6 standard roles per organization, custom roles, restricted fields stripped on the server.
- App: shell, dock, four theme modes, dashboard (stats, reminders, licence ring), 17 data-driven registers with validation, currency and area calculations, review, archive, audit.
- Admin: organizations, users (through Keycloak), role matrix, form builder, AI documents, AI models, audit log.
- Ask Quayza: ingestion, hybrid search, citations, streaming, off-topic refusal, OpenRouter, Bedrock and local providers.
- Annual returns: calculation engine, line-by-line checking with explanations, second-person approval, fixed snapshots with a fingerprint, the Commission's original PDF filled and read back, submission record. Working report in Excel, PDF and Word.
- Documents: register with categories, expiry dates, search, linking to records, archive. Files with kept versions, stored outside the web root. Restricted access enforced on the server for details and downloads, files checked by content, integrity checked on download, restricted downloads audited. Expiring documents appear on the dashboard.
- Reports: all nine artifact reports on screen and in Excel, PDF and Word, following the role's modules and restricted fields. Exports are audited.
- SEZ wording: "Port City" shows as "SEZ" on screen and in reports, as in the artifact. Saved data, the Commission's name and official forms are unchanged. To turn it off, remove `<SezWording />` and the `sezDeep` calls.
- Business plan: versions, entry form and Excel template import, second-person check and lock with fingerprint (a database trigger refuses changes to locked figures), reference version, revisions, version comparison, milestone progress, explanations, plan vs actual with charts, exports, attached documents.
- Budget: monthly grid with Spread, approval, copy to next year, pro rata comparison with financial records, currency view, charts, exports. Budget and plan cards on the dashboard.
- Controls: an organization's administrator can turn off the second-person check (Admin > Controls), audited.
- Licence application, Stage 1: applications with field specs from the artifact (`src/lib/lic/core.ts`), people with restricted fields, proposal, projections, profile, declarations, document checklist, readiness, second-person approval with a fixed copy, status history, dashboard card, demo applicant in Harbourline. Tests: `pnpm test:lic`, `tests/e2e/run.sh lic`.
- Licence application, Stage 2: Schedule I, Technical Evaluation Form, AP and UBO declarations, directors form and business profile, filled inside the Commission's original files from `src/lib/lic/gen.ts`. Drafts are marked DRAFT; after approval the fixed copy is used. Tests: `pnpm test:forms`. Word and PDF editable copies aren't built.
- Licence application, Stage 3 (part): file upload on each checklist line, stored as documents linked to the application; the application pack ZIP; setting up company profile, licence, people and office records from an issued licence.
- Registers: Excel export (restricted fields left out by role) and all-or-nothing Excel import. Company profile.
- OpenRouter answers tested with the free auto-router: real cited answers in 3 to 8 seconds.
- Demo: Demo Company and Harbourline, 8 users. Password `Demo@12345`, development only.

## Written but never run against the real service
- AWS Bedrock.
- Docker images for the AI service (`docker compose --profile ai`): dev runs it with uv.
- Form builder and user role changes: pages open in tests, but saving isn't covered by E2E yet.

## Known polish items
- Sign-in card renders about 320px wide, so "Remember me" wraps. Width rules in the Keycloak theme CSS had no visible effect; it works but needs another look (Keycloak may be caching the stylesheet, or a parent element is constraining it).

## Next task
See `docs/HANDOFF-licence-application.md`, which lists exactly what is left. Original forms are in `apps/web/assets/forms/`, decoded by `tools/extract_forms.py`.

## Roadmap: not built yet (these sections show a "planned" page)
Each needs its logic ported from `docs/artifact/src/`. See the `quayzen-product` skill.
1. Remaining section overviews and their charts: `insights.js`, `overviews.js`. Chart helpers are in `src/lib/charts.ts`.
2. Document templates with {{markers}} and checklist-line uploads come with the licence application, which they depend on: `x_docs.js`. By-category chart on the Documents page: with the charts in item 1.
3. Annual returns overview page: `overviews.js`
4. Office space comparison: `space.js`
   Capital inflow targets, in the investment section: end of `budget.js`
   Business plan parts tied to the licence application come with it: linked plan from an application, the plan document builder, Technical Evaluation Form import: `x_bplink.js`, `x_bpb.js`. Today's Excel import reads the Quayzen template only.
5. Licence application and changes, 21 Commission forms: `lic_*.js`, `x_pkg.js`, `js/forms/*.js`
6. Development approvals, visas workflow, checklists, How It Works: `x_dev.js`, `x_visa.js`, `x_check.js`, `x_flow.js`, `x_sysmap.js`
7. Production: web Dockerfile, real secrets, HTTPS, Keycloak production mode, backups, S3, email for invitations and password resets, rate limiting. Files are on local disk (`STORAGE_DIR`), so they need a shared volume and backups, or S3 through `src/lib/storage.ts`. No virus scanning of uploads yet.

## Reports that depend on modules not built yet
- Commission request history has empty Approved and Sent columns until the request approval workflow exists (`pages1.js`).

## Differences from the artifact to decide or port
- The artifact has adjustable reminder windows (Setup > Controls). Here the dashboard uses fixed windows.

## Ask Quayza accuracy
`services/ai/scripts/retrieval_check.py` holds 10 known questions and now finds 10 of 10, but this set is small and written by us; grow it with real user questions. A local cross-encoder reranker (ms-marco-MiniLM-L-12) was tried and rejected: no accuracy gain on this set, and 22 seconds per search on CPU. Quayza only answers from retrieved passages, so an answer can still be incomplete: check important points against the source.

## Before production
Replace every value in the `.env` files, realm client secrets and demo users. Remove the demo organizations if not wanted. Set `sslRequired` and real redirect URIs in Keycloak.
