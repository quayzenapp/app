# Brief: finishing the product

Read `AGENTS.md` first. Do **one item at a time**, on the branch `feature/licence-application`. After each item: run the definition of done, commit on that branch (end the message with a `Co-Authored-By` line naming your own model), update `docs/STATUS.md`, report what's done, what isn't, and any test that failed, and **stop for review**. Don't push or merge.

## Sources
Artifact logic, for reading only, never to execute (`docs/artifact/src/`):

| File | Size | Holds |
|---|---|---|
| `lic_core.js` | 39 KB | Data model, statuses, readiness, form field maps |
| `lic_ui.js` | 78 KB | Application screens and steps |
| `lic_gen.js` | 61 KB | Filling the PDF, Word and Excel forms |
| `lic_filings.js` | 51 KB | Later filings: notice of change, renewal, Schedule IV, surrender |
| `lic_hooks.js` | 15 KB | Dashboard card, demo applicant, wiring to company records |
| `x_docs.js` | 48 KB | Supporting documents and `{{marker}}` templates |
| `x_pkg.js`, `x_formats.js` | 18 KB | Application pack |
| `x_bplink.js`, `x_bpb.js` | 53 KB | Plan linked to an application; plan document builder; Technical Evaluation Form import |

These files are large. Search them and read the relevant part rather than loading them whole.

Original Commission forms, already decoded, unchanged, in `apps/web/assets/forms/`:
- PDF: `s1` (Schedule I), `s3`, `s4`, `s5`, `s6`, `o3`, `o5`
- Word: `ap_decl`, `ubo`, `ds`, `bprofile`
- Excel: `tef`
- `d1`, `p1` to `p6`, `caa` (development approvals) and `le` (visa landing endorsement) belong to other modules, so leave them for now.

## Patterns to copy
- Annual returns are the closest model: `src/lib/ar/` and `src/app/(app)/returns/`. They show a verbatim port of a reviewed calculation file, a tenant table with row level security, workflow actions, second-person approval, a fixed snapshot, and PDF fill with read-back (`src/lib/ar/pdf.ts`).
- Exports: `src/lib/report-export.ts`. Files: `src/lib/storage.ts`. Documents can link to any record: `src/lib/documents.ts`.
- Business plan versions: `src/app/(app)/bplan/`.
- The `apply` section is built (`src/app/(app)/apply/`, `src/lib/lic/`). The `changes` section uses the same `licensing` permission and is still a placeholder.

## Stages
Stages 1 and 2 and most of Stage 3 are **done**: see `docs/STATUS.md` and `git log`. Tests: `pnpm test:lic`, `pnpm test:forms`, `tests/e2e/run.sh lic`.

**Finish Stage 3.** Not built yet:
- `{{marker}}` document templates, and extra checklist lines the Commission asks for (`x_docs.js`).
- Conditions from the Approval in Principle and licence becoming obligations, and the rest of `FORMS["app-setup"]` (`lic_ui.js`).
- A business plan draft created from the application's projections, and the plan document builder (`x_bplink.js`, `x_bpb.js`). Plans are in `src/app/(app)/bplan/`.
- Technical Evaluation Form import (`bplParse` in `x_bplink.js`; `app-tef`, `tef-import` in `lic_ui.js`).
- Importing people from the company register (`ap-import-people`), and suggestions from the company profile (`app-sug`, the `sug` key in the specs).
- Editable Word and PDF copies of forms (`model` in `APP_OUTPUTS`, `lic_gen.js`), the Section 64 letter, draft board resolutions and the summary report.

**Stage 4: Licence Changes (part).** `/changes` now has Notice of Change (Schedule III), optional offshore Form III, new-member Schedule I profiles, a 30-day deadline, review/approval with a fixed copy, manual submission/acknowledgement records, and PDF pack generation with read-back. Source: `lic_filings.js`; implementation: `src/lib/lic/change-*.ts`, `src/lib/lic/changes.ts`, `src/app/(app)/changes/`.

The next filing is **renewal (Schedule V)**. After it: Schedule IV, then surrender (Schedule VI with offshore Form V). `createLic` exposes `FILING_KINDS`, `FILING_STATUS` and `S3_ITEMS`. Editable Word/PDF copies and one-click register suggestions for the notice are not built.

**Source discrepancy requiring review:** offshore Form III, representative cessation date (`arc.date`, PDF field `Text43`), is labelled DD/MM/YY in the original PDF. The artifact fills DD/MM/YYYY. The notice pack refuses delivery if this date is entered, pending a reviewed mapping decision. Do not silently change it. No compliance professional has reviewed this feature.

**After that, the remaining placeholder sections, one at a time:** Development approvals (`x_dev.js`; forms `d1`, `p1` to `p6`, `caa`), Checklists (`x_check.js`), How It Works (`x_flow.js`, `x_sysmap.js`), the visa workflow and landing endorsement form (`x_visa.js`, `le`), Commission request approvals (`pages1.js`), office space comparison (`space.js`), capital inflow targets (end of `budget.js`), section overviews (`insights.js`, `overviews.js`). Then the production items in `docs/STATUS.md`.

## Stop and ask rather than guess
- A form field whose meaning isn't clear from the source.
- Any legal or compliance rule you would have to invent.
- A form the artifact fills in a way that looks wrong: report it, and don't silently change it.

Nothing here has been reviewed by a compliance professional. Say so in your report rather than claiming the output is ready to submit.
