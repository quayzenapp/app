// @ts-nocheck
/* Reviewed port of docs/artifact/src/ar.js, kept verbatim so it stays comparable with the source.
   `st` is any object with list(type) and get(type, id). See lib/ar/store.ts. */
/* Annual Return 2026: template definition, PDF field map and calculation engine.
   Ported from app/services/ar_template.py and ar_calc.py of the server version. */


const AR_FDI_CLASSES = ["Equity investment", "Reinvested earnings", "Intra-company debt"];
const AR_OPEX_TOTAL = ["Basic remuneration", "Allowance payments", "Bonus payments", "Staff accommodation", "Health insurance",
  "Transportation", "Office rent", "Other staff benefits", "Other operational expenditure", "EPF payment", "ETF payment", "Gratuity payment"];
const AR_REMUNERATION = ["Basic remuneration", "Allowance payments", "Bonus payments", "Staff accommodation", "Health insurance",
  "Transportation", "Other staff benefits"];

export const AR_TEMPLATE = (function () {
  const lines = [];
  const L = (key, label, section, kind, o = {}) => lines.push(Object.assign({ key, label, section, kind }, o));
  const S1 = "1. Particulars of the Authorised Person";
  L("p_ap_name", "Authorised Person name", S1, "text", { ref: "1(a)", pdf: "p1_field_001", calc: "company:name" });
  L("p_licence_no", "Licence number", S1, "text", { ref: "1(b)", pdf: "p1_field_002", calc: "licence" });
  L("p_app_type", "Application type (AP / Primary BSI / Secondary BSI / Duty Free BSI)", S1, "text", { ref: "1(c)", pdf: "p1_field_003", calc: "company:designation_type" });
  L("p_sector", "Business sector (as per the AP licence)", S1, "text", { ref: "1(d)", pdf: "p1_field_004", calc: "company:business_sector", note: "Check it matches the licence wording." });
  L("p_project_status", "Project status (Operations Commenced / Not Commenced)", S1, "text", { ref: "1(e)", pdf: "p1_field_005", calc: "project_status" });
  L("p_reg_address", "Registered address", S1, "text", { ref: "1(f)", pdf: "p1_field_006", calc: "company:registered_address" });
  [["p1_field_007", "p1_checkbox_01"], ["p1_field_009", "p1_checkbox_02"], ["p1_field_011", "p1_checkbox_03"]].forEach(([f, c], i) => {
    L("p_op_address_" + (i + 1), "Operating address " + (i + 1), S1, "text", { ref: "1(g)", pdf: f, calc: "office_address:" + i });
    L("p_op_designated_" + (i + 1), "Operating address " + (i + 1) + " is a designated location", S1, "bool", { ref: "1(g)", pdf: c, calc: "office_designated:" + i, note: "Ticked only when the office register shows an approved designation." });
  });
  L("p_tin", "TIN number", S1, "text", { ref: "1(h)", pdf: "p1_field_013", calc: "company:tin" });
  L("p_roc", "Forms submitted to the Registrar of Companies, or reason if none", S1, "longtext", { ref: "1(i)", pdf: "p1_field_014", calc: "company:roc_filing_info" });
  L("p_contact_name", "Point of contact - name", S1, "text", { ref: "1(j)", pdf: "p1_field_015", calc: "company:contact_name" });
  L("p_contact_email", "Point of contact - email", S1, "text", { ref: "1(j)", pdf: "p1_field_016", calc: "company:contact_email" });
  L("p_contact_phone", "Point of contact - telephone", S1, "text", { ref: "1(j)", pdf: "p1_field_017", calc: "company:contact_phone" });

  const rev = [];
  for (let i = 1; i <= 12; i++) rev.push(i < 12 ? { country: `p2_field_${String(3 * i - 2).padStart(3, "0")}`, currency: `p2_field_${String(3 * i - 1).padStart(3, "0")}_currency`, amount: `p2_field_${String(3 * i).padStart(3, "0")}` }
    : { country: "p2_field_034", currency: "p2_currency_12", amount: "p2_field_036" });
  L("r_revenue", "Revenue by country / region", "2(a) Business revenue", "table", { ref: "2(a)(i)", pdf: rev, calc: "revenue", note: "12 rows on the form. Each row is one country and one currency." });

  const S3 = "2(b) Business expenditure";
  L("b_capex_usd", "Total capital expenditure (USD)", S3, "amount", { currency: "USD", ref: "2(b)(i)", pdf: "p2_field_037", calc: "cats", cats: ["Capital expenditure"] });
  L("b_capex_lkr", "Total capital expenditure (LKR)", S3, "amount", { currency: "LKR", ref: "2(b)(i)", pdf: "p2_field_038", calc: "cats", cats: ["Capital expenditure"] });
  L("b_opex_usd", "Total operational expenditure (USD)", S3, "amount", { currency: "USD", ref: "2(b)(ii)", pdf: "p2_field_039", calc: "cats", cats: AR_OPEX_TOTAL, note: "Includes EPF, ETF and gratuity (the form lists them as operational expenditure, with no breakdown line)." });
  L("b_opex_lkr", "Total operational expenditure (LKR)", S3, "amount", { currency: "LKR", ref: "2(b)(ii)", pdf: "p2_field_040", calc: "cats", cats: AR_OPEX_TOTAL });
  [["basic", "Basic remuneration", ["Basic remuneration"], "p2_field_043", "p2_field_044"],
   ["allow", "Allowance payments", ["Allowance payments"], "p2_field_045", "p2_field_046"],
   ["bonus", "Bonus payments", ["Bonus payments"], "p2_field_047", "p2_field_048"],
   ["accom", "Staff accommodation", ["Staff accommodation"], "p2_field_050", "p2_field_051"],
   ["health", "Health insurance", ["Health insurance"], "p3_field_001", "p3_field_002"],
   ["transport", "Transportation", ["Transportation"], "p3_field_003", "p3_field_004"],
   ["rent", "Office rent", ["Office rent"], "p3_field_006", "p3_field_007"],
   ["other", "Other operational expenditure", ["Other operational expenditure", "Other staff benefits"], "p3_field_008", "p3_field_009"]]
    .forEach(([s, lbl, cats, fu, fl]) => {
      L(`b_${s}_usd`, lbl + " (USD)", S3, "amount", { currency: "USD", ref: "2(b)(ii)", pdf: fu, calc: "cats", cats });
      L(`b_${s}_lkr`, lbl + " (LKR)", S3, "amount", { currency: "LKR", ref: "2(b)(ii)", pdf: fl, calc: "cats", cats });
    });
  L("b_fdi_total", "Total foreign direct investment (USD)", S3, "amount", { currency: "USD", ref: "2(b)(iii)", pdf: "p3_field_011", calc: "fdi", classes: AR_FDI_CLASSES });
  L("b_fdi_equity", "FDI - equity investment (USD)", S3, "amount", { currency: "USD", ref: "2(b)(iii)", pdf: "p3_field_013", calc: "fdi", classes: ["Equity investment"] });
  L("b_fdi_reinvested", "FDI - reinvested earnings (USD)", S3, "amount", { currency: "USD", ref: "2(b)(iii)", pdf: "p3_field_014", calc: "fdi", classes: ["Reinvested earnings"] });
  L("b_fdi_debt", "FDI - intra-company debt (USD)", S3, "amount", { currency: "USD", ref: "2(b)(iii)", pdf: "p3_field_015", calc: "fdi", classes: ["Intra-company debt"] });

  const S4 = "2(c) Manpower";
  [["Sri Lankan", "sl", { emp: "p3_field_017", rem_usd: "p3_field_018", rem_lkr: "p3_field_019", epf: "p3_field_020", etf: "p3_field_021", grat: "p3_field_022", units: "p3_field_023", rent_usd: "p3_field_024" }],
   ["Non-Sri Lankan", "nsl", {}]].forEach(([g, k, p]) => {
    L(`m_emp_${k}`, `No. of employees - ${g} (as at the headcount date)`, S4, "count", { ref: "2(c)", pdf: p.emp, calc: "headcount", group: g });
    L(`m_rem_usd_${k}`, `Total remuneration (USD) - ${g}`, S4, "amount", { currency: "USD", ref: "2(c)", pdf: p.rem_usd, calc: "grpcats", group: g, cats: AR_REMUNERATION });
    L(`m_rem_lkr_${k}`, `Total remuneration (LKR) - ${g}`, S4, "amount", { currency: "LKR", ref: "2(c)", pdf: p.rem_lkr, calc: "grpcats", group: g, cats: AR_REMUNERATION });
    L(`m_epf_${k}`, `EPF payment (LKR) - ${g}`, S4, "amount", { currency: "LKR", ref: "2(c)", pdf: p.epf, calc: "grpcats", group: g, cats: ["EPF payment"], lkrOnly: true });
    L(`m_etf_${k}`, `ETF payment (LKR) - ${g}`, S4, "amount", { currency: "LKR", ref: "2(c)", pdf: p.etf, calc: "grpcats", group: g, cats: ["ETF payment"], lkrOnly: true });
    L(`m_grat_${k}`, `Gratuity payment (LKR) - ${g}`, S4, "amount", { currency: "LKR", ref: "2(c)", pdf: p.grat, calc: "grpcats", group: g, cats: ["Gratuity payment"], lkrOnly: true });
    L(`m_units_${k}`, `No. of residential units leased/purchased - ${g}`, S4, "count", { ref: "2(c)", pdf: p.units, calc: "units", group: g, note: "Counted as units held at any time in the period. Confirm with the Commission." });
    L(`m_rent_usd_${k}`, `Rental / lease payments (USD) - ${g}`, S4, "amount", { currency: "USD", ref: "2(c)", pdf: p.rent_usd, calc: "grpcats", group: g, cats: ["Staff accommodation"] });
    L(`m_rent_lkr_${k}`, `Rental / lease payments (LKR) - ${g}`, S4, "amount", { currency: "LKR", ref: "2(c)", pdf: null, shared025: true, calc: "grpcats", group: g, cats: ["Staff accommodation"] });
  });

  const S5 = "2(d) Office space";
  L("o_in_sqm", "Office space currently used within Port City (sqm)", S5, "area", { ref: "2(d)(i)", pdf: "p4_field_004", calc: "office_sqm", loc: "Inside Colombo Port City" });
  L("o_in_rent_usd", "Annual lease / rent paid - within Port City (USD)", S5, "amount", { currency: "USD", ref: "2(d)(i)", pdf: "p4_field_005", calc: "office_rent", loc: "Inside Colombo Port City" });
  L("o_in_rent_lkr", "Annual lease / rent paid - within Port City (LKR)", S5, "amount", { currency: "LKR", ref: "2(d)(i)", pdf: "p4_field_006", calc: "office_rent", loc: "Inside Colombo Port City" });
  L("o_proj_sqm", "Projected space within Port City from 2028 (sqm)", S5, "area", { ref: "2(d)(ii)", pdf: "p4_field_007", calc: "plan", fld: "required_sqm", note: "From planned office requirements starting in 2028. A projection, not a commitment." });
  L("o_proj_rent_usd", "Projected annual rent within Port City from 2028 (USD)", S5, "amount", { currency: "USD", ref: "2(d)(ii)", pdf: "p4_field_008", calc: "plan", fld: "annual_rent_usd" });
  L("o_proj_rent_lkr", "Projected annual rent within Port City from 2028 (LKR)", S5, "amount", { currency: "LKR", ref: "2(d)(ii)", pdf: "p4_field_009", calc: "plan", fld: "annual_rent_lkr" });
  L("o_out_sqm", "Office space currently occupied outside Port City (sqm)", S5, "area", { ref: "2(d)(iii)", pdf: "p4_field_010", calc: "office_sqm", loc: "Outside Colombo Port City" });
  L("o_out_rent_usd", "Annual lease / rent paid - outside Port City (USD)", S5, "amount", { currency: "USD", ref: "2(d)(iii)", pdf: "p4_field_011", calc: "office_rent", loc: "Outside Colombo Port City" });
  L("o_out_rent_lkr", "Annual lease / rent paid - outside Port City (LKR)", S5, "amount", { currency: "LKR", ref: "2(d)(iii)", pdf: "p4_field_012", calc: "office_rent", loc: "Outside Colombo Port City" });

  const S6 = "Supporting documents and declarations";
  L("e_doc_afs", "Audited financial statements of the company", S6, "doc", { ref: "Doc 1" });
  L("e_doc_ubo", "Beneficial Ownership Declaration Form (UBO form)", S6, "doc", { ref: "Doc 2" });
  L("e_doc_roc", "Copies of forms submitted to the Registrar of Companies", S6, "doc", { ref: "Doc 3" });
  L("e_doc_reg", "Licence / approval for regulated business (only if regulated)", S6, "doc", { ref: "Doc 4" });
  L("e_conf_tax", "Company has confirmed all IRD tax filing obligations for the year are met", S6, "confirm", { ref: "Decl. 1", note: "Internal record only. The system never ticks this declaration in the PDF." });
  L("e_conf_ret", "Company has confirmed all retirement benefit contributions and obligations are met", S6, "confirm", { ref: "Decl. 2", note: "Internal record only. Not ticked in the PDF by the system." });
  L("e_outstanding", "Reasons for any outstanding obligations (if not confirmed)", S6, "longtext", { ref: "Decl. 3", pdf: "p4_field_013" });
  L("e_signatory", "Full name of authorised signatory", S6, "text", { ref: "Signatory", pdf: "p4_field_014", calc: "company:signatory_name" });
  return {
    code: "AR-2026", version: "2026", source: "Annual Return Submission Form_2026.pdf",
    period: { start: "2025-04-01", end: "2026-03-31", headcount: "2026-03-31" }, projectionYear: "2028",
    note: "Form note: amounts should be reported in either USD or LKR; other currencies converted and reported in USD.",
    lines, neverFill: ["p4_checkbox_01", "p4_checkbox_02", "p4_checkbox_03", "p4_field_015", "p4_field_016"], clear: ["p2_field_002_currency"],
    unmapped: {
      "p1_field_008/010/012": "Text fields placed over the designated-location tick boxes. Left blank; the tick boxes are used.",
      "p2_field_035": "Second field in the currency cell of revenue row 12. Left blank.",
      "p2_field_041, 042, 049": "Fields beside headings (possibly sub-totals). Left blank.",
      "p3_field_005, 010, 012": "Fields on empty or heading rows. Left blank.",
      "p3_field_016": "One large box over both manpower columns. The Non-Sri Lankan column has no fields: enter those figures manually.",
      "p3_field_025": "One field across both columns of the last manpower row; filled as 'SL: x | Non-SL: y'.",
      "p4_field_001-003": "Fields over the office table's heading row. Left blank.",
      "p4_field_015, 016": "Signature and date of submission. Never filled.",
    },
  };
})();

