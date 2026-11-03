/* ===== reports.js ===== */
/* Reminders, plan vs actual, and the ten reports. Each report states its date or period and where its figures come from. */


const FDI = ["Equity investment", "Reinvested earnings", "Intra-company debt"];

function collectReminders() {
  const out = [], t = today();
  const add = (kind, title, due, nav, detail = "") => { const d = daysUntil(due); out.push({ kind, title, due, days: d, nav, detail, state: d < 0 ? "Overdue" : d === 0 ? "Due today" : "Due soon" }); };
  const S = k => Number(Store.setting(k, 0));
  if (Store.can("requests")) Store.list("requests").forEach(r => {
    if (r.deadline && !["Submitted", "Closed"].includes(r.status) && daysUntil(r.deadline) <= S("rem_requests")) add("Commission request", r.title, r.deadline, { kind: "request", id: r.id }, "Status: " + r.status);
    if (r.follow_up_due && r.status !== "Closed" && daysUntil(r.follow_up_due) <= S("rem_requests")) add("Request follow-up", r.title, r.follow_up_due, { kind: "request", id: r.id });
  });
  if (Store.can("obligations")) {
    Store.list("licences").forEach(l => { if (l.expiry_date && ["Active", "Pending"].includes(l.status) && daysUntil(l.expiry_date) <= (l.renewal_notice_days || 60)) add("Licence expiry / renewal", `${l.title} ${l.number || ""}`, l.expiry_date, { kind: "record", type: "licences", id: l.id }, `Reminder starts ${l.renewal_notice_days || 60} days before expiry`); });
    Store.list("obligations").forEach(o => { if (o.deadline && !["Met", "Not applicable"].includes(o.status) && daysUntil(o.deadline) <= S("rem_obligations")) add("Obligation", o.title, o.deadline, { kind: "record", type: "obligations", id: o.id }, "Status: " + o.status); });
  }
  if (Store.can("visas")) Store.list("visas").forEach(v => {
    const who = Store.canSee("personal") ? v.person_name : "Visa record";
    if (v.expiry_date && !["Cancelled", "Rejected"].includes(v.application_status) && daysUntil(v.expiry_date) <= S("rem_visas")) add("Visa / permit expiry", `${who} - ${v.visa_category}`, v.expiry_date, { kind: "record", type: "visas", id: v.id });
    if (Store.canSee("id") && v.passport_expiry && daysUntil(v.passport_expiry) <= S("rem_passports")) add("Passport expiry", who, v.passport_expiry, { kind: "record", type: "visas", id: v.id });
  });
  if (Store.can("documents")) Store.list("docs").forEach(d => { if (d.expiry_date && daysUntil(d.expiry_date) <= 60 && (d.access === "Normal" || canRestrictedDocs())) add("Document expiry", d.title, d.expiry_date, { kind: "doc", id: d.id }); });
  return out.sort((a, b) => a.days - b.days);
}

