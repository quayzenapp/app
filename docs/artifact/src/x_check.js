/* ===== x_check.js ===== */
/* Checklists: one place for every process checklist, grouped by package.
   Some come from other screens (licence application, development projects) and open there. The rest are kept here,
   one-off or by period (month, quarter, year), each item with a status, date, note and stored document. */

const CHK_TEMPLATES = [
  { k: "die_reg", pkg: "operate", t: "Register the AP with the Department of Immigration and Emigration", src: "Visa SOP, section A, Step 1", period: "once", items: ["Articles of Association", "Certificate of Incorporation", "Authorised Person licence", "Offshore registration certificate", "Director information (Form 20 / Form 1) showing current directors", "Letter of recommendation from the Commission for registration of the AP with DIE"] },
  { k: "le_request", pkg: "operate", t: "Landing endorsement request (for each group of applicants)", src: "Visa SOP, section A, Step 2", period: "once", items: ["Company request letter signed by the authorised signatory, listing names, passport numbers, designations and requested durations", "Copies of applicants' passport bio-data pages", "Copies of applicants' employment contracts", "Completed request form for landing endorsement (one per applicant)", "Police clearance certificate from the country of domicile, issued within the past three months, for each applicant", "Police clearance authenticated by the relevant embassy, high commission or consulate (not Chinese nationals)", "Supporting documents for dependents, if any"] },
  { k: "rv_apply", pkg: "operate", t: "Resident visa application after arrival (within 30 days)", src: "Visa SOP, section A, Step 5", period: "once", items: ["Completed resident visa application form", "Copy of passport bio-data page", "Company request letter with approved stay period (or individual request letter)", "Commission recommendation letter issued with the landing endorsement", "Medical certificate from IOM Migration Health Assessment Centre", "Medical insurance for the visa period", "Police clearance certificate issued within the past three months", "Separate applications and documents for dependents"] },
  { k: "visa_month", pkg: "operate", t: "Monthly reporting to the Commission", src: "Visa SOP, section C1-C2", period: "month", items: ["Monthly visa report in the Commission's Excel template, by the end of the month", "EPF and ETF payment receipts for the month", "Resignations notified, with visa cancellation requested and departures within two weeks"] },
  { k: "tax_q", pkg: "comply", t: "Quarterly income tax receipts", src: "Visa SOP, section C3", period: "quarter", items: ["Receipts for the quarter's income tax payments to the Inland Revenue Department, sent to the Commission"] },
  { k: "police", pkg: "operate", t: "Police notification of the designated location", src: "Visa SOP, section C4", period: "once", items: ["Details of the designated location notified to the police station with jurisdiction", "Details of all employees working there, with current residential addresses, given to that police station", "Notification updated when the location or staff change"] },
  { k: "general", pkg: "operate", t: "General conditions at the designated location", src: "Visa SOP, sections D and E", period: "once", items: ["A competent interpreter available to assist authorised officers, who understands the business (throughout operating hours if 24-hour)", "Foreign employees keep their passports with valid visas", "Occupants briefed on conduct rules: no disturbance or nuisance, respect for others' safety, compliance with laws and by-laws"] },
  { k: "cyber", pkg: "comply", t: "Cyber abuse and cybercrime audit", src: "Visa SOP, Annexure 2", period: "year", items: ["Independent auditor holds CHFI, GCFA or GCFE certification", "Evidence given to the auditor: outbound firewall logs, domains and IP addresses, IT infrastructure, DNS logs, EDR/XDR logs", "Audit report with entity, period, scope, auditor details and one of the two set conclusions", "First audit: report within 60 days of the Commission's direction, covering the previous 90 days", "Later audits: yearly, same period as the annual return, submitted with it"] },
  { k: "renewal", pkg: "change", t: "Licence renewal", src: "Schedule V; Fees Regulations No. 2 of 2024", period: "year", items: ["Renewal fee paid two months before the licence expires", "Schedule V application prepared and signed", "Latest annual return and any notice of change confirmed as still accurate", "Any material change before the renewed licence is issued notified to the Commission"] },
  { k: "annual", pkg: "comply", t: "Annual return", src: "Annual Return Submission Form 2026; Schedule IV", period: "year", items: ["Annual return prepared, checked and approved", "Supporting documents listed in the form attached", "Cyber abuse audit report attached (if the Commission has directed an audit)", "Return submitted and the submission recorded"] },
];
const LINKED_CHECKLISTS = () => [
  ...Store.list("apps").map(a => ({ pkg: "apply", t: `Licence application documents - ${a.title}`, src: "Required documents list; Schedule I Part VII", rows: checklistRows(a), go: () => { UI.appId = a.id; UI.tab.apply = "checklist"; navTo("apply"); } })),
  ...Store.list("dev_projects").map(p => ({ pkg: "develop", t: `Development approvals - ${p.name || "project"}`, src: "DCR Schedule I; Supplementary Forms 01-06; CAA", rows: devCheckRows(p), go: () => { UI.tab.devproj = "check"; navTo("develop", { kind: "devproj", id: p.id }); }, id: p.id }))];