/* ---------------- money helpers (cents to avoid floating errors) ---------------- */
const toC = v => Math.round(Number(v) * 100);
const fromC = c => c / 100;

function arEntries(st, period, cats, group) {
  return st.list("fin_entries").filter(e => cats.includes(e.category) && e.entry_date >= period[0] && e.entry_date <= period[1]
    && (!group || e.staff_group === group));
}

function moneyLine(entries, currency, method, lkrOnly) {
  let total = 0; const used = [], excluded = [];
  for (const e of entries) {
    const cur = (e.original_currency || "").toUpperCase();
    let amt = null, why = null;
    if (method === "split" && !lkrOnly) {
      if (currency === "LKR") { if (cur !== "LKR") continue; amt = e.original_amount; }
      else { if (cur === "LKR") continue; amt = e.usd_amount; if (amt == null) why = `${cur} amount has no USD conversion`; }
    } else if (currency === "USD") { amt = e.usd_amount; if (amt == null) why = `${cur} amount has no USD conversion`; }
    else { amt = e.lkr_amount; if (amt == null) why = `${cur} amount has no LKR conversion`; }
    if (why) { excluded.push({ e, reason: why }); continue; }
    total += toC(amt); used.push({ e, used: amt });
  }
  return { value: used.length ? fromC(total) : null, used, excluded };
}