/* ---------- plan vs actual ---------- */
function addYears(d, n) { const x = new Date(d + "T00:00:00Z"); x.setUTCFullYear(x.getUTCFullYear() + n); return x.toISOString().slice(0, 10); }
function yearWindow(y1, n) { const s = addYears(y1, n - 1); const e = new Date(addYears(y1, n) + "T00:00:00Z"); e.setUTCDate(e.getUTCDate() - 1); return [s, e.toISOString().slice(0, 10)]; }
function referencePlan(vid) {
  if (vid) return Store.get("bplans", vid);
  const locked = Store.list("bplans").filter(v => v.status === "Locked");
  return locked.find(v => v.is_reference) || locked.sort((a, b) => String(b.commission_date || "").localeCompare(String(a.commission_date || "")) || b.version_no - a.version_no)[0] || null;
}
function actualInvestment(s, e) {
  const rows = Store.list("investments").filter(i => i.entry_date >= s && i.entry_date <= e);
  const conf = rows.filter(i => FDI.includes(i.classification) && i.review_status === "Confirmed" && i.usd_amount != null);
  return { usd: conf.length ? r2(conf.reduce((t, i) => t + toC(i.usd_amount), 0) / 100) : 0, count: conf.length,
    pending: rows.filter(i => i.review_status !== "Confirmed" || i.classification === "Pending review").length };
}
function actualHeadcount(d) {
  const act = Store.list("employees").filter(e => e.start_date && e.start_date <= d && (!e.end_date || e.end_date >= d) && e.status !== "Offer accepted - not started");
  const emp = act.filter(e => e.worker_type === "Employee");
  return { local: emp.filter(e => e.nationality_group === "Sri Lankan").length, foreign: emp.filter(e => e.nationality_group !== "Sri Lankan").length,
    total: emp.length, contractors: act.length - emp.length };
}
function actualOffice(d) {
  const o = activeOffices(Store, d);
  const inside = r2(o.filter(x => x.location === "Inside Colombo Port City").reduce((t, x) => t + (x.area_sqm || 0), 0));
  const outside = r2(o.filter(x => x.location !== "Inside Colombo Port City").reduce((t, x) => t + (x.area_sqm || 0), 0));
  return { inside, outside, total: r2(inside + outside), offices: o.length };
}
function actualRevenue(s, e) {
  const rows = Store.list("fin_entries").filter(f => f.category === "Revenue" && f.entry_date >= s && f.entry_date <= e);
  const w = rows.filter(f => f.usd_amount != null);
  return { usd: w.length ? r2(w.reduce((t, f) => t + toC(f.usd_amount), 0) / 100) : null, records: rows.length, missing: rows.length - w.length };
}
function comparePlan(v) {
  if (!v || !v.year1_start) return [];
  const out = [], t = today(); let cp = 0, ca = 0;
  for (let y = 1; y <= 10; y++) {
    const [s, e] = yearWindow(v.year1_start, y); if (s > t) break;
    const py = (v.years || [])[y - 1] || {}, asAt = e < t ? e : t;
    const inv = actualInvestment(s, e); cp += Number(py.fdi_usd || 0); ca += inv.usd;
    const hc = actualHeadcount(asAt), off = actualOffice(asAt), rev = actualRevenue(s, e);
    const note = k => (v.notes || {})[y + ":" + k] || "";
    const m = (key, label, plan, actual, source) => ({ key, label, plan: plan === "" ? null : plan ?? null, actual, diff: plan != null && plan !== "" && actual != null ? r2(actual - plan) : null, source, note: note(key) });
    const sum = (a, b) => py[a] == null && py[b] == null ? null : Number(py[a] || 0) + Number(py[b] || 0);
    out.push({ year: y, start: s, end: e, asAt, complete: e <= t, metrics: [
      m("investment", "Investment (FDI, USD)", py.fdi_usd, inv.usd, `Confirmed FDI records ${s} to ${e}` + (inv.pending ? `; ${inv.pending} awaiting review` : "")),
      m("investment_cum", "Investment - cumulative (USD)", r2(cp), r2(ca), `Confirmed FDI from ${v.year1_start} to ${e}`),
      m("employees", "Employees (total)", sum("local_employees", "foreign_employees"), hc.total, `Workforce register as at ${asAt} (employees only; ${hc.contractors} contractor(s) excluded)`),
      m("local", "Local employees", py.local_employees, hc.local, `Workforce register as at ${asAt}`),
      m("foreign", "Foreign employees", py.foreign_employees, hc.foreign, `Workforce register as at ${asAt}`),
      m("office", "Office space (sqm)", py.office_sqm, off.total, `Office register as at ${asAt} (inside ${off.inside}, outside ${off.outside})`),
      m("revenue", "Revenue (USD)", py.revenue_usd, rev.usd, rev.records ? `Revenue records ${s} to ${e}` + (rev.missing ? `; ${rev.missing} without a USD figure` : "") : "No revenue records in this period"),
    ] });
  }
  return out;
}

