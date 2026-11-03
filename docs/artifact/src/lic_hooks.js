/* ===== lic_hooks.js ===== */
/* Connects licensing to the rest of Quayzen: dashboard, reminders, documents, welcome screen, guide and demo data. */

/* Reminders: planned submission, certified copies going past 30 days, filings due */
const _collectReminders = collectReminders;
collectReminders = function () {
  const out = _collectReminders();
  if (!Store.can("licensing")) return out;
  const add = (kind, title, due, nav, detail = "") => { const d = daysUntil(due); out.push({ kind, title, due, days: d, nav, detail, state: d < 0 ? "Overdue" : d === 0 ? "Due today" : "Due soon" }); };
  for (const a of Store.list("apps").filter(x => !APP_LOCKED.includes(x.status))) {
    if (a.planned_date && daysUntil(a.planned_date) <= 30) add("Licence application", `Planned submission: ${a.title}`, a.planned_date, { kind: "app", id: a.id }, `Status: ${a.status}`);
    checklistRows(a).filter(r => r.it.cert30 && r.e.cert_date && r.status !== "Not applicable").forEach(r => { const exp = addDays(r.e.cert_date, 30); if (daysUntil(exp) <= 14) add("Certified copy goes past 30 days", `${r.it.t.split(",")[0]}${r.who ? " - " + r.who : ""}`, exp, { kind: "app", id: a.id, step: "checklist" }); });
  }
  Store.list("filings").filter(f => f.due_date && !["Submitted", "Acknowledged", "Closed"].includes(f.status) && daysUntil(f.due_date) <= 30).forEach(f => add("Licence filing", f.title, f.due_date, { kind: "filing", id: f.id }, `Status: ${f.status}`));
  return out.sort((a, b) => a.days - b.days);
};
const _remgo = ACTIONS.remgo;
ACTIONS.remgo = el => { const n = JSON.parse(el.dataset.nav); if (n.kind === "app") { UI.appId = n.id; UI.tab.apply = n.step || "overview"; return navTo("apply"); } if (n.kind === "filing") return navTo("changes", { kind: "filing", id: n.id }); return _remgo(el); };

/* Documents linked to an application or filing */
const _linkLabel = linkLabel;
linkLabel = function (d) { if (d.link_type === "apps") { const a = Store.get("apps", d.link_id); return a ? `Licence application: ${a.title}` : ""; } if (d.link_type === "filings") { const f = Store.get("filings", d.link_id); return f ? `Licence filing: ${f.title}` : ""; } return _linkLabel(d); };

/* Dashboard: the application comes first while the company is applying */
const _dash = PAGES.dashboard;
PAGES.dashboard = () => {
  const html = _dash(), a = Store.can("licensing") ? currentApp() : null;
  if (!a || (Store.company().stage !== "applicant" && a.status === APP_STATUS.issued)) return html;
  const R = appReadiness(a), done = R.steps.filter(s => !s.missing.length).length;
  const card = `<div class="card hl"><h3>Licence application <span>${badge(a.status)}</span></h3>${processStrip(a.status)}
    <div class="row" style="margin-top:10px"><span class="small">${done} of ${R.steps.length} steps complete · ${R.docs.ok} of ${R.docs.total} documents ready${a.planned_date ? ` · planned submission ${fmtDate(a.planned_date)}` : ""}</span><button class="btn sm p" data-act="nav" data-section="apply">Open the application</button></div></div>`;
  return html.replace('<div class="stats">', card + '<div class="stats">');
};
const _gs = gettingStarted;
gettingStarted = function (c, lic) { return c.stage === "applicant" ? "" : _gs(c, lic); };

