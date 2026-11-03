/* ===== pages1.js ===== */
/* Screens, part 1: shared screen helpers, Dashboard, Company, AP Application, Business Plan,
   Commission Requests, Workforce, Investment, Offices. Handlers register into ACTIONS / FORMS / CHANGES (see app.js). */


const PAGES = {}, VIEWS = {}, ACTIONS = {}, FORMS = {}, CHANGES = {}, EXTRAS = {}, AFTER_SAVE = {};
ACTIONS["fmt-go"] = el => { const p = UI.pendingRep; closeModal(); if (p) exportReport(p.rep, el.dataset.fmt, p.name); };

const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/* ---------- shared helpers ---------- */
function tabsHTML(section, tabs) {
  const cur = UI.tab[section] || tabs[0][0];
  return `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="tab${k === cur ? " on" : ""}" aria-selected="${k === cur}" data-act="tab" data-section="${section}" data-tab="${k}">${esc(l)}</button>`).join("")}</div>`;
}
const curTab = (section, first) => UI.tab[section] || first;

function reportHTML(rep) {
  const sub = (() => { const c = (Store.company() || {}).name || "", x = rep.subtitle || ""; return x.startsWith(c) ? x : [c, x].filter(Boolean).join(" · "); })();
  return `<div class="rdoc-head"><div><span class="eyebrow">Quayzen · Port City compliance</span><h2>${esc(rep.title)}</h2><p>${esc(fixDates(sub))}</p></div>${rep.demo ? '<span class="pill-demo">DEMO DATA</span>' : ""}</div>
  <div class="rdoc-body">${(rep.notes || []).length ? `<ul class="rnotes">${rep.notes.map(n => `<li>${esc(fixDates(n))}</li>`).join("")}</ul>` : ""}
  ${rep.sections.map(s => { const nc = s.columns ? numericCols(s) : []; return `<section class="rsec">${s.heading ? `<h3>${esc(fixDates(s.heading))}</h3>` : ""}${s.text ? `<p class="pre">${esc(fixDates(s.text))}</p>` : ""}
   ${s.columns ? `<div class="tw"><table class="t"><thead><tr>${s.columns.map((c, i) => `<th class="${nc[i] ? "num" : ""}">${esc(c)}</th>`).join("")}</tr></thead><tbody>
   ${(s.rows || []).map(r => `<tr>${s.columns.map((_, i) => `<td class="${typeof r[i] === "number" ? "num" : ""}">${esc(cellText(r[i]))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${s.columns.length}" class="empty">None recorded.</td></tr>`}</tbody></table></div>` : ""}</section>`; }).join("")}
  <p class="small muted">Generated ${fmtDate(today())}. Working report, not an official Commission document.</p></div>`;
}
const FMT_ICON = { xlsx: "M4 4h16v16H4V4Zm0 5h16M4 14h16M9 4v16", pdf: "M6 3h9l4 4v14H6V3Zm8 0v5h5M9 13h6M9 17h4", docx: "M6 3h9l4 4v14H6V3Zm8 0v5h5M9 12l1.5 5L12 13l1.5 4L15 12" };
function exportButtons(label = "Download") {
  return `<div class="dlbar"><span class="small muted">${esc(label)}</span>${["xlsx", "pdf", "docx"].map(f => `<button class="btn sm" data-act="rep-export" data-fmt="${f}"><img class="pi" src="${qzIconDir()}/${f}.svg" alt="" draggable="false">${FMT_NAMES[f]}</button>`).join("")}</div>`;
}
/* Shows a report with export buttons; the report is rebuilt at export time */
function reportPanel(code, args, builder) {
  UI.lastRep = { code, args, builder };
  const rep = builder ? builder() : buildReport(code, args);
  return `<div class="card rdoc">${reportHTML(rep)}${exportButtons()}</div>`;
}
ACTIONS["rep-export"] = el => {
  const L = UI.lastRep; if (!L) return;
  const rep = sezDeep(L.builder ? L.builder() : buildReport(L.code, L.args));
  const name = (rep.title || "report").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) + "_" + today();
  exportReport(rep, el.dataset.fmt, (rep.demo ? "DEMO_" : "") + name);
};

function needDifferentPerson(preparedBy, what) {
  if (Store.setting("separate_reviewer", true) && preparedBy && preparedBy === Store.uid)
    throw [`A different person must ${what}. You prepared or last changed it. (An administrator can turn this control off in Setup > Controls for a one-person team.)`];
}
function fieldRow(label, html, help) { return `<div class="fld"><label>${esc(label)}</label>${html}${help ? `<span class="help">${esc(help)}</span>` : ""}</div>`; }
function statCard(n, label, nav, kind = "") { return `<button class="stat ${kind}" ${nav ? `data-act="nav" data-section="${nav}"` : "disabled"}>${nav ? `<i class="sic">${pic(nav)}</i>` : ""}<b>${esc(n)}</b><span>${esc(label)}</span></button>`; }

/* ======================= DASHBOARD ======================= */
PAGES.dashboard = () => {
  const c = Store.company(), rem = collectReminders();
  const over = rem.filter(r => r.days < 0).length;
  const can = m => Store.can(m);
  const stats = [];
  if (can("requests")) stats.push(statCard(Store.list("requests").filter(r => !["Submitted", "Closed"].includes(r.status)).length, "Open Commission requests", "requests"));
  if (can("obligations")) stats.push(statCard(Store.list("obligations").filter(o => !["Met", "Not applicable"].includes(o.status)).length, "Obligations not yet met", "obligations"));
  if (can("workforce")) { const h = actualHeadcount(today()); stats.push(statCard(h.total, `Employees today (${h.local} Sri Lankan, ${h.foreign} other)`, "workforce")); }
  if (can("investment")) stats.push(statCard(Store.list("investments").filter(i => i.review_status !== "Confirmed").length, "Funding records awaiting review", "investment", "warn"));
  if (can("visas")) stats.push(statCard(Store.list("visas").filter(v => v.expiry_date && daysUntil(v.expiry_date) <= 90 && daysUntil(v.expiry_date) >= -30).length, "Visas expiring within 90 days", "visas"));
  if (can("returns")) { const r = Store.list("returns").sort((a, b) => b.period_end.localeCompare(a.period_end))[0];
    stats.push(statCard(r ? r.status : "None", r ? "Latest annual return: " + r.title : "No annual return started", "returns")); }
  const lic = c.main_licence_id ? Store.get("licences", c.main_licence_id) : null;
  const v = can("bplan") ? referencePlan() : null;
  return `<div class="hero"><div class="t"><div class="hello">Welcome back</div><h1>${esc(c.name)}</h1><div class="dt">${fmtDate(today())}</div></div><img class="hero-art" src="${qzDark() ? "art/portcity-dark.svg" : "art/portcity.svg"}" alt="Pencil drawing of Port City Colombo"></div>
  ${gettingStarted(c, lic)}
  <div class="stats">${stats.join("")}</div>
  <div class="cols">
   <div class="card"><h3>Coming up and overdue ${over ? `<span class="badge bad">${over} overdue</span>` : ""}</h3>
    ${rem.length ? `<ul class="rem">${rem.slice(0, 15).map(r => `<li class="${r.days < 0 ? "od" : r.days <= 7 ? "soon" : ""}">${pic(remIcon(r.kind), "rem-ic")}<span class="badge ${r.days < 0 ? "bad" : r.days <= 7 ? "warn" : "info"}">${r.days < 0 ? -r.days + " days overdue" : r.days === 0 ? "today" : "in " + r.days + " days"}</span>
      <div><b>${esc(r.kind)}</b>: ${r.nav ? `<a href="#" data-act="remgo" data-nav='${esc(JSON.stringify(r.nav))}'>${esc(r.title)}</a>` : esc(r.title)}<div class="muted small">${fmtDate(r.due)}${r.detail ? " · " + esc(r.detail) : ""}</div></div></li>`).join("")}</ul>${rem.length > 15 ? `<p class="muted small">and ${rem.length - 15} more.</p>` : ""}`
    : '<p class="muted">Nothing due in the reminder windows. Reminder windows are set in Setup > Controls.</p>'}</div>
   <div>
    ${lic ? `<div class="card lic-card">${licRing(lic)}<div><h3>Licence</h3><p><b>${esc(lic.title)}</b> ${esc(lic.number || "")} ${badge(lic.status)}</p><p class="small muted">Issued ${fmtDate(lic.issue_date) || "—"} · expires ${fmtDate(lic.expiry_date) || "—"}</p></div></div>` : ""}

    ${budgetMini()}
    ${v ? `<div class="card"><h3>Business plan vs actual</h3><p class="muted small">${esc(v.title)} v${v.version_no} (${esc(v.status)}). Plan figures are projections, not commitments.</p>${pvaMini(v)}</div>` : ""}
   </div></div>`;
};
function budgetMini() {
  if (!Store.can("budget")) return ""; const b = Store.list("budgets").find(x => x.fy_start <= today() && addMonths(x.fy_start, 12) > today()); if (!b) return "";
  const F = budgetFigures(b, today()), u = F.annual ? Math.round(F.ytdA / F.annual * 100) : 0, f = v => `${b.currency} ${fmtK(v)}`;
  return `<div class="card"><h3>${esc(b.title)}</h3>${meter("Spending to date vs budget to date", F.ytdA, F.ytdB || null, f)}<p class="small muted">${u}% of the annual budget of ${f(F.annual)} used. <a href="#" data-act="nav" data-section="budget">Open the budget</a></p></div>`;
}
function gettingStarted(c, lic) {
  const steps = [
    [!!(c.registered_address && c.tin && c.signatory_name), "Complete the company profile (address, TIN, contact and signatory)", "company"],
    [!!lic, "Record your AP licence or BSI designation and set it as the main licence", "obligations"],
    [Store.list("obligations").length > 0, "Add the conditions in your licence, approval or agreement as obligations", "obligations"],
    [Store.list("bplans").some(v => v.status === "Locked"), "Record the business plan you submitted, as the reference for comparison", "bplan"],
    [Store.list("employees").length > 0 && Store.list("offices").length > 0, "Enter your workforce and offices (or import them from Excel)", "workforce"]];
  const left = steps.filter(x => !x[0]); if (!left.length) return "";
  return `<div class="card hl"><h3>Getting started</h3><p class="small muted">This system is for companies that already hold an AP licence or BSI designation.</p>${steps.map(([ok, t, sec]) => `<div class="li">${ok ? '<span class="badge ok">done</span>' : '<span class="badge">to do</span>'} ${Store.can(SECTIONS.find(x => x[0] === sec)[2]) && !ok ? `<a href="#" data-act="nav" data-section="${sec}">${esc(t)}</a>` : esc(t)}</div>`).join("")}</div>`;
}
function pvaMini(v) {
  const rows = comparePlan(v); if (!rows.length) return '<p class="muted">Year 1 has not started yet.</p>';
  const y = rows[rows.length - 1];
  return `<p class="small">Year ${y.year} (${fmtDate(y.start)} to ${fmtDate(y.end)})</p><table class="t small"><thead><tr><th>Measure</th><th class="num">Plan</th><th class="num">Actual</th></tr></thead><tbody>${y.metrics.filter(m => ["investment_cum", "employees", "office", "revenue"].includes(m.key)).map(m => `<tr><td>${esc(m.label)}</td><td class="num">${m.plan == null ? "—" : fmtNum(m.plan)}</td><td class="num">${m.actual == null ? "—" : fmtNum(m.actual)}</td></tr>`).join("")}</tbody></table>`;
}
ACTIONS.remgo = el => {
  const n = JSON.parse(el.dataset.nav);
  const map = { request: ["requests", "requests"] };
  if (n.kind === "record") { const t = n.type; navTo(REG[t].module === "obligations" ? "obligations" : REG[t].module, { kind: "view", type: t, id: n.id }); }
  else if (n.kind === "doc") navTo("documents", { kind: "doc", id: n.id });
  else navTo(map[n.kind][0], { kind: "view", type: map[n.kind][1], id: n.id });
};

/* ======================= COMPANY ======================= */
const COMPANY_FIELDS = [
  F("name", "Company name (as in the public register)", "text", { required: true, group: "Public register entry" }),
  F("licence_number", "Licence number", "text", { group: "Public register entry", help: "As shown in the register, e.g. CPCEC/2026/0171. It should match your main licence record." }),
  F("register_address", "Address (as listed)", "textarea", { group: "Public register entry", help: "The register may show an overseas address. Your registered address in Sri Lanka is recorded separately below." }),
  F("legal_form", "Legal form", "text", { group: "Public register entry", list: "legalforms", help: "e.g. Private Company with Limited Liability" }),
  F("business_sector", "Business sector", "text", { group: "Public register entry", help: "As shown in the register and your licence. The annual return asks for it (item 1(d))." }),
  F("designation_type", "BSI designation", "choice", { lookup: "designation_types", group: "Public register entry", help: "Authorised Person only, or the type of Business of Strategic Importance. Used in the annual return (item 1(c))." }),
  F("bsi_gazette_no", "BSI gazette number", "text", { group: "Public register entry", help: "e.g. 2483/51" }),
  F("bsi_gazette_url", "BSI gazette link", "url", { group: "Public register entry", help: "Link to the gazette on the Port City website." }),
  F("register_checked", "Register entry last checked on", "date", { group: "Public register entry" }),
  F("registration_no", "Company registration number"),
  F("country_of_incorporation", "Country of incorporation"), F("incorporation_date", "Date of incorporation", "date"),
  F("operations_commenced", "Operations commenced?", "choice", { choices: YES_NO }), F("operations_commenced_date", "Operations commenced on", "date"),
  F("registered_address", "Registered address in Sri Lanka", "textarea", { help: "Used in the annual return (item 1(f))." }), F("tin", "TIN number"),
  F("roc_filing_info", "Forms submitted to the Registrar of Companies (or reason if none)", "textarea", { help: "Annual Return 2026, item 1(i)." }),
  F("main_licence_id", "Main licence record", "ref", { ref: "licences", help: "Add licences under Licences and Obligations." }),
  F("financial_year_end", "Financial year end (e.g. 31 March)"),
  F("contact_name", "Point of contact - name", "text", { group: "Contact and signatory" }), F("contact_email", "Point of contact - email", "text", { group: "Contact and signatory" }),
  F("contact_phone", "Point of contact - telephone", "text", { group: "Contact and signatory" }),
  F("signatory_name", "Authorised signatory - full name", "text", { group: "Contact and signatory" }), F("signatory_designation", "Authorised signatory - designation", "text", { group: "Contact and signatory" }),
  F("notes", "Notes", "textarea"),
];
const COMPANY_DEF = { label: "Company profile", fields: COMPANY_FIELDS, fmap: Object.fromEntries(COMPANY_FIELDS.map(f => [f.name, f])) };

PAGES.company = () => {
  const t = curTab("company", "overview");
  const tabs = tabsHTML("company", [["overview", "Overview"], ["profile", "Company profile"], ["people", "Directors and shareholders"], ["ubo", "Beneficial owners (UBO)"]]);
  if (t === "overview" && !(UI.view && UI.view.kind === "company-edit")) return tabs + companyOverview();
  if (t === "people") return tabs + listHTML("people");
  if (t === "ubo") return tabs + listHTML("ubo", { below: '<p><button class="btn" data-act="ubo-export">Download beneficial ownership particulars</button> <span class="small muted">To help complete Form_UBO, which the annual return asks for. It is not the signed declaration.</span></p>' });
  const c = Store.company(), w = Store.can("company", "write");
  const groups = groupsOf(COMPANY_DEF);
  if (UI.view && UI.view.kind === "company-edit") return tabs + `<div class="head"><div class="t"><h1>Edit company profile</h1></div></div>
    <form class="f" data-form="company" novalidate>${groups.map(([g, fs]) => `<fieldset><legend>${esc(g)}</legend><div class="grid2">${fs.map(f => `<div class="fld${f.type === "textarea" ? " wide" : ""}"><label for="f_${f.name}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ""}</label>${inputFor(f, c[f.name])}${f.help ? `<span class="help">${esc(f.help)}</span>` : ""}</div>`).join("")}</div></fieldset>`).join("")}
    <div class="row"><button class="btn p">Save</button><button type="button" class="btn" data-act="back">Cancel</button></div></form>`;
  return tabs + `<div class="head"><div class="t"><h1>Company profile</h1><p class="muted">Used to fill the annual return and responses to the Commission. Every change is kept in the history below.</p></div>
   <div class="acts">${w ? '<button class="btn p" data-act="company-edit">Edit</button>' : ""}</div></div>
   ${groups.map(([g, fs]) => `<div class="card"><h3>${esc(g)}</h3><dl class="kv">${fs.map(f => `<dt>${esc(f.label)}</dt><dd>${display(f, c[f.name]) || "—"}</dd>`).join("")}</dl></div>`).join("")}
   <div class="card"><h3>Change history</h3>${historyHTML(Store.history("companies", Store.cid))}</div>`;
};
ACTIONS["company-edit"] = () => go({ kind: "company-edit" });
FORMS.company = async form => {
  const raw = readForm(form), c = Store.company(), patch = {}, errs = [];
  for (const f of COMPANY_FIELDS) { if (!(f.name in raw)) continue; try { patch[f.name] = cleanValue(f, raw[f.name]); } catch (e) { errs.push(e); } }
  if (!patch.name) errs.push("Company name is required.");
  if (errs.length) throw errs;
  const changes = diff(COMPANY_DEF, c, Object.assign({}, c, patch));
  await Store.saveCompany(patch);
  await Store.audit("companies", Store.cid, "Updated", "Company profile", changes.length ? changes : null);
  toast("Company profile saved."); back();
};

/* Used by every "record that we sent it" step. The system never sends anything itself. */
function submissionModal(form, id, title, intro) {
  return `<h2>${esc(title)}</h2><p class="muted">${esc(intro)}</p><form class="f" data-form="${form}" data-id="${id}"><div class="grid2">
   ${fieldRow("Date submitted", `<input type="date" name="submitted_at" value="${today()}" required>`)}${fieldRow("How it was sent", '<select name="submission_method"><option>Email</option><option>Commission portal</option><option>By hand</option><option>Courier</option><option>Other</option></select>')}
   ${fieldRow("Reference (email subject, receipt or portal number)", '<input name="submission_ref">')}${fieldRow("Sent by (name)", `<input name="submitted_by_name" value="${esc(Store.name(Store.uid))}">`)}</div>
   <div class="row"><button class="btn p">Record submission</button><button type="button" class="btn" data-act="modal-close">Cancel</button></div></form>`;
}
ACTIONS["ubo-export"] = () => {
  const c = Store.company(), ubo = Store.canSee("ubo");
  chooseFormat({ title: "Beneficial ownership particulars", subtitle: c.name + " · as at " + fmtDate(today()), demo: !!c.is_demo,
    notes: ["Prepared to help complete the Beneficial Ownership Declaration Form (Form_UBO). It is not the declaration, is not signed, and must be checked against the official form."],
    sections: [{ heading: "Beneficial owners", text: ubo ? "" : "Identifying details are not included because your role cannot view them.",
      columns: ["Name", "Nationality", "Ownership / control %", ...(ubo ? ["Country of residence", "Residential address", "Passport number", "Nature and extent"] : []), "Declaration status"],
      rows: Store.list("ubo").map(u => [u.full_name, u.nationality, u.ownership_pct, ...(ubo ? [u.country_of_residence, u.residential_address, u.passport_number, u.nature_extent] : []), u.declaration_status]) },
      { heading: "Directors and shareholders", columns: ["Name", "Type", "Role", "Nationality", "Shareholding %"], rows: Store.list("people").filter(p => !p.ceased_date).map(p => [p.full_name, p.person_type, p.role, p.nationality, p.shareholding_pct]) }] }, (c.is_demo ? "DEMO_" : "") + "UBO_particulars_" + today());
};

/* ======================= BUSINESS PLAN (reference only) ======================= */
/* Companies using this system already hold a licence. The business plan they submitted is recorded as a
   reference, checked and locked by a second person, and used only to compare plan with actual progress. */
const BP_YEARS = 5;
const BP_COMMISSION = ["Submitted with the licence application", "Revised plan submitted to the Commission", "Requested or approved by the Commission", "Other (explain in notes)"];
function bpHashBody(v) { return JSON.stringify({ title: v.title, year1_start: v.year1_start, sections: v.sections || {}, years: v.years || [], milestones: (v.milestones || []).map(m => [m.milestone, m.target_date]) }); }
PAGES.bplan = () => {
  const vs = Store.list("bplans").sort((a, b) => b.version_no - a.version_no), w = Store.can("bplan", "write");
  const ref = referencePlan();
  return `<div class="head"><div class="t"><h1>Business plan reference</h1><p class="muted">Record the business plan your company submitted to the Commission, so actual progress can be compared with it. Business plan figures are projections, not commitments, unless your licence, approval or an agreement says otherwise. Year-by-year fields follow the AP Technical Evaluation Form.</p></div>
   <div class="acts">${w ? `<button class="btn p" data-act="bp-new">${vs.length ? "Record another plan version" : "Record the business plan"}</button>` : ""}${vs.length > 1 ? '<button class="btn" data-act="bp-compare">Compare versions</button>' : ""}</div></div>
   ${bpHighlights(ref)}
   <div class="tw"><table class="t"><thead><tr><th>Version</th><th>Title</th><th>What it is</th><th>Date given to the Commission</th><th>Status</th><th>Used for comparison</th></tr></thead><tbody>
   ${vs.map(v => `<tr><td>v${v.version_no}</td><td><a href="#" data-act="bp-open" data-id="${v.id}">${esc(v.title)}</a></td><td class="small">${esc(v.commission_status || "")}</td><td>${fmtDate(v.commission_date)}</td><td>${badge(v.status)}</td><td>${ref && ref.id === v.id ? '<span class="badge ok">Reference</span>' : ""}</td></tr>`).join("") || '<tr><td colspan="6" class="empty">No business plan recorded yet. Enter the figures from the plan you submitted with your licence application.</td></tr>'}</tbody></table></div>
   ${ref ? `<h2>Plan vs actual</h2><p class="muted">Compared with ${esc(ref.title)} v${ref.version_no}. Explain any large difference in the last column; the Commission may ask about progress against the plan.</p>${bpCharts(ref)}${pvaHTML(ref)}`
     : vs.length ? '<p class="note">Check and lock a plan version to use it for comparison.</p>' : ""}`;
};
function bpHighlights(ref) {
  const y = ref ? planYearNow(ref) : null; if (!y) return hlCards([{ value: Store.list("bplans").length, label: "Plan versions recorded" }, { value: ref ? "Not started" : "None", label: "Plan year", sub: ref ? "Year 1 has not started" : "lock a version to compare" }]);
  const m = k => y.metrics.find(x => x.key === k), card = (k, l, f) => { const x = m(k); return { value: x.plan ? pct(x.actual || 0, x.plan) + "%" : "—", label: l, sub: `${f(x.actual)} of ${x.plan != null ? f(x.plan) : "—"} planned`, kind: x.plan && pct(x.actual || 0, x.plan) < 75 ? "warn" : "" }; };
  const usd = v => v == null ? "—" : "USD " + fmtK(v);
  return hlCards([{ value: "Year " + y.year, label: "Current plan year", sub: `${fmtDate(y.start)} to ${fmtDate(y.end)}` }, card("investment_cum", "Cumulative investment vs plan", usd), card("employees", "Employees vs plan", fmtNum), card("office", "Office space vs plan", v => v == null ? "—" : fmtNum(v) + " sqm"), card("revenue", "Revenue vs plan (this year)", usd)]);
}
function pvaHTML(v) {
  const rows = comparePlan(v), w = Store.can("bplan", "write");
  if (!v.year1_start) return '<p class="muted">Set the Year 1 start date to compare.</p>';
  if (!rows.length) return '<p class="muted">Year 1 has not started yet.</p>';
  return rows.map(y => `<div class="card"><h3>Year ${y.year}: ${fmtDate(y.start)} to ${fmtDate(y.end)} ${y.complete ? "" : `<span class="badge info">in progress, actuals to ${fmtDate(y.asAt)}</span>`}</h3><div class="tw"><table class="t"><thead><tr><th>Measure</th><th class="num">Plan (projection)</th><th class="num">Actual</th><th class="num">Difference</th><th>Where the actual comes from</th><th>Explanation of difference</th></tr></thead><tbody>
   ${y.metrics.map(m => `<tr><td>${esc(m.label)}</td><td class="num">${m.plan == null ? "—" : fmtNum(m.plan)}</td><td class="num">${m.actual == null ? "—" : fmtNum(m.actual)}</td><td class="num ${m.diff < 0 ? "neg" : ""}">${m.diff == null ? "" : fmtNum(m.diff)}</td><td class="small muted">${esc(m.source)}</td>
   <td>${w ? `<input value="${esc(m.note)}" data-change="pva-note" data-id="${v.id}" data-k="${y.year}:${m.key}" aria-label="Explanation" placeholder="Add an explanation">` : esc(m.note)}</td></tr>`).join("")}</tbody></table></div></div>`).join("");
}
CHANGES["pva-note"] = async el => { const v = Store.get("bplans", el.dataset.id); const notes = Object.assign({}, v.notes || {}, { [el.dataset.k]: el.value.trim() }); await Store.save("bplans", { notes }, v.id); await Store.audit("bplans", v.id, "Explanation added", `Plan vs actual ${el.dataset.k}: ${el.value.trim().slice(0, 80)}`); };

ACTIONS["bp-new"] = async () => {
  const n = Math.max(0, ...Store.list("bplans").map(v => v.version_no || 0)) + 1;
  const id = await Store.save("bplans", { title: "Business plan", version_no: n, status: "Draft", commission_status: n === 1 ? BP_COMMISSION[0] : BP_COMMISSION[1], year1_start: null, sections: {}, years: Array.from({ length: BP_YEARS }, () => ({})), milestones: [], notes: {}, prepared_by: Store.uid });
  await Store.audit("bplans", id, "Created", `Business plan v${n} being recorded`);
  go({ kind: "bpedit", id });
};
ACTIONS["bp-open"] = el => go({ kind: "bpview", id: el.dataset.id });
ACTIONS["bp-edit"] = el => go({ kind: "bpedit", id: el.dataset.id });
ACTIONS["bp-compare"] = () => go({ kind: "bpcompare" });

VIEWS.bpview = ({ id }) => {
  const v = Store.get("bplans", id); if (!v) return '<p class="empty">Not found.</p>';
  const w = Store.can("bplan", "write"), ap = Store.can("bplan", "approve"), locked = v.status === "Locked", ref = referencePlan();
  const docs = Store.list("docs").filter(d => d.link_type === "bplans" && d.link_id === v.id && docVisible(d));
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Business plan reference</button><h1>${esc(v.title)} <span class="muted">v${v.version_no}</span></h1><div class="row">${badge(v.status)}${ref && ref.id === v.id ? '<span class="badge ok">Used for comparison</span>' : ""}${v.hash ? `<span class="mono small" title="SHA-256 fingerprint of the locked figures">Fingerprint ${v.hash.slice(0, 16)}</span>` : ""}</div></div>
   <div class="acts">${w && v.status === "Draft" ? `<button class="btn p" data-act="bp-edit" data-id="${v.id}">Edit</button><button class="btn" data-act="bp-ready" data-id="${v.id}">Ask for a check</button>` : ""}
    ${v.status === "Ready for check" && ap ? `<button class="btn ok" data-act="bp-lock" data-id="${v.id}">Checked against the plan - lock it</button>` : ""}${v.status === "Ready for check" && w ? `<button class="btn" data-act="bp-draft" data-id="${v.id}">Back to draft</button>` : ""}
    ${locked && w && !(ref && ref.id === v.id) ? `<button class="btn" data-act="bp-ref" data-id="${v.id}">Use this version for comparison</button>` : ""}
    ${locked && w ? `<button class="btn" data-act="bp-revise" data-id="${v.id}">Record a revised plan</button>` : ""}${v.hash ? `<button class="btn" data-act="bp-verify" data-id="${v.id}">Check fingerprint</button>` : ""}
    ${Store.can("documents", "write") ? `<button class="btn" data-act="doc-new" data-link-type="bplans" data-link-id="${v.id}">Attach the plan document</button>` : ""}
    <button class="btn" data-act="bp-word" data-id="${v.id}">Download</button></div></div>
   <div class="card"><dl class="kv"><dt>What this version is</dt><dd>${esc(v.commission_status || "—")}</dd><dt>Date given to the Commission</dt><dd>${fmtDate(v.commission_date) || "—"}</dd><dt>Reference (letter, email or application number)</dt><dd>${esc(v.commission_ref || "—")}</dd>
    <dt>Year 1 starts</dt><dd>${fmtDate(v.year1_start) || "—"}</dd><dt>Plan document</dt><dd>${docs.map(d => `<a href="#" data-act="doc-open" data-id="${d.id}">${esc(d.title)}</a>`).join(", ") || "Not attached"}</dd>${v.change_summary ? `<dt>What changed from the previous version</dt><dd>${esc(v.change_summary)}</dd>` : ""}</dl></div>
   ${locked ? `<p class="note">Checked against the submitted plan and locked by ${esc(Store.name(v.locked_by))} on ${esc(v.locked_at || "")}. The figures cannot be changed; if the Commission accepts a revised plan, record it as a new version.</p>` : '<p class="note">Enter the figures exactly as they appear in the plan you submitted. A second person then checks them against the plan and locks this version.</p>'}
   <div class="card"><h3>Year-by-year projections (as submitted)</h3>
    <div class="tw"><table class="t"><thead><tr><th>Item</th>${(v.years || []).map((_, i) => `<th class="num">Year ${i + 1}</th>`).join("")}</tr></thead><tbody>
    ${BP_YEAR_FIELDS.map(([k, l, t]) => `<tr><td>${esc(l)}</td>${(v.years || []).map(y => `<td class="${t === "num" || t === "int" ? "num" : "small"}">${t === "num" ? fmtMoney(y[k]) : esc(y[k] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>
   <div class="card"><h3>Milestones</h3><div class="tw"><table class="t"><thead><tr><th>Milestone</th><th>Target date (plan)</th><th>Actual status</th><th>Actual date</th><th>Note</th></tr></thead><tbody>
   ${(v.milestones || []).map((m, i) => `<tr><td>${esc(m.milestone)}</td><td>${fmtDate(m.target_date)}</td>
    <td>${w ? `<select data-change="ms" data-id="${v.id}" data-i="${i}" data-k="actual_status" aria-label="Actual status">${["", "Not started", "In progress", "Achieved", "Delayed", "Dropped"].map(s => `<option${s === (m.actual_status || "") ? " selected" : ""}>${s}</option>`).join("")}</select>` : esc(m.actual_status || "")}</td>
    <td>${w ? `<input type="date" value="${esc(m.actual_date || "")}" data-change="ms" data-id="${v.id}" data-i="${i}" data-k="actual_date" aria-label="Actual date">` : fmtDate(m.actual_date)}</td>
    <td>${w ? `<input value="${esc(m.actual_note || "")}" data-change="ms" data-id="${v.id}" data-i="${i}" data-k="actual_note" aria-label="Note">` : esc(m.actual_note || "")}</td></tr>`).join("") || '<tr><td colspan="5" class="empty">No milestones.</td></tr>'}</tbody></table></div><p class="small muted">Actual progress can be updated at any time. It is not part of the locked plan figures.</p></div>
   ${BP_SECTIONS.some(([k]) => (v.sections || {})[k]) ? `<div class="card"><h3>Key points from the plan</h3>${BP_SECTIONS.filter(([k]) => (v.sections || {})[k]).map(([k, l]) => `<h4>${esc(l)}</h4><div class="pre">${esc(v.sections[k])}</div>`).join("")}</div>` : ""}
   ${locked ? `<h2>Plan vs actual for this version</h2>${pvaHTML(v)}` : ""}
   <div class="card"><h3>History</h3>${historyHTML(Store.history("bplans", v.id))}</div>`;
};
CHANGES.ms = async el => { const v = Store.get("bplans", el.dataset.id); const ms = clone(v.milestones || []); ms[+el.dataset.i][el.dataset.k] = el.value || null; await Store.save("bplans", { milestones: ms }, v.id); await Store.audit("bplans", v.id, "Milestone progress", `${ms[+el.dataset.i].milestone}: ${el.dataset.k.replace("_", " ")} = ${el.value || "blank"}`); };

VIEWS.bpedit = ({ id }) => {
  const v = Store.get("bplans", id); if (!v) return '<p class="empty">Not found.</p>';
  if (v.status !== "Draft") return `<p class="note">Only a draft can be edited. <button class="link" data-act="back">Back</button></p>`;
  const years = v.years && v.years.length ? v.years : Array.from({ length: BP_YEARS }, () => ({}));
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Back</button><h1>Record business plan v${v.version_no}</h1><p class="muted">Copy the figures from the plan as submitted. Leave a box blank if the plan does not give that figure.</p></div></div>
  <form class="f" data-form="bpedit" data-id="${v.id}" novalidate>
   <fieldset><legend>About this version</legend><div class="grid2">${fieldRow("Title", `<input name="title" value="${esc(v.title)}" required>`)}
    ${fieldRow("What this version is", `<select name="commission_status">${BP_COMMISSION.map(o => `<option${o === v.commission_status ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`)}
    ${fieldRow("Date given to the Commission", `<input type="date" name="commission_date" value="${esc(v.commission_date || "")}">`)}${fieldRow("Reference (letter, email or application number)", `<input name="commission_ref" value="${esc(v.commission_ref || "")}">`)}
    ${fieldRow("Year 1 starts on", `<input type="date" name="year1_start" value="${esc(v.year1_start || "")}">`, "Used to line up plan years with actual records. Usually the start of operations or the licence date.")}
    <div class="fld wide"><label>What changed from the previous version (for revised plans)</label><textarea name="change_summary" rows="2">${esc(v.change_summary || "")}</textarea></div></div></fieldset>
   <fieldset><legend>Year-by-year projections</legend><div class="tw"><table class="t"><thead><tr><th>Item</th>${years.map((_, i) => `<th>Year ${i + 1}</th>`).join("")}</tr></thead><tbody>
    ${BP_YEAR_FIELDS.map(([k, l, t]) => `<tr><td>${esc(l)}</td>${years.map((y, i) => `<td>${t === "choice" ? `<select name="y${i}_${k}" aria-label="${esc(l)} year ${i + 1}"><option value="">—</option>${FUNDING_SOURCES.map(o => `<option${o === y[k] ? " selected" : ""}>${o}</option>`).join("")}</select>`
      : t === "yn" ? `<select name="y${i}_${k}" aria-label="${esc(l)} year ${i + 1}"><option value="">—</option>${YES_NO.map(o => `<option${o === y[k] ? " selected" : ""}>${o}</option>`).join("")}</select>`
      : t === "text" ? `<textarea name="y${i}_${k}" rows="2" aria-label="${esc(l)} year ${i + 1}">${esc(y[k] || "")}</textarea>` : `<input name="y${i}_${k}" inputmode="decimal" value="${esc(y[k] ?? "")}" aria-label="${esc(l)} year ${i + 1}">`}</td>`).join("")}</tr>`).join("")}</tbody></table></div></fieldset>
   <fieldset><legend>Milestones</legend><div class="fld wide"><label for="ms">One per line: milestone ; target date (YYYY-MM-DD)</label><textarea id="ms" name="milestones" rows="5">${esc((v.milestones || []).map(m => `${m.milestone} ; ${m.target_date || ""}`).join("\n"))}</textarea></div></fieldset>
   <fieldset><legend>Key points from the plan (optional)</legend><p class="help">Short notes that help explain the figures later. Attach the full plan document from the plan page.</p>${BP_SECTIONS.map(([k, l, h]) => `<div class="fld wide"><label for="s_${k}">${esc(l)}</label><textarea id="s_${k}" name="s_${k}" rows="2">${esc((v.sections || {})[k] || "")}</textarea></div>`).join("")}</fieldset>
   <div class="row"><button class="btn p">Save draft</button><button type="button" class="btn" data-act="back">Cancel</button></div></form>`;
};
FORMS.bpedit = async form => {
  const o = readForm(form), v = Store.get("bplans", form.dataset.id), errs = [];
  const years = (v.years && v.years.length ? v.years : Array.from({ length: BP_YEARS }, () => ({}))).map((_, i) => {
    const y = {}; for (const [k, l, t] of BP_YEAR_FIELDS) { let x = (o[`y${i}_${k}`] ?? "").trim(); if (x === "") { y[k] = null; continue; }
      if (t === "num" || t === "int") { const n = Number(x.replace(/,/g, "")); if (!Number.isFinite(n)) { errs.push(`${l}, year ${i + 1}: please enter a number.`); continue; } y[k] = t === "int" ? Math.round(n) : n; }
      else y[k] = x; } return y; });
  const sections = {}; BP_SECTIONS.forEach(([k]) => sections[k] = (o["s_" + k] || "").trim());
  const milestones = (o.milestones || "").split("\n").map(s => s.trim()).filter(Boolean).map((s, i) => { const [m, d] = s.split(";").map(x => x.trim());
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) errs.push(`Milestone line ${i + 1}: use the date format YYYY-MM-DD.`);
    const old = (v.milestones || []).find(x => x.milestone === m) || {}; return Object.assign({}, old, { milestone: m, target_date: d || null }); });
  if (!o.title.trim()) errs.push("Title is required.");
  if (errs.length) throw errs;
  await Store.save("bplans", { title: o.title.trim(), commission_status: o.commission_status, commission_date: o.commission_date || null, commission_ref: o.commission_ref.trim() || null, year1_start: o.year1_start || null, change_summary: o.change_summary.trim() || null, years, sections, milestones, prepared_by: Store.uid }, v.id);
  await Store.audit("bplans", v.id, "Updated", `Business plan v${v.version_no} draft saved`);
  toast("Draft saved."); UI.view = { kind: "bpview", id: v.id }; UI.stack.pop(); render();
};
ACTIONS["bp-ready"] = async el => { const v = Store.get("bplans", el.dataset.id); if (!v.year1_start) throw ["Set the Year 1 start date first, so plan years can be lined up with actual records."];
  await Store.save("bplans", { status: "Ready for check", ready_by: Store.uid }, v.id); await Store.audit("bplans", v.id, "Ready for check", `v${v.version_no}`); toast("Sent for checking."); };
ACTIONS["bp-draft"] = async el => { const v = Store.get("bplans", el.dataset.id); await Store.save("bplans", { status: "Draft" }, v.id); await Store.audit("bplans", v.id, "Returned to draft", `v${v.version_no}`); };
ACTIONS["bp-lock"] = async el => {
  const v = Store.get("bplans", el.dataset.id); needDifferentPerson(v.ready_by || v.prepared_by, "check and lock this business plan");
  const hash = await sha256(bpHashBody(v));
  await Store.save("bplans", { status: "Locked", locked_by: Store.uid, locked_at: nowIso(), hash }, v.id);
  await Store.audit("bplans", v.id, "Checked and locked", `v${v.version_no} fingerprint ${hash.slice(0, 16)}`); toast("Checked and locked. It can now be used for comparison.");
};
ACTIONS["bp-ref"] = async el => {
  const v = Store.get("bplans", el.dataset.id);
  for (const x of Store.list("bplans").filter(x => x.is_reference && x.id !== v.id)) await Store.save("bplans", { is_reference: false }, x.id);
  await Store.save("bplans", { is_reference: true }, v.id); await Store.audit("bplans", v.id, "Set as comparison reference", `v${v.version_no}`); toast("This version is now used for comparison.");
};
ACTIONS["bp-verify"] = async el => { const v = Store.get("bplans", el.dataset.id); const h = await sha256(bpHashBody(v)); h === v.hash ? toast("Fingerprint matches: the locked figures have not changed.") : toast("Fingerprint does not match the locked figures. Check the history.", "bad"); };
ACTIONS["bp-revise"] = async el => {
  const v = Store.get("bplans", el.dataset.id), n = Math.max(...Store.list("bplans").map(x => x.version_no || 0)) + 1;
  const id = await Store.save("bplans", { title: v.title, version_no: n, status: "Draft", commission_status: BP_COMMISSION[1], year1_start: v.year1_start, sections: clone(v.sections || {}), years: clone(v.years || []), milestones: clone(v.milestones || []), notes: {}, parent_id: v.id, prepared_by: Store.uid, change_summary: "" });
  await Store.audit("bplans", id, "Created", `v${n} started as a revision of v${v.version_no}`); UI.view = { kind: "bpedit", id }; render();
};
ACTIONS["bp-word"] = el => {
  const v = Store.get("bplans", el.dataset.id), c = Store.company();
  const rep = { title: `${v.title} (version ${v.version_no})`, subtitle: `${c.name} · ${v.commission_status || ""}${v.commission_date ? " on " + fmtDate(v.commission_date) : ""} · ${v.status}${v.hash ? " · fingerprint " + v.hash.slice(0, 16) : ""}`, demo: !!c.is_demo,
    notes: ["Figures recorded from the business plan given to the Commission. They are projections, not commitments, unless a licence, approval or agreement says otherwise."],
    sections: [{ heading: "Year-by-year projections", columns: ["Item", ...(v.years || []).map((_, i) => "Year " + (i + 1))], rows: BP_YEAR_FIELDS.map(([k, l]) => [l, ...(v.years || []).map(y => y[k] ?? "")]) },
      { heading: "Milestones", columns: ["Milestone", "Target date", "Actual status", "Actual date"], rows: (v.milestones || []).map(m => [m.milestone, m.target_date, m.actual_status, m.actual_date]) },
      ...BP_SECTIONS.filter(([k]) => (v.sections || {})[k]).map(([k, l]) => ({ heading: l, text: v.sections[k] }))] };
  chooseFormat(rep, (c.is_demo ? "DEMO_" : "") + `Business_plan_reference_v${v.version_no}`);
};
VIEWS.bpcompare = () => {
  const vs = Store.list("bplans").sort((a, b) => a.version_no - b.version_no);
  const a = Store.get("bplans", UI.params.cmpA) || vs[vs.length - 2], b = Store.get("bplans", UI.params.cmpB) || vs[vs.length - 1];
  const sel = (k, cur) => `<select data-change="cmp" data-k="${k}">${vs.map(v => `<option value="${v.id}"${cur && v.id === cur.id ? " selected" : ""}>v${v.version_no} ${esc(v.status)}</option>`).join("")}</select>`;
  if (!a || !b) return '<p class="muted">Need two versions.</p>';
  const rows = [];
  BP_YEAR_FIELDS.forEach(([k, l]) => { for (let i = 0; i < BP_YEARS; i++) { const x = ((a.years || [])[i] || {})[k], y = ((b.years || [])[i] || {})[k]; if (String(x ?? "") !== String(y ?? "")) rows.push([`${l} - year ${i + 1}`, x, y]); } });
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Business plan reference</button><h1>Compare plan versions</h1></div></div>
   <div class="row">Compare ${sel("cmpA", a)} with ${sel("cmpB", b)}</div>
   <div class="card"><h3>Changed figures</h3><div class="tw"><table class="t"><thead><tr><th>Item</th><th>v${a.version_no}</th><th>v${b.version_no}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="num">${esc(cellText(r[1]))}</td><td class="num">${esc(cellText(r[2]))}</td></tr>`).join("") || '<tr><td colspan="3" class="empty">No figures changed.</td></tr>'}</tbody></table></div></div>`;
};
CHANGES.cmp = el => { UI.params[el.dataset.k] = el.value; render(); };

/* ======================= COMMISSION REQUESTS ======================= */
const REQ_FLOW = { "New": ["In Progress"], "In Progress": ["Under Review"], "Under Review": ["Approved", "In Progress"], "Approved": ["Submitted", "In Progress"], "Submitted": ["Closed"], "Closed": [] };
PAGES.requests = () => {
  const t = curTab("requests", "overview");
  const tabs = tabsHTML("requests", [["overview", "Overview"], ["list", "All requests"], ["templates", "Response templates"]]);
  if (t === "overview") return tabs + requestsOverview();
  if (t === "templates") return tabs + listHTML("templates");
  return tabs + listHTML("requests", { above: '<p class="note">Log each request from the Commission, prepare the response, have it approved, then record when you sent it. The system never sends anything itself.</p>' });
};
function fillTemplate(body, r) {
  const c = Store.company(), lic = c.main_licence_id ? Store.get("licences", c.main_licence_id) : null;
  const map = { company_name: c.name, licence_number: lic ? lic.number : "[licence number]", as_at: r.period_or_date || fmtDate(today()), today: fmtDate(today()), signatory: c.signatory_name || "[signatory]", contact_name: r.contact_name || "Sir / Madam" };
  return body.replace(/\{(\w+)\}/g, (m, k) => map[k] ?? m);
}
EXTRAS.requests = r => {
  const w = Store.can("requests", "write"), ap = Store.can("requests", "approve"), locked = ["Approved", "Submitted", "Closed"].includes(r.status);
  const nexts = (REQ_FLOW[r.status] || []).filter(s => s !== "Approved" || ap);
  const tpls = Store.list("templates");
  return `<div class="card hl"><h3>Status: ${badge(r.status)} ${r.deadline ? `<span class="badge ${daysUntil(r.deadline) < 0 && !["Submitted", "Closed"].includes(r.status) ? "bad" : "info"}">deadline ${fmtDate(r.deadline)}</span>` : ""}</h3>
   <p class="small muted">${r.ready_by ? `Sent for review by ${esc(Store.name(r.ready_by))}. ` : ""}${r.approved_by ? `Approved by ${esc(Store.name(r.approved_by))} on ${esc(r.approved_at)}. ` : ""}${r.submitted_at ? `Sent on ${fmtDate(r.submitted_at)} by ${esc(r.submission_method || "")}${r.submission_ref ? " (" + esc(r.submission_ref) + ")" : ""}.` : ""}</p>
   ${w ? `<div class="row">${nexts.map(s => `<button class="btn${s === "Approved" ? " ok" : ""}" data-act="req-status" data-id="${r.id}" data-to="${s}">${s === "Submitted" ? "Record that we sent the response" : s === "Approved" ? "Approve response" : "Move to: " + s}</button>`).join("")}</div>` : ""}</div>
  <div class="card"><h3>Response draft</h3>
   ${w && !locked && tpls.length ? `<div class="row"><select id="tplpick" aria-label="Template">${tpls.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join("")}</select><button class="btn sm" data-act="req-tpl" data-id="${r.id}">Insert template</button></div>` : ""}
   ${w && !locked ? `<form data-form="req-draft" data-id="${r.id}"><textarea name="response_draft" rows="12" aria-label="Response draft">${esc(r.response_draft || "")}</textarea><div class="row"><button class="btn sm p">Save draft</button></div></form>`
    : `<div class="pre">${esc(r.response_draft || "No draft.")}</div>${locked ? '<p class="small muted">Locked after approval. Move back to In Progress to change it.</p>' : ""}`}
   <div class="row"><button class="btn sm" data-act="req-word" data-id="${r.id}">Download draft</button></div></div>`;
};
ACTIONS["req-tpl"] = async el => { const r = Store.get("requests", el.dataset.id), t = Store.get("templates", document.getElementById("tplpick").value); if (!t) return;
  const ta = document.querySelector('[name="response_draft"]'); ta.value = fillTemplate(t.body, r) + (ta.value ? "\n\n" + ta.value : ""); toast("Template inserted. Check the [bracketed] parts, then save."); };
FORMS["req-draft"] = async form => { const r = Store.get("requests", form.dataset.id); const v = readForm(form).response_draft; await Store.save("requests", { response_draft: v }, r.id); await Store.audit("requests", r.id, "Response draft saved", r.title); toast("Draft saved."); };
ACTIONS["req-status"] = async el => {
  const r = Store.get("requests", el.dataset.id), to = el.dataset.to;
  if (to === "Submitted") return openModal(submissionModal("req-sub", r.id, "Record that the response was sent", "The system does not send messages. Record what you sent and when."));
  const patch = { status: to };
  if (to === "Under Review") patch.ready_by = Store.uid;
  if (to === "Approved") { needDifferentPerson(r.ready_by || r.updated_by, "approve this response"); patch.approved_by = Store.uid; patch.approved_at = nowIso(); }
  if (to === "In Progress") { patch.approved_by = null; patch.approved_at = null; }
  await Store.save("requests", patch, r.id); await Store.audit("requests", r.id, "Status changed", `${r.title}: ${r.status} → ${to}`); toast("Status updated.");
};
FORMS["req-sub"] = async form => { const o = readForm(form), r = Store.get("requests", form.dataset.id); await Store.save("requests", { status: "Submitted", submitted_at: o.submitted_at, submission_method: o.submission_method, submission_ref: o.submission_ref || null, submitted_by_name: o.submitted_by_name }, r.id); await Store.audit("requests", r.id, "Submission recorded", `${r.title}: sent ${o.submitted_at} by ${o.submission_method}`); closeModal(); toast("Recorded."); };
ACTIONS["req-word"] = el => { const r = Store.get("requests", el.dataset.id), c = Store.company();
  chooseFormat({ title: r.title, subtitle: `${c.name} · draft response · status ${r.status}`, demo: !!c.is_demo, notes: [], sections: [{ text: r.response_draft || "No draft yet." }] }, (c.is_demo ? "DEMO_" : "") + "Response_" + r.title.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40)); };

/* ======================= WORKFORCE ======================= */
PAGES.workforce = () => {
  const t = curTab("workforce", "overview");
  if (t === "overview") return tabsHTML("workforce", [["overview", "Overview"], ["employees", "Workforce register"], ["positions", "Positions"], ["policies", "Policies and benefits"], ["report", "Employee information report"]]) + `<div class="head"><div class="t"><h1>Workforce</h1><p class="muted">Who works for the company, in which groups the Commission asks about. Individual pay is never shown here.</p></div></div>` + workforceOverview();
  const tabs = tabsHTML("workforce", [["overview", "Overview"], ["employees", "Workforce register"], ["positions", "Positions"], ["policies", "Policies and benefits"], ["report", "Employee information report"]]);
  if (t === "positions") return tabs + listHTML("positions", { above: '<p class="note">Positions hold the minimum qualifications, experience and languages the Commission asks about. These are job requirements, not the qualifications of the person in the job.</p>' });
  if (t === "policies") return tabs + listHTML("policies");
  if (t === "report") {
    const p = UI.params, a = { as_at: p.emp_as_at || today(), names: !!p.emp_names, pay: !!p.emp_pay };
    return tabs + `<div class="card"><h3>Employee information requested by the Commission</h3><p class="small muted">Covers the seven areas in the Commission's example request: job titles and nationalities, minimum qualifications and experience, languages, accommodation, health insurance, travel and relocation, and other benefits.</p>
     <div class="row"><label>As at <input type="date" value="${a.as_at}" data-change="param" data-k="emp_as_at"></label>
     ${Store.canSee("personal") ? `<label><input type="checkbox" data-change="param" data-k="emp_names"${a.names ? " checked" : ""}> include names</label>` : ""}
     ${Store.canSee("pay") ? `<label><input type="checkbox" data-change="param" data-k="emp_pay"${a.pay ? " checked" : ""}> include pay</label>` : ""}</div></div>` + reportPanel("employees", a);
  }
  return tabs + listHTML("employees");
};
CHANGES.param = el => { UI.params[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; render(); };

/* ======================= INVESTMENT ======================= */
PAGES.investment = () => {
  const t = curTab("investment", "overview");
  const tabs = tabsHTML("investment", [["overview", "Overview"], ["register", "Investment and funding register"]]);
  if (t === "overview") return tabs + `<div class="head"><div class="t"><h1>Investment and funding</h1><p class="muted">Every receipt keeps its original amount, currency, exchange rate, rate date and source. A receipt counts as FDI only after a reviewer confirms its classification.</p></div><div class="acts"><button class="btn" data-act="nav" data-section="reports" data-report="investment">Full report</button></div></div>` + investmentOverview();
  return tabs + listHTML("investments", { below: `<p><button class="btn" data-act="nav" data-section="reports" data-report="investment">Open the investment and funding report</button></p>` });
};

/* ======================= OFFICES ======================= */
PAGES.offices = () => {
  const t = curTab("offices", "overview");
  const tabs = tabsHTML("offices", [["overview", "Overview"], ["forecast", "Space forecast"], ["rent", "Rent comparison"], ["offices", "Office register"], ["plans", "Planned requirements"], ["report", "Space and headcount report"]]);
  if (t === "forecast") return tabs + forecastHTML();
  if (t === "rent") return tabs + rentHTML();
  if (t === "overview") return tabs + `<div class="head"><div class="t"><h1>Office space</h1><p class="muted">Space in use inside and outside Colombo Port City, seats, and how many employees are assigned to each office.</p></div></div>` + officeOverview();
  if (t === "plans") return tabs + listHTML("office_plans", { above: '<p class="note">Planned requirements are projections. The 2026 annual return asks for projected space within Port City from 2028.</p>' });
  if (t === "report") return tabs + `<div class="row"><label>As at <input type="date" value="${UI.params.off_as_at || today()}" data-change="param" data-k="off_as_at"></label></div>` + reportPanel("office_headcount", { as_at: UI.params.off_as_at || today() });
  return tabs + listHTML("offices", { above: '<p class="note">Enter the floor area in the unit you measured it in; the other unit is worked out. Employees assigned, total employees and people physically present are shown separately because they are not the same thing.</p>' });
};