/* ---------- reports ---------- */
const REPORTS = [
  ["plan_vs_actual", "Business plan vs actual progress", "bplan"],
  ["employees", "Employee information requested by the Commission", "workforce"], ["office_headcount", "Office space and headcount", "offices"],
  ["investment", "Investment and funding breakdown", "investment"], ["annual_return", "Annual return working report", "returns"],
  ["requests", "Commission request and submission history", "requests"], ["obligations", "Licence and obligation status", "obligations"],
  ["visas", "Visa and permit expiry", "visas"], ["missing_docs", "Missing documents", "documents"]];

function repBase(code, subtitle, notes = []) {
  const c = Store.company();
  return { code, title: REPORTS.find(r => r[0] === code)[1], subtitle: `${c.name} · ${subtitle}`, demo: !!c.is_demo, notes, sections: [] };
}

function buildReport(code, a = {}) {
  const t = today();
  if (code === "plan_vs_actual") {
    const v = referencePlan(a.vid);
    if (!v) { const rep = repBase(code, "no business plan"); rep.sections.push({ text: "No checked and locked business plan version found. Record the plan under Business Plan first." }); return rep; }
    const rep = repBase(code, `${v.title} version ${v.version_no} (${v.commission_status || v.status}), Year 1 from ${fmtDate(v.year1_start)}`, ["Plan figures are projections, not commitments. Actual figures come from the registers, with their source and date."]);
    comparePlan(v).forEach(r => rep.sections.push({ heading: `Year ${r.year}: ${r.start} to ${r.end}` + (r.complete ? "" : ` (actuals to ${r.asAt})`),
      columns: ["Measure", "Plan (projection)", "Actual", "Difference", "Source of actual", "Explanation"], rows: r.metrics.map(m => [m.label, m.plan, m.actual, m.diff, m.source, m.note]) }));
    rep.sections.push({ heading: "Milestones", columns: ["Milestone", "Target", "Actual status", "Actual date", "Note"], rows: (v.milestones || []).map(m => [m.milestone, m.target_date, m.actual_status, m.actual_date, m.actual_note]) });
    rep.sections.push({ heading: "Conditions recorded in a licence, approval or agreement", columns: ["Condition", "Source", "Target", "Deadline", "Status"],
      rows: Store.list("obligations").filter(o => o.basis === "Stated in our licence, approval or agreement").map(o => [o.title, o.source_document, o.target, o.deadline, o.status]) });
    return rep;
  }
  if (code === "employees") {
    const d = a.as_at || t, names = a.names && Store.canSee("personal"), pay = a.pay && Store.canSee("pay");
    const rep = repBase(code, "as at " + fmtDate(d), ["Covers people employed on the date shown. Independent contractors are listed separately.",
      "Qualifications, experience and languages are the minimum requirements of each position, not the qualifications of the people holding them.",
      "Names and pay are " + (names || pay ? "included at the user's request." : "not included.")]);
    const act = Store.list("employees").filter(e => e.start_date <= d && (!e.end_date || e.end_date >= d) && e.status !== "Offer accepted - not started");
    const emps = act.filter(e => e.worker_type === "Employee"), cons = act.filter(e => e.worker_type !== "Employee");
    const byT = {}; emps.forEach(e => (byT[e.job_title] = byT[e.job_title] || []).push(e));
    const natAll = {}; emps.forEach(e => natAll[e.nationality] = (natAll[e.nationality] || 0) + 1);
    rep.sections.push({ heading: "1. Job titles and nationalities", text: emps.length ? `${emps.length} employees on ${d}: ` + Object.entries(natAll).map(([k, v]) => `${k} ${v}`).join(", ") : "No employees recorded on this date.",
      columns: ["Job title", "Staff category", "Number", "Nationalities (number)"],
      rows: Object.entries(byT).sort().map(([ti, es]) => { const n = {}; es.forEach(e => n[e.nationality] = (n[e.nationality] || 0) + 1); return [ti, es[0].staff_category, es.length, Object.entries(n).map(([k, v]) => `${k} (${v})`).join("; ")]; }) });
    if (cons.length) rep.sections.push({ heading: "Independent contractors (not employees)", columns: ["Role", "Nationality", "From", "To"], rows: cons.map(c => [c.job_title, c.nationality, c.start_date, c.end_date]) });
    const seen = {}, prow = [], lrow = [];
    emps.forEach(e => { const k = e.position_id || "t:" + e.job_title; if (seen[k]) return; seen[k] = 1; const p = Store.get("positions", e.position_id);
      prow.push(p ? [p.title, p.min_qualifications || "Not recorded", p.min_experience_years ?? "Not recorded"] : [e.job_title, "Not recorded (no position linked)", "Not recorded"]);
      lrow.push(p ? [p.title, p.languages || "Not recorded"] : [e.job_title, "Not recorded (no position linked)"]); });
    rep.sections.push({ heading: "2. Minimum qualifications and experience (position requirements)", columns: ["Position", "Minimum qualifications", "Minimum years of experience"], rows: prow });
    rep.sections.push({ heading: "3. Language requirements (position requirements)", columns: ["Position", "Languages required"], rows: lrow });
    const pols = Store.list("policies").filter(p => (!p.effective_from || p.effective_from <= d) && (!p.effective_to || p.effective_to >= d));
    [["4. Accommodation", ["Accommodation"]], ["5. Health insurance", ["Health insurance"]], ["6. Travel and relocation", ["Travel and relocation"]], ["7. Other benefits", ["Other benefit", "Allowance", "Facility"]]].forEach(([h, ty]) => {
      const rows = pols.filter(p => ty.includes(p.policy_type)).map(p => [p.title, p.description, p.eligibility, p.coverage_limit, p.applies_to + (p.categories ? ` (${p.categories})` : "")]);
      rep.sections.push({ heading: h, columns: ["Policy", "What is provided", "Eligibility", "Coverage / limit", "Applies to"], rows, text: rows.length ? "" : "No policy recorded." });
    });
    if (names || pay) rep.sections.push({ heading: "Appendix: individual employees (included at user's request)", columns: ["Reference", "Job title", "Nationality", "Start date", ...(names ? ["Name"] : []), ...(pay ? ["Pay currency", "Monthly basic", "Monthly allowances"] : [])],
      rows: emps.map(e => [e.ref, e.job_title, e.nationality, e.start_date, ...(names ? [e.full_name] : []), ...(pay ? [e.pay_currency, e.monthly_basic, e.monthly_allowances] : [])]) });
    return rep;
  }
  if (code === "office_headcount") {
    const d = a.as_at || t;
    const rep = repBase(code, "as at " + fmtDate(d), ["'Assigned' = employees whose office is that office in the workforce register on the date.",
      "'Physically present' = the count recorded on the office (only if recorded), with its date.",
      "'Total company employees' = all employees on the date, whatever their office. Contractors are excluded."]);
    const offs = activeOffices(Store, d);
    const emps = Store.list("employees").filter(e => e.worker_type === "Employee" && e.start_date <= d && (!e.end_date || e.end_date >= d) && e.status !== "Offer accepted - not started");
    const rows = offs.map(o => [o.name, o.location, o.designated_status, o.area_sqm, o.area_sqft, o.measurement_basis, o.seats, emps.filter(e => e.office_id === o.id).length,
      o.present_count != null ? `${o.present_count} on ${o.present_date || "?"}` : "Not recorded", o.rent_amount ? `${fmtMoney(o.rent_amount)} ${o.rent_currency || ""} per ${(o.rent_frequency || "").toLowerCase()}` : ""]);
    const hc = actualHeadcount(d), off = actualOffice(d);
    rep.sections.push({ heading: "Offices in use", columns: ["Office", "Location", "Designated status", "Area (sqm)", "Area (sqft)", "Measurement", "Seats", "Employees assigned", "Physically present", "Rent"], rows });
    rep.sections.push({ heading: "Totals", columns: ["Measure", "Value", "Meaning"], rows: [
      ["Office space inside Colombo Port City (sqm)", off.inside, "Offices in use on the date"], ["Office space outside Colombo Port City (sqm)", off.outside, "Offices in use on the date"],
      ["Total company employees", hc.total, `All employees on ${d} (${hc.local} Sri Lankan, ${hc.foreign} non-Sri Lankan)`],
      ["Employees with no office assigned", emps.filter(e => !e.office_id || !offs.find(o => o.id === e.office_id)).length, "Workforce records without an office in use"],
      ["Independent contractors (not counted)", hc.contractors, "For information"]] });
    rep.sections.push({ heading: "Planned future office requirements (projections)", columns: ["From", "Location", "Space (sqm)", "Seats", "Basis"],
      rows: Store.list("office_plans").filter(p => p.effective_date >= d).sort((p, q) => p.effective_date.localeCompare(q.effective_date)).map(p => [p.effective_date, p.location, p.required_sqm, p.required_seats, p.basis]) });
    return rep;
  }
  if (code === "investment") {
    const s = a.start || "1900-01-01", e = a.end || t;
    const rep = repBase(code, `records dated ${s > "1901" ? fmtDate(s) : "from the start"} to ${fmtDate(e)}`, ["Only records a reviewer has confirmed count in FDI totals.", "Amounts in different currencies are never added together; totals use the USD figure on each line."]);
    const rows = Store.list("investments").filter(i => i.entry_date >= s && i.entry_date <= e).sort((p, q) => p.entry_date.localeCompare(q.entry_date));
    const by = {}; rows.forEach(i => { const k = (i.classification || "Pending review") + "|" + (i.review_status === "Confirmed" ? "Confirmed" : "Not confirmed"); by[k] = by[k] || [0, 0, 0]; if (i.usd_amount != null) by[k][0] += toC(i.usd_amount); else by[k][2]++; by[k][1]++; });
    rep.sections.push({ heading: "By classification and review status", columns: ["Classification", "Review", "Records", "USD total", "Records with no USD figure"], rows: Object.entries(by).sort().map(([k, v]) => [...k.split("|"), v[1], v[0] / 100, v[2]]) });
    const per = actualInvestment(s, e), cum = actualInvestment("1900-01-01", e);
    rep.sections.push({ heading: "FDI totals (confirmed equity, reinvested earnings, intra-company debt)", columns: ["Measure", "USD", "Basis"],
      rows: [["Period total", per.usd, s > "1901" ? `Confirmed records ${s} to ${e}` : `All confirmed records up to ${e}`], ["Cumulative to end date", cum.usd, `All confirmed records up to ${e}`], ["Records awaiting review in period", per.pending, "Not included above"]] });
    const v = referencePlan(); if (v) rep.sections.push({ heading: `Planned vs actual (plan: ${v.title} v${v.version_no}, projections)`, columns: ["Plan year", "Plan (year)", "Actual (year)", "Plan (cumulative)", "Actual (cumulative)"],
      rows: comparePlan(v).map(y => [`Year ${y.year} (${y.start} to ${y.end})`, y.metrics[0].plan, y.metrics[0].actual, y.metrics[1].plan, y.metrics[1].actual]) });
    rep.sections.push({ heading: "All records", columns: ["Date", "Source", "Country", "Relationship", "Original amount", "Currency", "USD", "Rate (per USD)", "Rate date", "Rate source", "Classification", "Review", "Bank reference"],
      rows: rows.map(i => [i.entry_date, i.source_name, i.source_country, i.relationship, i.original_amount, i.original_currency, i.usd_amount, i.usd_rate, i.rate_date, i.rate_source, i.classification, i.review_status, Store.canSee("bank") ? i.bank_reference : "Restricted"]) });
    return rep;
  }
  if (code === "annual_return") {
    const r = a.rid ? Store.get("returns", a.rid) : Store.list("returns").sort((p, q) => q.period_end.localeCompare(p.period_end))[0];
    if (!r) { const rep = repBase(code, "no annual return yet"); rep.sections.push({ text: "Create an annual return under Annual Returns first." }); return rep; }
    return arWorkingReport(r);
  }
  if (code === "requests") {
    const rep = repBase(code, "as at " + fmtDate(t), ["Responses are sent by the company, not by this system."]);
    rep.sections.push({ heading: "Requests", columns: ["Received", "Title", "Category", "Deadline", "Responsible", "Status", "Approved", "Sent on", "Sent by", "Reference"],
      rows: Store.list("requests").sort((p, q) => (q.received_date || "").localeCompare(p.received_date || "")).map(r => [r.received_date, r.title, r.category, r.deadline, Store.name(r.responsible), r.status, r.approved_at, r.submitted_at, r.submission_method, r.submission_ref]) });
    return rep;
  }
  if (code === "obligations") {
    const rep = repBase(code, "as at " + fmtDate(t), ["Status is recorded by the company. The system does not decide whether the company is compliant."]);
    rep.sections.push({ heading: "Licences, designations and agreements", columns: ["Type", "Title", "Number", "Issued", "Expires", "Status", "Reminder (days)", "Responsible"],
      rows: Store.list("licences").map(l => [l.licence_type, l.title, l.number, l.issue_date, l.expiry_date, l.status, l.renewal_notice_days, Store.name(l.responsible)]) });
    rep.sections.push({ heading: "Obligations and conditions", columns: ["Obligation", "Type", "Why it applies", "Source", "Target", "Deadline", "Repeats", "Responsible", "Status", "Adviser review"],
      rows: Store.list("obligations").map(o => [o.title, o.obligation_type, o.basis, o.source_document, o.target, o.deadline, o.recurrence, Store.name(o.responsible), o.status, o.needs_review]) });
    return rep;
  }
  if (code === "visas") {
    const within = Number(a.days || 180);
    const rep = repBase(code, `expiring within ${within} days of ${fmtDate(t)}, and all records`, ["Tracking only. The system does not apply for or grant visas.", "Names and passport details are shown only to roles allowed to see them."]);
    const rows = Store.list("visas").sort((p, q) => (p.expiry_date || "9").localeCompare(q.expiry_date || "9")).map(v => [Store.canSee("personal") ? v.person_name : "Record", v.nationality, v.role, v.visa_category, v.application_status, v.expiry_date,
      v.expiry_date ? daysUntil(v.expiry_date) : null, Store.canSee("id") ? v.passport_expiry : "Restricted", Store.canSee("id") && v.passport_expiry ? daysUntil(v.passport_expiry) : "", Store.name(v.responsible)]);
    const cols = ["Person", "Nationality", "Role", "Category", "Status", "Visa expiry", "Days left", "Passport expiry", "Passport days left", "Responsible"];
    rep.sections.push({ heading: `Expiring within ${within} days (or expired)`, columns: cols, rows: rows.filter(r => r[6] != null && r[6] <= within) });
    rep.sections.push({ heading: "All visa and permit records", columns: cols, rows });
    return rep;
  }
  if (code === "missing_docs") {
    const rep = repBase(code, "as at " + fmtDate(t));
    if (Store.can("returns")) { const rows = []; Store.list("returns").filter(r => r.status !== "Submitted").forEach(r => AR_TEMPLATE.lines.filter(l => l.kind === "doc").forEach(l => { const s = (r.lines || {})[l.key]; if (!s || s.status === "missing") rows.push([r.title, l.label]); }));
      rep.sections.push({ heading: "Annual return supporting documents - not yet ready", columns: ["Return", "Document"], rows }); }
    if (Store.can("documents")) {
      rep.sections.push({ heading: "Documents expired or expiring within 60 days", columns: ["Document", "Category", "Expiry date"], rows: Store.list("docs").filter(d => d.expiry_date && daysUntil(d.expiry_date) <= 60 && (d.access === "Normal" || canRestrictedDocs())).map(d => [d.title, d.category, d.expiry_date]) });
      rep.sections.push({ heading: "Document records with no file", columns: ["Document", "Category"], rows: Store.list("docs").filter(d => !(d.versions || []).length && (d.access === "Normal" || canRestrictedDocs())).map(d => [d.title, d.category]) });
    }
    return rep;
  }
}