function methodNote(method, cur) {
  if (method === "split") return cur === "LKR" ? " LKR line: LKR transactions only." : " USD line: USD transactions plus other currencies converted to USD (LKR transactions excluded).";
  return ` Full total converted to ${cur}.`;
}

function activeOffices(st, date) {
  return st.list("offices").filter(o => o.status !== "Planned" && (!o.in_use_from || o.in_use_from <= date) && (!o.in_use_to || o.in_use_to >= date))
    .sort((a, b) => (a.location === "Inside Colombo Port City" ? 0 : 1) - (b.location === "Inside Colombo Port City" ? 0 : 1) || (a.name || "").localeCompare(b.name || ""));
}

/* Returns {key: {status, num, text, detail:{explanation, used, excluded, warnings}}} */
export function arCompute(st, ret, company): Record<string, any> {
  const out = {}, period = [ret.period_start, ret.period_end], method = ret.currency_method;
  const R = (num, text, explanation, used = [], excluded = [], warnings = []) => ({
    status: (num != null || (text != null && text !== "")) ? "value" : "missing", num, text, detail: { explanation, used, excluded, warnings } });
  const lic = company.main_licence_id ? st.get("licences", company.main_licence_id) : null;
  const offs = activeOffices(st, ret.office_as_at);
  for (const l of AR_TEMPLATE.lines) {
    if (!l.calc) continue;
    const [kind, arg] = l.calc.split(":");
    let r;
    if (kind === "company") r = R(null, company[arg] || null, `From Company Profile.`);
    else if (kind === "project_status") r = R(null, { Yes: "Operations Commenced", No: "Operations Not Commenced" }[company.operations_commenced] || null, "From Company Profile > Operations commenced.");
    else if (kind === "licence") { const n = lic ? lic.number : company.licence_number || null;
      r = R(null, n, lic ? "From the main licence record chosen in Company Profile." : "From the licence number in Company Profile (public register entry).", [], [],
        [...(!lic && !n ? ["No licence number recorded. Add it in Company Profile."] : []), ...(lic && company.licence_number && lic.number !== company.licence_number ? [`The main licence record (${lic.number}) and the public register entry (${company.licence_number}) differ. Check which is right.`] : [])]); }
    else if (kind === "office_address") {
      const o = offs[+arg];
      if (o) r = R(null, (o.address || "").replace(/\s+/g, " "), `Office register: '${o.name}' in use on ${ret.office_as_at}.`);
      else { r = R(null, null, `No office ${+arg + 1} in use on ${ret.office_as_at}.`); if (+arg > 0) { r.status = "not_applicable"; r.autoExpl = "No further operating address recorded in the office register."; } }
      if (+arg === 2 && offs.length > 3) r.detail.warnings.push(`${offs.length} offices are in use but the form has room for 3.`);
    } else if (kind === "office_designated") {
      const o = offs[+arg];
      r = R(null, o && o.designated_status === "Designated location (approved)" ? "Yes" : "No", o ? `Office '${o.name}': ${o.designated_status || "Not applicable"}.` : "No office in this position.");
    } else if (kind === "revenue") r = arRevenue(st, period, method);
    else if (kind === "cats") {
      const ents = arEntries(st, period, l.cats);
      const m = moneyLine(ents, l.currency, method);
      r = R(m.value, null, `Financial records (${l.cats.join(", ")}) dated ${period[0]} to ${period[1]}.` + methodNote(method, l.currency), m.used, m.excluded);
      if (!ents.length) r.detail.warnings.push("No records found for this period. If there were none, mark it Nil and explain. Pre-operating costs may still need reporting.");
      else if (m.value == null && !m.excluded.length) r.detail.warnings.push(`Records exist but none belong on the ${l.currency} line under this currency method. Mark Nil if nothing is reportable here.`);
      if (m.excluded.length) r.detail.warnings.push(`${m.excluded.length} record(s) left out because a conversion is missing.`);
    } else if (kind === "grpcats") {
      const ents = arEntries(st, period, l.cats, l.group);
      const m = moneyLine(ents, l.currency, method, l.lkrOnly);
      r = R(m.value, null, `Records (${l.cats.join(", ")}) for ${l.group} staff in the period.` + (l.lkrOnly ? "" : methodNote(method, l.currency)), m.used, m.excluded);
      const un = arEntries(st, period, l.cats, "Not applicable");
      if (un.length && l.cats.length > 1) r.detail.warnings.push(`${un.length} staff cost record(s) have no staff group and are not included.`);
      if (!ents.length) r.detail.warnings.push("No records found. Mark Nil if nothing was paid.");
    } else if (kind === "fdi") {
      const all = st.list("investments").filter(i => i.entry_date >= period[0] && i.entry_date <= period[1]);
      const rows = all.filter(i => l.classes.includes(i.classification));
      let tot = 0; const used = [], excluded = [], warnings = [];
      for (const i of rows) {
        if (i.review_status !== "Confirmed") { excluded.push({ e: i, reason: "classification not yet confirmed by a reviewer" }); continue; }
        if (i.usd_amount == null) { excluded.push({ e: i, reason: "no USD amount" }); continue; }
        if (i.classification !== "Reinvested earnings" && i.from_outside_sl !== "Yes") warnings.push(`${i.source_name}: not marked as funds from outside Sri Lanka.`);
        tot += toC(i.usd_amount); used.push({ e: i, used: i.usd_amount });
      }
      const pending = all.filter(i => i.review_status !== "Confirmed" || i.classification === "Pending review").length;
      if (pending) warnings.push(`${pending} investment/funding record(s) in this period are awaiting review and are not counted as FDI.`);
      if (!used.length) warnings.push("No confirmed records. Mark Nil if there was none.");
      r = R(used.length ? fromC(tot) : null, null, `Confirmed records classified as ${l.classes.join(", ")}, dated ${period[0]} to ${period[1]}, in USD.`, used, excluded, warnings);
    } else if (kind === "headcount") {
      const d = ret.headcount_as_at;
      const act = st.list("employees").filter(e => e.start_date <= d && (!e.end_date || e.end_date >= d) && e.status !== "Offer accepted - not started" && e.nationality_group === l.group);
      const emp = act.filter(e => e.worker_type === "Employee"), con = act.filter(e => e.worker_type !== "Employee");
      r = R(emp.length, null, `Workforce register: employees (${l.group}) employed on ${d}. Contractors excluded.`, emp.map(e => ({ e, used: 1 })));
      if (con.length) r.detail.warnings.push(`${con.length} independent contractor(s) excluded.`);
      if (!emp.length) {
        if (st.list("employees").length) r.detail.warnings.push(`No ${l.group} employees on ${d}. Check this is correct.`);
        else { r.status = "missing"; r.num = null; r.detail.warnings.push("The workforce register is empty. Enter staff, or mark Nil if there were no employees."); }
      }
    } else if (kind === "units") {
      const u = st.list("housing").filter(h => h.staff_group === l.group && h.from_date <= period[1] && (!h.to_date || h.to_date >= period[0]));
      r = R(u.length ? u.length : null, null, `Residential units used by ${l.group} staff at any time in the period.`, u.map(e => ({ e, used: 1 })));
      if (!u.length) r.detail.warnings.push("No units recorded. Mark Nil if none.");
    } else if (kind === "office_sqm") {
      const rows = offs.filter(o => o.location === l.loc);
      r = R(rows.length ? fromC(rows.reduce((s, o) => s + toC(o.area_sqm || 0), 0)) : null, null, `Office register: offices ${l.loc.toLowerCase()} in use on ${ret.office_as_at}.`, rows.map(e => ({ e, used: e.area_sqm })));
      if (rows.some(o => o.measurement_basis === "Approximate")) r.detail.warnings.push("At least one area is approximate.");
      if (!rows.length) r.detail.warnings.push("No offices recorded for this location. Mark Nil or Not applicable if correct.");
    } else if (kind === "office_rent") {
      const ents = arEntries(st, period, ["Office rent"]);
      const mine = ents.filter(e => { const o = e.office_id && st.get("offices", e.office_id); return o && o.location === l.loc; });
      const m = moneyLine(mine, l.currency, method);
      r = R(m.value, null, `Office rent records linked to offices ${l.loc.toLowerCase()}, in the period.` + methodNote(method, l.currency), m.used, m.excluded);
      const un = ents.filter(e => !e.office_id).length;
      if (un) r.detail.warnings.push(`${un} rent record(s) not linked to an office are not included.`);
      if (!mine.length) r.detail.warnings.push("No rent records found for this location.");
    } else if (kind === "plan") {
      const rows = st.list("office_plans").filter(p => p.location === "Inside Colombo Port City" && (p.effective_date || "").startsWith(AR_TEMPLATE.projectionYear));
      const vals = rows.map(p => p[l.fld]).filter(v => v != null);
      r = R(vals.length ? fromC(vals.reduce((s, v) => s + toC(v), 0)) : null, null, `Planned office requirements inside Port City starting in ${AR_TEMPLATE.projectionYear}.`, rows.map(e => ({ e, used: e[l.fld] })), [],
        [rows.length ? "This is a projection, not a commitment." : `No planned requirement starting in ${AR_TEMPLATE.projectionYear} is recorded.`]);
    }
    out[l.key] = r;
  }
  return out;
}