/* Welcome: say who the system is for now that applicants can use it */
const _welcome = welcome;
welcome = function () {
  return _welcome().replace(/<p>For companies holding an Authorised Person licence[^<]*<\/p>/, '<p>For companies applying for, or holding, an Authorised Person licence or BSI designation with the Colombo Port City Economic Commission. Prepare the licence application and its forms, then keep your Port City records, track licence conditions and obligations, answer Commission requests and prepare annual returns and licence filings.</p>')
    .replace('(made-up sample data, clearly marked DEMO)</span></p>', '(made-up sample data, clearly marked DEMO)</span></p><p>or <button class="btn" data-act="app-demo">Try a demo licence application</button> <span class="small muted">(a made-up applicant company)</span></p>')
    .replace('<button class="btn p">Create company</button></form>', '<select name="stage" aria-label="Where you are"><option value="licensed">We hold a licence</option><option value="applicant">We are applying for a licence</option></select><button class="btn p">Create company</button></form>');
};
const _newco = FORMS.newco;
FORMS.newco = async form => {
  const st = (form.querySelector('[name="stage"]') || {}).value;
  await _newco(form);
  if (st === "applicant" && Store.cid) { await Store.saveCompany({ stage: "applicant" }); UI.section = "apply"; location.hash = "apply"; render(); }
};

/* Company profile: whether the company is applying or licensed */
COMPANY_FIELDS.push(F("stage", "Where the company is", "choice", { choices: ["applicant", "licensed"], help: "'applicant' shows the licence application first on the dashboard. It changes to 'licensed' when you set up records from an issued licence." }));
COMPANY_DEF.fmap.stage = COMPANY_FIELDS[COMPANY_FIELDS.length - 1];

/* Guide text */
const _howto = PAGES.howto;
PAGES.howto = () => _howto().replace("The system is for companies that already hold an Authorised Person licence or BSI designation.", "The system is for companies applying for, or holding, an Authorised Person licence or BSI designation.")
  .replace('<ol>\n  <li><b>Company profile</b>', '<ol>\n  <li><b>Licence application</b> (if you are applying) - enter the details once; Quayzen fills Schedule I, the Technical Evaluation Form and the other Commission forms, and tracks the supporting documents. When the licence is issued, it copies the details into your compliance records.</li>\n  <li><b>Company profile</b>')
  .replace("<li><b>Plan ahead</b>", "<li><b>Licence changes</b> - notify changes (Schedule III, and Form III for offshore companies), apply for renewal (Schedule V), file the Schedule IV annual return, or give notice of surrender (Schedule VI and Form V).</li>\n  <li><b>Plan ahead</b>")
  .replace('<p class="small muted">The licence application forms (Required Documents checklist, declaration forms) are not tracked, because companies start using this system after their licence is issued.</p>',
    '<p class="small muted">Licence forms supplied on 1 November 2026: Schedules I, III, IV, V and VI; offshore Forms III and V; AP Declaration; UBO Declaration; Information of Directors and Shareholders; Business Profile and KMP Information; Technical Evaluation Form (two sheets); and the Commission\'s list of required supporting documents. The Offshore Company Registration Form (Form I) was not supplied.</p>');