/* Working report for an annual return (current working figures, or a snapshot) */
function arWorkingReport(r, snap) {
  const c = Store.company();
  const lines = snap ? snap.lines : (r.lines || {});
  const STL = { value: "Has value", nil: "Nil", not_applicable: "Not applicable", not_available: "Not available", missing: "Missing" };
  const calc = snap ? {} : arCompute(Store, r, c), bySec = {}, manual = [];
  const rep = { code: "annual_return", title: "Annual return working report - " + r.title, demo: !!c.is_demo,
    subtitle: `${c.name} · Period ${fmtDate(r.period_start)} to ${fmtDate(r.period_end)} · Headcount as at ${fmtDate(r.headcount_as_at)} · Office as at ${fmtDate(r.office_as_at)} · ` + (snap ? `Approved snapshot ${snap.version_no} (fingerprint ${snap.hash.slice(0, 12)})` : `Current working figures (${r.status})`),
    notes: [`Template: Annual Return ${AR_TEMPLATE.version} (from '${AR_TEMPLATE.source}').`,
      "Currency method: " + (r.currency_method === "split" ? "split by transaction currency (LKR transactions on LKR lines; USD and converted other currencies on USD lines)." : "full totals converted to both USD and LKR.") + " " + AR_TEMPLATE.note,
      "Use this report to check each figure and, where needed, to type values into the official fillable PDF. The system does not tick the declarations, sign, date or submit the form."], sections: [] };
  const fmtLine = (l, st) => { if (!st) return ""; if (st.status !== "value") return STL[st.status] || st.status;
    if (l.kind === "table") return st.text ? JSON.parse(st.text).map(x => `${x.country}: ${x.currency} ${fmtMoney(x.amount)}`).join("; ") : "";
    return ["amount", "area"].includes(l.kind) ? fmtMoney(st.num) : l.kind === "count" ? String(st.num) : st.text || ""; };
  for (const l of AR_TEMPLATE.lines) {
    const s = lines[l.key], val = s ? fmtLine(l, s) : "Not set", k = calc[l.key];
    const d = k ? k.detail : null;
    const how = d ? d.explanation + (d.used.length ? ` ${d.used.length} record(s) used.` : "") + (d.excluded.length ? ` ${d.excluded.length} left out: ${d.excluded.slice(0, 3).map(x => x.reason).join("; ")}.` : "") + (d.warnings.length ? " Check: " + d.warnings.join(" ") : "") : (snap ? "" : "Entered by the company (not worked out from records).");
    const pdf = l.kind === "table" ? "12 rows" : l.pdf || (l.shared025 ? "p3_field_025 (shared)" : ["doc", "confirm"].includes(l.kind) ? "Internal record" : "No field - enter by hand");
    if (!l.pdf && !["doc", "confirm", "table"].includes(l.kind) && !l.shared025) manual.push([l.ref, l.label, val]);
    const status = !s ? "Not set" : (STL[s.status] || s.status) + (s.source ? ` (${s.source.toLowerCase()})` : "");
    (bySec[l.section] = bySec[l.section] || []).push([l.ref, l.label, val, status, ...(snap ? [] : [k ? fmtLine(l, k) || "Nothing found" : ""]), how, s && s.explanation || "", s && s.reviewed_by ? Store.name(s.reviewed_by) : "Not reviewed", pdf]);
  }
  Object.entries(bySec).forEach(([h, rows]) => rep.sections.push({ heading: h, columns: ["Form ref", "Item", "Value for the return", "Status", ...(snap ? [] : ["Worked out from records"]), "How it was worked out", "Explanation", "Reviewed by", "PDF field"], rows }));
  rep.sections.push({ heading: "Enter these manually in the official PDF", text: "The 2026 PDF has no separate fields for the Non-Sri Lankan manpower column.", columns: ["Form ref", "Item", "Value"], rows: manual });
  rep.sections.push({ heading: "PDF fields left blank on purpose", columns: ["Field", "Reason"], rows: Object.entries(AR_TEMPLATE.unmapped) });
  return rep;
}