function arRevenue(st, period, method) {
  const ents = arEntries(st, period, ["Revenue"]);
  const g = {}, excluded = [];
  for (const e of ents) {
    const country = (e.country_region || "Not specified").trim(), cur = (e.original_currency || "").toUpperCase();
    let k, amt;
    if (method === "split" && cur === "LKR") { k = country + "|LKR"; amt = e.original_amount; } else { k = country + "|USD"; amt = e.usd_amount; }
    if (amt == null) { excluded.push({ e, reason: `${cur} revenue has no USD conversion` }); continue; }
    g[k] = g[k] || { country, currency: k.split("|")[1], c: 0 }; g[k].c += toC(amt);
  }
  const rows = Object.values(g).map(x => ({ country: x.country, currency: x.currency, amount: fromC(x.c) })).sort((a, b) => b.amount - a.amount);
  const w = [];
  if (!ents.length) w.push("No revenue records found. If there was no revenue, mark Nil and explain.");
  if (rows.length > 12) w.push(`${rows.length} rows but the form has 12. Combine countries into regions.`);
  return { status: rows.length ? "value" : "missing", num: null, text: rows.length ? JSON.stringify(rows) : null,
    detail: { explanation: "Revenue records grouped by customer country and reporting currency" + (method === "split" ? " (LKR revenue kept in LKR)." : " (all converted to USD)."), used: ents.map(e => ({ e, used: e.usd_amount })), excluded, warnings: w } };
}

