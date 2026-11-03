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
- Licence application, Stage 2: Schedule I, Technical Evaluation Form, AP and UBO declarations, directors form and business profile, filled inside the Commission's original files from `src/lib/lic/gen.ts`. DRAFT is printed on every page before approval; DEMO remains on forms from demo organizations even after approval. File-name prefixes and pack READ_ME.txt are kept. After approval the fixed copy is used. Tests: `pnpm test:forms`. Word and PDF editable copies aren't built.
- Licence application, Stage 3 (part): file upload on each checklist line, stored as documents linked to the application; the application pack ZIP; setting up company profile, licence, people and office records from an issued licence.
- Licence changes, Stage 4 (part): Notice of Change on `/changes`, Schedule III items A–K with the official row limits and a 30-day deadline from the earliest change, optional offshore Form III, new-member profiles and Schedule I Parts III/IV/V, second-person approval with an immutable copy and fingerprint, manual submission/acknowledgement/close records, locking after submission, and an audited original-PDF pack with read-back and continuation sheets. Restricted change rows and profile fields are stripped before display/export and preserved on lower-role edits. One offshore date mapping is blocked pending review (below). No compliance professional has reviewed this feature.
- Registers: Excel export (restricted fields left out by role) and all-or-nothing Excel import. Company profile.
- OpenRouter answers tested with the free auto-router: real cited answers in 3 to 8 seconds.
- Demo: Demo Company and Harbourline, 8 users. Password `Demo@12345`, development only.

## Written but never run against the real service
- AWS Bedrock.
- Docker images for the AI service (`docker compose --profile ai`): dev runs it with uv.
- Form builder and user role changes: pages open in tests, but saving isn't covered by E2E yet.

## Known polish items
- Sign-in card renders about 320px wide, so "Remember me" wraps. Width rules in the Keycloak theme CSS had no visible effect; it works but needs another look (Keycloak may be caching the stylesheet, or a parent element is constraining it).

## Licence changes: remaining review and work
- Offshore Form III representative cessation date (`arc.date`, PDF `Text43`): the original PDF says DD/MM/YY, while the artifact fills DD/MM/YYYY. Approval and downloads using this field are refused pending a reviewed mapping decision; other notices can be prepared. The discrepancy has been raised for review, not silently changed.
- Next filing: renewal (Schedule V), then Schedule IV and surrender (Schedule VI with offshore Form V). Editable notice copies and one-click register suggestions are not built. The earlier Stage 3 gaps remain in the handoff.
- Review fixes for `51607a9`: repeated successful saves reset forms even when their success text is unchanged; notice rows have persisted IDs, submissions with outdated row IDs are refused, and saved inputs refresh from the database. All hook callers were checked: `ActionForm` and the custom `ImportForm` use the action result; `RecordForm` and `BudgetGrid` intentionally preserve values or redirect.
- Export eligibility is checked against unstripped live data or the approved copy before stripping/generation. Notice downloads and affected Apply forms/packs return 422 rather than omit populated restricted fields. Refusal messages identify fields, never hidden values. Role-limited partial packs remain available when no populated restricted data would be omitted.
- All ten `PERSON_SPEC` tables render as real tables in Apply and Changes and save as arrays. Old string/malformed values are kept; affected generation is refused with a field-specific re-entry message. An authorized person must explicitly confirm replacement after re-entry. Restricted tables remain hidden and protected. The ported `src/lib/lic/gen.ts` logic is unchanged.
- Notice people can be removed with write access only, with an audit entry; submitted/acknowledged/closed notices refuse removal. Hidden restricted values prevent removal. Removing from a reviewed/approved notice returns it to Draft and clears its active approval.
- Review verification: the complete AGENTS.md type-check/unit/isolation/build command passed (199 reported PASS check groups, zero failures). `./tests/e2e/run.sh` passed with 243 browser checks; `./tests/e2e/run.sh lic` passed with 105 browser checks. Both reported zero failures and exited 0. New table and notice screenshots were inspected. Browser tests ran through Docker with local service access; no existing assertions were removed or weakened. The partial-pack assertion now runs before restricted values are added, with a new 422 assertion once hidden data is present. New regressions cover repeated saves without reloading, screen/reload comparisons, repeated adds elsewhere, HR raw-data refusals, corporate/bank table entry through Schedule I PDF read-back, legacy repair, removal permissions/audit/locking, and the date approval block.

