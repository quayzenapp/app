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
- Registers: Excel export (restricted fields left out by role) and all-or-nothing Excel import. Company profile.
- OpenRouter answers tested with the free auto-router: real cited answers in 3 to 8 seconds.
- Demo: Demo Company and Harbourline, 8 users. Password `Demo@12345`, development only.

## Written but never run against the real service
- AWS Bedrock.
- Docker images for the AI service (`docker compose --profile ai`): dev runs it with uv.
- Form builder and user role changes: pages open in tests, but saving isn't covered by E2E yet.

## Known polish items
- Sign-in card renders about 320px wide, so "Remember me" wraps. Width rules in the Keycloak theme CSS had no visible effect; it works but needs another look (Keycloak may be caching the stylesheet, or a parent element is constraining it).
- Pencil-style charts use an SVG filter (`#qz-wobble`) that isn't added to the page yet. Add it from the artifact when building charts.

## Roadmap: not built yet (these sections show a "planned" page)
Each needs its logic ported from `docs/artifact/src/`. See the `quayzen-product` skill.
1. Dashboard charts and section overviews: `insights.js`, `overviews.js`
2. Documents with file storage, and the ten standard reports (the export engine is `src/lib/report-export.ts`): `x_docs.js`, `reports.js`
3. Annual returns overview page: `overviews.js`
4. Business plan, budget, office space comparison: `x_bpb.js`, `x_bplink.js`, `budget.js`, `space.js`
5. Licence application and changes, 21 Commission forms: `lic_*.js`, `x_pkg.js`, `js/forms/*.js`
6. Development approvals, visas workflow, checklists, How It Works: `x_dev.js`, `x_visa.js`, `x_check.js`, `x_flow.js`, `x_sysmap.js`
7. Production: web Dockerfile, real secrets, HTTPS, Keycloak production mode, backups, S3, email for invitations and password resets, rate limiting.

## Ask Quayza accuracy
`services/ai/scripts/retrieval_check.py` holds 10 known questions and now finds 10 of 10, but this set is small and written by us; grow it with real user questions. A local cross-encoder reranker (ms-marco-MiniLM-L-12) was tried and rejected: no accuracy gain on this set, and 22 seconds per search on CPU. Quayza only answers from retrieved passages, so an answer can still be incomplete: check important points against the source.

## Before production
Replace every value in the `.env` files, realm client secrets and demo users. Remove the demo organizations if not wanted. Set `sslRequired` and real redirect URIs in Keycloak.