const periodKey = (per, d = today()) => per === "month" ? d.slice(0, 7) : per === "quarter" ? `${d.slice(0, 4)}-Q${Math.floor((+d.slice(5, 7) - 1) / 3) + 1}` : per === "year" ? d.slice(0, 4) : "once";
const chkInst = (k, per) => Store.get("checklists", `${k}__${per}`);
const chkRows = (tpl, inst) => tpl.items.map((t, i) => { const e = ((inst || {}).items || {})[i] || {}, status = e.status || "Not started"; return { i, t, e, status, done: status === "Ready" || (status === "Not applicable" && !!e.note) }; });

PAGES.checklists = () => {
  const cur = UI.params.chkPkg || "all", linked = LINKED_CHECKLISTS().filter(x => canSection(x.pkg === "apply" ? "apply" : "develop"));
  const own = CHK_TEMPLATES.filter(t => pkgOn(t.pkg)).map(t => { const per = periodKey(t.period), rows = chkRows(t, chkInst(t.k, per)); return { tpl: t, per, rows }; });
  const all = [...linked.map(x => ({ pkg: x.pkg, t: x.t, src: x.src, done: x.rows.filter(r => r.done).length, n: x.rows.length, linked: x })), ...own.map(x => ({ pkg: x.tpl.pkg, t: x.tpl.t, src: x.tpl.src, done: x.rows.filter(r => r.done).length, n: x.rows.length, own: x }))];
  const shown = all.filter(x => cur === "all" || x.pkg === cur), pk = PACKAGES.filter(p => all.some(x => x.pkg === p.k));
  return ovHead("Checklists", "Every process checklist in one place: the licence application, development approvals, the visa procedure and recurring duties. Recurring checklists start fresh each month, quarter or year.")
  + hlCards([{ value: all.length, label: "Checklists" }, { value: all.filter(x => x.done === x.n).length, label: "Complete" }, { value: all.reduce((t, x) => t + x.n - x.done, 0), label: "Items still open", kind: "warn" }])
  + `<div class="row ctl"><span class="seg">${[["all", "All"], ...pk.map(p => [p.k, p.n])].map(([k, l]) => `<button class="${k === cur ? "on" : ""}" data-act="chk-pkg" data-k="${k}">${esc(l)}</button>`).join("")}</span></div>
  <div class="ogrid">${shown.map((x, i) => `<div class="card tile chk"><b>${esc(x.t)}</b><span class="small muted">${esc(x.src)}${x.own ? ` · ${x.own.tpl.period === "once" ? "one-off" : esc(x.own.per)}` : ""}</span><div class="bar"><i style="width:${pct(x.done, x.n)}%"></i></div><span class="small">${x.done} of ${x.n} done</span>
    <div class="row">${x.linked ? `<button class="btn sm" data-act="chk-linked" data-i="${all.indexOf(x)}">Open</button>` : `<button class="btn sm" data-act="chk-open" data-k="${x.own.tpl.k}" data-per="${x.own.per}">Open</button>`}</div></div>`).join("") || '<p class="muted">No checklists in this package.</p>'}</div>`;
};
ACTIONS["chk-pkg"] = el => { UI.params.chkPkg = el.dataset.k; render(); };
ACTIONS["chk-linked"] = el => { const all = LINKED_CHECKLISTS().filter(x => canSection(x.pkg === "apply" ? "apply" : "develop")); const x = all[+el.dataset.i]; if (x) x.go(); };
ACTIONS["chk-open"] = el => go({ kind: "chk", k: el.dataset.k, per: el.dataset.per });
VIEWS.chk = ({ k, per }) => {
  const tpl = CHK_TEMPLATES.find(t => t.k === k), inst = chkInst(k, per), rows = chkRows(tpl, inst), w = Store.can("checklists", "write"), docs = Store.list("docs").filter(docVisible), dis = w ? "" : " disabled";
  const prev = Store.list("checklists").filter(x => x.tpl === k && x.per !== per).sort((a, b) => b.per.localeCompare(a.per));
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Checklists</button><h1>${esc(tpl.t)}</h1><p class="muted">${esc(tpl.src)}${tpl.period !== "once" ? ` · period ${esc(per)}` : ""}</p></div>
   <div class="acts">${fmtButtons("chk-dl", `data-k="${k}" data-per="${per}"`, ["xlsx", "pdf", "docx"], null)}</div></div>
  ${tpl.period !== "once" ? `<div class="row ctl"><span class="small muted">Period:</span><input type="${tpl.period === "month" ? "month" : "text"}" value="${esc(per)}" data-change="chk-per" data-k="${k}" aria-label="Period" style="max-width:160px">${prev.length ? `<span class="small muted">Earlier: ${prev.slice(0, 6).map(x => `<a href="#" data-act="chk-open" data-k="${k}" data-per="${x.per}">${esc(x.per)}</a>`).join(" · ")}</span>` : ""}</div>` : ""}
  <div class="card"><div class="tw"><table class="t cl"><thead><tr><th>Item</th><th>Status</th><th>Date</th><th>Stored document</th><th>Note</th></tr></thead><tbody>
  ${rows.map(r => `<tr class="${r.done ? "ok" : ""}"><td>${esc(r.t)}</td><td><select data-change="chk-set" data-k="${k}" data-per="${per}" data-i="${r.i}" data-f="status"${dis} aria-label="Status">${CL_STATUS.map(s => `<option${s === r.status ? " selected" : ""}>${s}</option>`).join("")}</select></td>
   <td><input type="date" value="${esc(r.e.date || "")}" data-change="chk-set" data-k="${k}" data-per="${per}" data-i="${r.i}" data-f="date"${dis} aria-label="Date"></td>
   <td><select data-change="chk-set" data-k="${k}" data-per="${per}" data-i="${r.i}" data-f="doc_id"${dis} aria-label="Stored document"><option value="">—</option>${docs.map(d => `<option value="${d.id}"${d.id === r.e.doc_id ? " selected" : ""}>${esc(d.title.slice(0, 40))}</option>`).join("")}</select></td>
   <td><input value="${esc(r.e.note || "")}" data-change="chk-set" data-k="${k}" data-per="${per}" data-i="${r.i}" data-f="note"${dis} aria-label="Note"></td></tr>`).join("")}</tbody></table></div>
  <p class="small muted">${rows.filter(r => r.done).length} of ${rows.length} done. A checklist records what you have done; it does not decide whether a requirement is met.</p></div>`;
};
CHANGES["chk-per"] = el => { const v = el.value.trim(); if (v) { UI.view = { kind: "chk", k: el.dataset.k, per: v }; render(); } };
CHANGES["chk-set"] = async el => {
  const { k, per, i, f } = el.dataset, id = `${k}__${per}`, inst = Store.get("checklists", id) || { tpl: k, per, items: {} }, items = clone(inst.items || {}), e = items[i] = items[i] || {}, old = e[f] ?? null;
  e[f] = el.value || null; await Store.save("checklists", { tpl: k, per, items }, id);
  await Store.audit("checklists", id, "Updated", `${CHK_TEMPLATES.find(t => t.k === k).t} (${per}): item ${+i + 1} ${f}`, [{ label: f, old, new: e[f] }]);
};
ACTIONS["chk-dl"] = el => { const { k, per } = el.dataset, tpl = CHK_TEMPLATES.find(t => t.k === k), rows = chkRows(tpl, chkInst(k, per));
  return runAndSave("the checklist", () => modelsToFiles([{ name: `Checklist_${fileSafe(tpl.t)}_${per}`, model: { title: tpl.t, subtitle: `${Store.company().name} · ${tpl.src}${tpl.period !== "once" ? " · " + per : ""}`, sheet: "Checklist", blocks: [{ table: { cols: ["Item", "Status", "Date", "Note"], rows: rows.map(r => [r.t, r.status, ddmmyyyy(r.e.date), r.e.note || ""]) } }] } }], el.dataset.f)); };

/* Obligation library: duties from the visa SOP */
OBLIGATION_LIBRARY.push(
  ["Submit the monthly visa report to the Commission by month end", "Reporting deadline", "Visa SOP, section C1", "APs with Colombo Port City visa holders", "Monthly", "Use the Commission's Excel template."],
  ["Send monthly EPF and ETF payment receipts to the Commission", "Reporting deadline", "Visa SOP, section C2", "APs with Colombo Port City visa holders", "Monthly", ""],
  ["Send quarterly income tax payment receipts to the Commission", "Reporting deadline", "Visa SOP, section C3", "APs with Colombo Port City visa holders", "Quarterly", "Confirm with the tax adviser."],
  ["Notify the police of the designated location and the employees working there", "Commission request", "Visa SOP, section C4", "APs operating from a designated location", "One-off", "Update when details change."],
  ["Notify the Commission when a visa-holding employee resigns; employee to leave within two weeks", "Commission request", "Visa SOP, section B", "APs with Colombo Port City visa holders", "One-off", "Record each case on the visa record."],
  ["Keep an interpreter available for authorised officers at the designated location", "Commission request", "Visa SOP, section E", "APs operating from a designated location", "One-off", ""],
  ["Cyber abuse and cybercrime audit (when directed, then yearly with the annual return)", "Commission request", "Visa SOP, Annexure 2", "APs the Commission directs", "Annually", "First report within 60 days of the direction."]);