## Printed form marks (Item A, 2026-11-03)
- Delivery-time DRAFT / DEMO marks cover individual application forms, application packs, notice PDFs (Schedule III, offshore Form III, new-person Schedule I parts and continuation sheets), and the annual return PDF. Approved real forms have neither mark. Approved snapshots and source templates are unchanged; file-name prefixes are kept.
- PDFs have a translucent overlay and a small footer on every page. The delivered PDF is read back again to compare every field's name, type and value plus the page count. Word uses default, first-page and even-page headers in every section, retaining existing header content and relationships. Excel uses a drawing visible on screen plus headers for every printed page, without changing cells, formulas or sheet names. Files that cannot be marked are refused or omitted with an explanation in the pack.
- Final validation passed: type check, 240 non-browser PASS check groups, production build, `./tests/e2e/run.sh` (247 PASS, zero FAIL) and `./tests/e2e/run.sh lic` (111 PASS, zero FAIL). Both browser commands exited 0 against `pnpm start`; development mode was restored afterward. The final type check and 70 form checks also passed after making test expectations explicit.
- Earlier attempts: two development browser runs each had 246 PASS and one FAIL in the existing reports client-error check (`ReportPage cannot have a negative time stamp`). The first production run passed that check but aborted after 192 PASS on a 30-second `networkidle` reload timeout; the separate licence run stopped at the same wait. A later full run exceeded the 150-second AI-ingestion poll limit and then hit an ambiguous legacy-table error selector. The test fixes wait for the rendered notice row, allow 300 seconds for the document to reach ready, and target the action error directly under the form. Every existing functional assertion remains, including saved-data, processing-readiness, validation-message and input-retention checks. No AI service code changed.
- Coverage: forty explicit form/state combinations plus refusal coverage in `scripts/test-form-marks.ts`, and HTTP download assertions in the browser suites. PDF fixtures and rendered pages are in `tests/e2e/shots/marks-*`; Schedule I (including a filled page), Schedule III, offshore Form III, continuation and annual-return pages were inspected, as was the notice screen.
- Item B (date settings), Item C (workflow engine) and renewal were not built. Word/Excel marks were checked in the generated Office XML, not desktop Office. UAT placement checks and compliance review remain outstanding; nothing is ready for real submission.

## Ingestion worker resilience (2026-11-03)
- Worker failures keep primitive job/document identifiers before processing, then use a fresh transaction to check whether the document still exists. Deleted documents are skipped; surviving documents and jobs are marked failed. Final-commit, rollback/expiration and queue/recovery failures cannot terminate the processing loop. Logs use fixed messages and exception class names, without document values, identifiers, exception messages or SQL parameters.
- AI validation: `python -m pytest tests -q` passed all 16 tests, including five worker regression cases using real SQLAlchemy sessions. Deleting during processing reproduces both an expired-instance `ObjectDeletedError` and a final-commit deletion race, then verifies that the next document reaches ready. The local worker was restarted with the fix.
- A live upload of the same 1,168,000-byte E2E text reached ready in 148.32 seconds. It did not exceed 150 seconds in this run; the small margin is insufficient to remove the 300-second wait, which remains. This measurement does not establish a processing-time guarantee.
- Full web definition-of-done checks will run after Item B in the same assigned task. UAT placement checks and compliance review remain outstanding; nothing is ready for real submission.

## Product-owner decisions (2026-11-03)
Build these from `docs/HANDOFF-workflow-and-forms.md`, in order, before renewal:
- DRAFT and DEMO are printed on the forms themselves.
- Date formats on official forms are set by each organization's administrator, per organization and per form field. Form III `arc.date` stays blocked until set.
- Who approves is configured through a workflow engine per form (stages, transitions, rules such as role, date and duration). Seeded role access doesn't change.
- The UAT team will check that values land in the right boxes. This and the compliance review are still outstanding, so nothing is ready for real submission.

## Next task
Item A is ready for review. After acceptance, Item B in `docs/HANDOFF-workflow-and-forms.md` is next; do not start renewal before Item C is reviewed.

Start with `docs/HANDOFF-workflow-and-forms.md`, then `docs/HANDOFF-licence-application.md`, which lists what is left after it. Original forms are in `apps/web/assets/forms/`, decoded by `tools/extract_forms.py`.

## Roadmap: not built yet (these sections show a "planned" page)
Each needs its logic ported from `docs/artifact/src/`. See the `quayzen-product` skill.
1. Remaining section overviews and their charts: `insights.js`, `overviews.js`. Chart helpers are in `src/lib/charts.ts`.
2. Document templates with {{markers}} and checklist-line uploads come with the licence application, which they depend on: `x_docs.js`. By-category chart on the Documents page: with the charts in item 1.
3. Annual returns overview page: `overviews.js`
4. Office space comparison: `space.js`
   Capital inflow targets, in the investment section: end of `budget.js`
   Business plan parts tied to the licence application come with it: linked plan from an application, the plan document builder, Technical Evaluation Form import: `x_bplink.js`, `x_bpb.js`. Today's Excel import reads the Quayzen template only.
5. Remaining licence application and changes work, including renewal, Schedule IV and surrender: `lic_*.js`, `x_pkg.js`, `js/forms/*.js`
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