/* ---------- demo applicant (made-up data, marked DEMO) ---------- */
ACTIONS["app-demo"] = async () => {
  const cid = await Store.createCompany("Harbourline Analytics (Private) Limited (DEMO)", true);
  await Store.saveCompany({ stage: "applicant", legal_form: "Private Company with Limited Liability", country_of_incorporation: "Singapore", registration_no: "DEMO-202612345K", register_address: "DEMO 10 Marina Boulevard\n#20-01 Marina Bay Financial Centre\nSingapore 018983",
    contact_name: "Nadeesha Perera (DEMO)", contact_email: "demo.contact@example.com", contact_phone: "+94 11 000 0000", signatory_name: "Arjun Mehta (DEMO)", signatory_designation: "Director" }, cid);
  for (const u of [["Helen Tan (DEMO)", "Singaporean", 60], ["Arjun Mehta (DEMO)", "Indian", 40]]) await Store.save("ubo", { full_name: u[0], nationality: u[1], ownership_pct: u[2], date_of_birth: "1975-04-12", place_of_birth: "Singapore", country_of_residence: "Singapore", residential_address: "DEMO address", business_address: "DEMO 10 Marina Boulevard, Singapore", email: "demo@example.com", mobile: "+65 0000 0000", passport_number: "DEMO-P123 (Singapore)", nature_extent: "Holds shares through Harbourline Holdings Pte Ltd (DEMO).", declaration_status: "Not prepared", data_source: "Demo" });
  const yrs = (a, g = 1.25) => Array.from({ length: 10 }, (_, i) => Math.round(a * Math.pow(g, i)));
  const rev = yrs(400000), exp = rev.map(x => Math.round(x * 0.78));
  const id = await Store.save("apps", { title: "Authorised Person only application", app_type: "Authorised Person only", origin: "Foreign", legal: "Company", planned_date: addDays(today(), 21), status: APP_STATUS.prep, data_source: "Demo",
    p1: { name: "Harbourline Analytics (Private) Limited (DEMO)", address: "DEMO 10 Marina Boulevard\n#20-01 Marina Bay Financial Centre\nSingapore 018983", country: "Singapore", tel: "+65 0000 0000", email: "demo.applicant@example.com" },
    q: { reg_no: "DEMO-202612345K", co_type: "Private company limited by shares", lk_inc: "No", group_sl: "No", regulated: "No", premises_owned: "No" },
    p2: { sectors: ["Information Technology", "Advisory service"], description: "Data analytics, software development and business process services for clients outside Sri Lanka, delivered from an office in Colombo Port City.", loc_within: true, loc_within_addr: "DEMO Unit 12-04, Port City Business Centre\nColombo Port City\nColombo 01", floor_sqm: 320,
      fdi_currency: "USD", fdi_quantum: 1500000, fdi_mode: "Equity", fdi_source: "Harbourline Holdings Pte Ltd, Singapore (DEMO)", lkr_currency: "LKR", lkr_quantum: 0, lkr_mode: "Equity", lkr_source: "Not applicable", signatory: "Arjun Mehta (DEMO)", signatory_designation: "Director", contact: "Nadeesha Perera (DEMO)", other_info: "This is a demo application with made-up data." },
    p6: { objective: "To serve the group's clients in Asia and the Middle East from Colombo Port City.", products: "Data analytics, software development, managed reporting services.", target_market: "Corporate clients in Singapore, the UAE and India.", strategy: "Open the office in year 1 with 25 staff, grow to 90 staff by year 5, mainly local hires, with group specialists seconded at the start.", controls: "Group information security policy (ISO 27001 aligned), anti-money laundering and anti-bribery policies, quarterly internal audit.",
      mp: { mp: { local: 4, nonlocal: 2, remun: "USD 420,000 a year" }, ts: { local: 12, nonlocal: 1, remun: "USD 380,000 a year" }, sk: { local: 4, nonlocal: 0, remun: "USD 60,000 a year" }, us: { local: 0, nonlocal: 0 }, cg: { local: 2, nonlocal: 0, remun: "USD 24,000 a year" } }, mp_total_remun: "USD 884,000 a year" },
    bp: { operating_model: "Delivery teams in Port City work for group clients under service agreements. Sales stay with the group in Singapore.", assumptions: "Revenue grows 25% a year; costs are about 78% of revenue." },
    marks: { "p2.sup_name": "Not applicable", "p2.sup_address": "Not applicable", "p2.sup_official": "Not applicable", "p2.sup_designation": "Not applicable", "p2.sup_phone": "Not applicable", "p2.sup_email": "Not applicable" },
    tef: { year1: "2027-04-01", v: { fdi_equity: [1000000, 500000], revenue: rev, expenses: exp, net_income: rev.map((r, i) => r - exp[i]), m_local: [4, 5, 6, 7, 8, 8, 9, 9, 10, 10], m_foreign: [2, 2, 2, 1, 1, 1, 1, 1, 1, 1], m_rem_local: [180000, 230000, 280000, 330000, 380000, 390000, 440000, 450000, 500000, 510000], m_rem_foreign: [240000, 250000, 260000, 140000, 145000, 150000, 155000, 160000, 165000, 170000],
      o_local: [18, 30, 45, 60, 80, 85, 90, 95, 100, 105], o_foreign: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0], o_rem_local: [270000, 450000, 680000, 900000, 1200000, 1280000, 1350000, 1430000, 1500000, 1580000], o_rem_foreign: [60000, 62000, 64000, 0, 0, 0, 0, 0, 0, 0], floor: [320, 320, 480, 480, 640, 640, 640, 800, 800, 800] },
      d: { fdi_equity: { provider: "Harbourline Holdings Pte Ltd, Singapore (DEMO) - share subscription", docref: "Board resolution and bank statement (DEMO)" } } },
    prof: { sectors: "Information Technology / Data analytics", years_exp: "Information Technology - 9 years / Data analytics - 6 years", entities: [{ name: "Harbourline Holdings Pte Ltd (DEMO)", country: "Singapore", type: "Parent", years: "12" }, { name: "Harbourline Analytics FZ-LLC (DEMO)", country: "United Arab Emirates", type: "Affiliate", years: "4" }],
      countries: "Singapore, United Arab Emirates, India", segments: "Corporate", client_sectors: "Banking, logistics, retail", parent: { sectors: "Information Technology", years_exp: "Information Technology - 12 years", employees: "420", countries: "Singapore, Malaysia, UAE, India", segments: "Corporate", client_sectors: "Banking, logistics" } },
    decl: { director1: "Arjun Mehta (DEMO)", director2: "Helen Tan (DEMO)", presenter: { name: "Nadeesha Perera (DEMO)", capacity: "Company Secretary", email: "demo.contact@example.com", tel: "+94 11 000 0000", mobile: "+94 77 000 0000", address: "DEMO Colombo 03" } },
    checklist: { fee: { status: "Not started" }, coi: { status: "Certified", cert_date: addDays(today(), -12) }, constitution: { status: "Ready" }, res_signatory: { status: "Received" } },
    events: [{ at: nowIso(), by: Store.uid, status: APP_STATUS.prep, note: "Demo application loaded" }] });
  const P = (o) => Store.save("app_people", Object.assign({ app_id: id, marks: {}, data_source: "Demo" }, o));
  await P({ kind: "Corporate", name: "Harbourline Holdings Pte Ltd (DEMO)", roles: [ROLE.sh], shareholding_pct: 100, nationality: "Singapore", address: "DEMO 10 Marina Boulevard, Singapore 018983", id_no: "DEMO-201400001H", other_businesses: "Harbourline Analytics FZ-LLC (DEMO)", jurisdictions: "United Arab Emirates", years_operation: "4" });
  await P({ kind: "Individual", name: "Arjun Mehta (DEMO)", roles: [ROLE.dir, ROLE.sig], nationality: "Indian", address: "DEMO Singapore", id_no: "DEMO-Z1234567", position: "Director", title: "Mr", dob: "1978-02-03", pob: "Mumbai", gender: "Male", passport_no: "DEMO-Z1234567", passport_expiry: "2031-05-30", passport_country: "India", passport_authority: "Ministry of External Affairs", residence_length: "Visits only", work_permit: "No", other_businesses: "Harbourline Holdings Pte Ltd (DEMO)", jurisdictions: "Singapore", years_operation: "12" });
  await P({ kind: "Individual", name: "Helen Tan (DEMO)", roles: [ROLE.dir], nationality: "Singaporean", address: "DEMO Singapore", id_no: "DEMO-K7654321", position: "Director (non-executive)", title: "Ms", dob: "1975-04-12", pob: "Singapore", gender: "Female", passport_no: "DEMO-K7654321", passport_expiry: "2030-01-15", passport_country: "Singapore", passport_authority: "Immigration and Checkpoints Authority", work_permit: "No", other_businesses: "Harbourline Holdings Pte Ltd (DEMO)", jurisdictions: "Singapore", years_operation: "12" });
  await P({ kind: "Individual", name: "Nadeesha Perera (DEMO)", roles: [ROLE.kmp, ROLE.contact], nationality: "Sri Lankan", address: "DEMO Colombo 03", id_no: "DEMO-198012345678", designation_pc: "Country Manager", years_sector: 11 });
  await Store.audit("apps", id, "Created", "Demo application loaded (made-up data)");
  UI.appId = id; UI.tab.apply = "overview"; UI.section = "apply"; location.hash = "apply"; render(); toast("Demo applicant loaded. All details are made up.");
};
MODULE_LABELS.licensing = "Licence application and changes";