/* Values for the PDF form from a set of line states */
export function arPdfValues(lineState): { values: Record<string, string>; checks: Record<string, boolean>; manual: [string, string][] } {
  const PW = { nil: "Nil", not_applicable: "N/A", not_available: "Not available" };
  const values = {}, checks = {}, manual = [];
  AR_TEMPLATE.clear.forEach(f => values[f] = "");
  const fmt = (v, kind) => v == null ? "" : kind === "count" ? String(Math.round(v)) : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  for (const l of AR_TEMPLATE.lines) {
    const s = lineState[l.key] || { status: "missing" };
    if (l.kind === "table") {
      let rows = s.status === "value" && s.text ? JSON.parse(s.text) : [];
      if (PW[s.status]) rows = [{ country: PW[s.status], currency: "", amount: null }];
      l.pdf.forEach((slot, i) => { const r = rows[i]; values[slot.country] = r ? r.country : ""; values[slot.currency] = r ? r.currency : ""; values[slot.amount] = r && r.amount != null ? fmt(r.amount) : ""; });
      if (rows.length > 12) manual.push([l.label, `${rows.length - 12} row(s) do not fit`]);
      continue;
    }
    if (l.kind === "bool") { if (l.pdf) checks[l.pdf] = s.status === "value" && s.text === "Yes"; continue; }
    if (l.kind === "doc" || l.kind === "confirm") continue;
    let txt = s.status === "value" ? (["amount", "count", "area"].includes(l.kind) ? fmt(s.num, l.kind) : (s.text || "")) : (l.key.startsWith("p_op_address") ? "" : (PW[s.status] || ""));
    if (l.pdf) values[l.pdf] = txt;
    else if (!l.shared025) manual.push([l.label, txt || "(blank)"]);
  }
  const t = k => { const s = lineState[k] || {}; return s.status === "value" ? fmt(s.num) : (PW[s.status] || ""); };
  values["p3_field_025"] = `SL: ${t("m_rent_lkr_sl")} | Non-SL: ${t("m_rent_lkr_nsl")}`;
  AR_TEMPLATE.neverFill.forEach(f => { delete values[f]; delete checks[f]; });
  return { values, checks, manual };
}

