# Brief: workflow engine, date formats, printed marks

These are the product owner's decisions of 2026-11-03. They replace the three "open questions" that were in `docs/STATUS.md`. Read `AGENTS.md` first.

Do **one item at a time, in this order**, on `feature/licence-application`. After each item, run the whole definition of done, commit (with a `Co-Authored-By` line naming your own model), update `docs/STATUS.md`, report, and **stop for review**. Don't push or merge. Renewal (Schedule V) waits until Item C is reviewed, so that it is built on the engine.

If a rule below would make you invent a compliance rule, or two rules conflict, stop and ask.

## Item A: print DRAFT and DEMO on the forms
- Every page of a form that isn't from an approved copy shows DRAFT. Every page of a form from a demo organization shows DEMO, even when approved. An approved form from a real organization shows neither.
- Applies to every Commission form the app produces: application forms and pack, notice of change including the continuation sheet and offshore Form III, and the annual return PDF. Keep the existing file name prefixes too.
- PDF: an overlay on each page. Form fields, field count and page count stay unchanged, entered values stay readable, and read-back still runs on the delivered file.
- Word: a watermark or header on every page. Excel: a mark that is visible on screen and in print, without changing any existing cell, formula or sheet name. If that isn't possible for a file, report it and don't deliver something unmarked.
- Stored approved copies are not changed. The mark is added when the file is produced.
- Tests: check for the mark in each format and each state (draft, approved, demo). Render at least one PDF page of each kind to an image in `tests/e2e/shots/` and look at it.

## Item B: tenant-configured date formats on official forms
- An organization's administrator sets the date format. There are two levels: an organization default in Admin > Controls, and an override per official form and field. The field override wins.
- Allowed formats are a fixed list: `DD/MM/YYYY` (the default, so existing output doesn't change) and `DD/MM/YY`.
- This only affects dates written into a single box. Forms with separate day, month and year boxes don't change. On-screen dates and stored values don't change.
- Offshore Form III `arc.date` (`Text43`) has no inherited default. It stays blocked until an administrator sets a format for that field. The refusal message says where to set it. Show the form's own label next to the setting, so the administrator can see what the form asks for.
- Approval stores the formats used in the fixed copy and its fingerprint. Changing a setting later must not alter an approved form. Approved copies with no stored format use `DD/MM/YYYY`, which is what they were made with.
- Pass the formatter in when creating the engines, with the current behaviour as the default. Keep the diff to the ported `gen.ts` as small as possible. If a form's date is outside this route (for example the annual return), list it in your report and don't change it.
- Settings are per tenant, permission-checked on the server, audited, and protected by row level security if stored in a new table.
- Tests: default output unchanged for every form, override wins, two-digit year read back from the PDF, `arc.date` blocked and then allowed, approved copy unchanged after a setting changes, another tenant unaffected, lower role refused.

## Item C: workflow engine, first phase
The owner wants approval defined per form: stages, transitions and special rules such as user role, date and duration. An organization's administrator configures it.

### First phase scope
The engine, the admin screen, and **notice of change only**. With the default definition, a notice must behave exactly as it does today, and existing tests must keep passing unchanged. Later phases, each its own item: renewal, Schedule IV and surrender built on it, then moving applications, annual returns, business plans and budgets across one at a time. Don't touch those in this phase.

### Model
- `WorkflowDefinition`: organization, form key (such as `filing.change`), version, draft or published. New tenant tables get row level security.
- Stages: key, label, kind (`edit`, `review`, `approved`, `recorded`, `closed`), and whether records are locked. Keep today's status names as stage keys, so reports and history keep working.
- Transitions: from, to, label, rules, effects.
- Each record stays on the definition version it started on. Publishing a new version doesn't change records in progress. Published versions can't be edited, only replaced.
- An append-only event table holds each transition: actor, time, from, to, note, and the rule results. The app role may insert and read only. Replace the JSON `events` only for notices.

### Rules: a fixed, typed list, never scripts
- `roles`: the actor's role is in a list.
- `permission`: a minimum level on the module.
- `differentPerson`: not the last editor, or not whoever acted at a named stage.
- `noteRequired`, `dateRequired`.
- `notBefore`, `notAfter`: today against a fixed date or a date field on the record, with an offset in days. Use `todayISO()`.
- `minDaysInStage`, `maxDaysInStage`: duration in the current stage.
- `check`: a named server check from a fixed list, such as "at least one change", "readiness" or "date format set".

A rule either blocks or only warns, as configured. A transition shows the person the reason it is unavailable.

### Effects: a fixed list
`snapshot` (make the fixed copy and fingerprint), `clearSnapshot`, `lock`. Editing a record past a review stage returns it to the stage named in the definition and clears the approval.

### Rules the configuration cannot change
Enforce these in code, when publishing and again at run time:
- Nothing moves by itself. Every transition is a person's action. A duration can block or warn, but it never moves a record. No background timers in this phase.
- The system never submits, signs, dates or sends. `recorded` stages only record what a person did.
- Every path to a `recorded` stage passes through a transition with the `snapshot` effect.
- A transition with `snapshot` needs `differentPerson`, unless the organization has turned off the second-person check in Admin > Controls. Keep using `src/lib/controls.ts`.
- A person can't approve a record holding restricted values their role can't see. Configuration can allow Reviewer to approve, but to do so the role also needs the access. The admin screen warns at publish time when a chosen role lacks it. **Don't change any seeded role's access.** Giving a role more access is the tenant administrator's decision in the role matrix.
- Once recorded, a record stays locked, and hidden fields stay protected from overwrite.
- A definition must be valid to publish: one start stage, every stage reachable, a path to `closed`, roles that exist.
- Transitions run on the server inside `withTenant`, with the record locked `FOR UPDATE`. The organization comes only from `getTenantContext()`.
- Definitions and publishing are permission-checked and audited.

### Admin screen
Admin > Workflows: forms, versions, and a draft editor using tables for stages, transitions, rules and effects. Show validation errors. A drag-and-drop canvas isn't needed in this phase. Use the existing admin classes and `ActionForm`.

### Default definition
Seed version 1 of `filing.change` for each organization, matching `CHANGE_NEXT`, today's approval checks and today's locks. Existing notices migrate onto it with their status and history kept.

### Tests
- Engine: a pure function that takes a definition, record, actor and date and returns allowed or blocked with reasons. Unit tests with hand-worked dates and durations, including month ends and the Asia/Colombo day boundary.
- Publishing refuses each invalid definition, including one that skips the snapshot or the second person.
- Browser: an administrator allows Reviewer to approve and gives that role ID access in the role matrix, and a notice then goes through; a date rule blocks and shows why; a record in progress stays on its old version; another organization and a lower role are refused by direct URL; repeated saves without reloading.

## Testing the filled forms
The UAT team will check that values land in the right boxes, and compliance review is still outstanding. Say so in every report. Nothing here is ready for real submission until that is done.
