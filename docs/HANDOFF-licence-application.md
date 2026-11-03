# Brief: licence application module

Read `AGENTS.md` first. Do **one stage at a time**, on a branch named `feature/licence-stage-N`. After each stage: run the definition of done, commit on that branch (end the message with a `Co-Authored-By` line naming your own model), update `docs/STATUS.md`, report what's done, what isn't, and any test that failed, and **stop for review**. Don't push or merge.

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
- The app has sections `apply` and `changes` under the `licensing` permission module in `src/lib/sections.ts`. They show a placeholder today.

## Stages
**Stage 1: application workflow, no form filling.** Applications with their people, status steps and readiness check, entered on screens matching the artifact's flow. Permissions under `licensing`. Dashboard card for an applicant organization (`Organization.stage`). A demo applicant in the Harbourline organization, marked DEMO. Tests: readiness rules, statuses, tenant isolation, role limits.

**Stage 2: official forms.** Fill Schedule I (413 fields), the Technical Evaluation Form, and the four Word forms from an application, with read-back. Declarations, signatures and dates stay blank. A draft is marked DRAFT, demo data DEMO. Tests: open each output with a real parser and compare values against hand-written expectations; check the form's other content is unchanged.

**Stage 3: supporting documents and pack.** The required-documents checklist with an upload on each line, extra lines the Commission asks for, `{{marker}}` templates, and the application pack ZIP. Second-person approval with a fixed copy. Recording a submission and then the licence issue, which sets up company profile, licence, obligations and office records, and links a business plan.

**Stage 4: Licence Changes.** Notice of change, renewal, Schedule IV and surrender, with Offshore Forms III and V where they apply: `lic_filings.js`.

## Stop and ask rather than guess
- A form field whose meaning isn't clear from the source.
- Any legal or compliance rule you would have to invent.
- A form the artifact fills in a way that looks wrong: report it, and don't silently change it.

Nothing here has been reviewed by a compliance professional. Say so in your report rather than claiming the output is ready to submit.
