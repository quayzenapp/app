/* ===== lic_core.js ===== */
/* Licensing: the AP / BSI licence application (before a licence is issued) and later licence filings
   (notice of change, renewal, Schedule IV annual return, surrender).
   Sources, all supplied by the user on 1 Nov 2026:
   - Schedule I  Application for licence (13 pages, 413 fillable fields)
   - Schedule III Notice of change or alteration; Schedule IV Annual return; Schedule V Renewal; Schedule VI Surrender
   - Offshore Form III (changes to particulars) and Form V (notice of intention to cease business)
   - AP Declaration, UBO Declaration, Information of Directors and Shareholders, Business Profile and KMP Information (Word)
   - Technical Evaluation Form (Excel, two sheets: AP Only & Secondary BSI; Primary BSI-Only)
   - The Commission's application process page and its list of required supporting documents.
   Field names in the PDFs are generic (Text1, Check Box7 ...), so they were mapped by position on the page. */

/* ---------- module, permissions and storage ---------- */
MODULES.push("licensing");
Object.assign(PERM_CODES, { admin: PERM_CODES.admin + "a", compliance: PERM_CODES.compliance + "w", hr: PERM_CODES.hr + "r",
  finance: PERM_CODES.finance + "w", reviewer: PERM_CODES.reviewer + "a", adviser: PERM_CODES.adviser + "r" });
TYPES.push("apps", "app_people", "filings");
LOOKUPS.document_categories.includes("Licence filings") || LOOKUPS.document_categories.push("Licence filings");

const APP_TYPES = ["Authorised Person only", "Secondary BSI", "Primary BSI", "Duty Free BSI"];
const APP_STATUS = { prep: "Preparing", ready: "Ready for review", approved: "Approved for submission", submitted: "Submitted for preliminary review",
  info: "Further information requested", aip: "Approval in Principle received", clear: "Regulatory clearances in progress", issued: "Licence issued",
  withdrawn: "Withdrawn", rejected: "Rejected" };
const APP_STAGES = [["Prepare", ["Preparing", "Ready for review", "Approved for submission"]], ["Submitted", ["Submitted for preliminary review", "Further information requested"]],
  ["Approval in Principle", ["Approval in Principle received"]], ["Regulatory clearances", ["Regulatory clearances in progress"]], ["Licence issued", ["Licence issued"]]];
const APP_LOCKED = ["Submitted for preliminary review", "Approval in Principle received", "Regulatory clearances in progress", "Licence issued", "Withdrawn", "Rejected"];
Object.assign(BADGE, { Preparing: "warn", "Approved for submission": "ok", "Submitted for preliminary review": "info", "Further information requested": "bad",
  "Approval in Principle received": "ok", "Regulatory clearances in progress": "info", "Licence issued": "ok", Withdrawn: "", Ready: "ok", Requested: "warn",
  Certified: "info", "Not started": "", Acknowledged: "ok", Closed: "" });
const LEGAL_LOCAL = ["Natural Person", "General Partnership", "Company"];
const LEGAL_FOREIGN = ["Natural Person", "General Partnership", "Limited Partnership", "Limited Liability Partnership", "Company", "Foundation"];
const S1_SECTORS = ["Infrastructure", "Construction", "Hotel", "Bar", "Restaurant", "Gaming", "Education", "Healthcare", "Logistics", "Retail trade and services",
  "Wholesale trade and service", "Utilities", "Sports and Leisure", "Entertainment", "Banking", "Non-banking financial business", "Information Technology", "Advisory service", "General business"];
const FUND_MODES = ["Equity", "Debt", "Debt and equity"];
const MARKS = ["Not applicable", "Nil", "Not available"];

/* ---------- small helpers ---------- */
const getPath = (o, k) => k.split(".").reduce((a, p) => a == null ? undefined : a[p], o);
function setPath(o, k, v) { const ps = k.split("."); let a = o; ps.slice(0, -1).forEach((p, i) => { if (a[p] == null || typeof a[p] !== "object") a[p] = /^\d+$/.test(ps[i + 1]) ? [] : {}; a = a[p]; }); a[ps[ps.length - 1]] = v; }
const filled = v => !(v == null || v === "" || (Array.isArray(v) && !v.length));
const isCo = a => a.legal === "Company";
const ddmmyyyy = d => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "";
const addMonthsDay = (d, m) => { const x = new Date(d + "T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() + m); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
const appOf = id => Store.get("apps", id);
const appPeople = (owner, id) => Store.list("app_people").filter(p => p[owner] === id).sort((x, y) => (Number(y.shareholding_pct) || 0) - (Number(x.shareholding_pct) || 0) || (x.created_at || "").localeCompare(y.created_at || ""));
const ROLE = { sh: "Shareholder / member / partner / founder", dir: "Director / member of the key management body", kmp: "Key management personnel (Port City operations)",
  sig: "Authorised signatory", contact: "Contact person" };
const hasRole = (p, r) => (p.roles || []).includes(ROLE[r]);

/* ---------- application fields (Schedule I parts I, II and VI, plus the questions that decide which documents apply) ---------- */
/* f(k, label, ref, type, opts). Types: text, area, choice, multi, check, yn, num, date. "sug" proposes a value from the company profile. */
const af = (k, l, ref, t = "text", o = {}) => Object.assign({ k, l, ref, t }, o);
const APP_SPEC = [
  af("app_type", "Application type", "Technical Evaluation Form, cell C3", "choice", { ch: APP_TYPES, step: "applicant", help: "Decides which sheet of the Technical Evaluation Form is used." }),
  af("origin", "Local or foreign applicant", "Schedule I, Part I(e)", "choice", { ch: ["Local", "Foreign"], step: "applicant" }),
  af("legal", "Legal personality", "Schedule I, Part I(e)", "choice", { ch: a => a.origin === "Local" ? LEGAL_LOCAL : LEGAL_FOREIGN, step: "applicant" }),
  af("p1.name", "Name of applicant", "Schedule I, Part I(a)", "text", { step: "applicant", sug: c => c.name }),
  af("p1.address", "Address of applicant", "Schedule I, Part I(b)", "area", { step: "applicant", help: "If the applicant is a company, its registered office in the country of residency, citizenship, incorporation, registration or formation. The form has three lines.", sug: c => c.register_address }),
  af("p1.country", "Country of citizenship, residency, incorporation, registration or formation", "Schedule I, Part I(c)", "text", { step: "applicant", sug: c => c.country_of_incorporation }),
  af("p1.tel", "Telephone", "Schedule I, Part I(d)", "text", { step: "applicant", sug: c => c.contact_phone }),
  af("p1.email", "Email", "Schedule I, Part I(d)", "text", { step: "applicant", sug: c => c.contact_email }),
  af("q.reg_no", "Company incorporation or registration number", "UBO Declaration; Form V", "text", { step: "applicant", when: isCo, sug: c => c.registration_no }),
  af("q.co_type", "Type of company", "UBO Declaration, Company information", "text", { step: "applicant", when: isCo, help: "For example, private limited company.", sug: c => c.legal_form }),
  af("q.lk_inc", "Incorporated in Sri Lanka under the Companies Act, No. 7 of 2007?", "Required documents: Form 1 (Form 20 where applicable)", "yn", { step: "applicant", when: isCo }),
  af("q.group_sl", "Does any company in your group have business in Sri Lanka outside Port City?", "AP Declaration, clause (d) and Annexure I", "yn", { step: "applicant", help: "If yes, your parent company must also sign the Declaration of Parent (Annexure I)." }),
  af("q.regulated", "Is any proposed activity regulated by another authority?", "AP Declaration, clause (f); Required documents: regulatory licences", "choice", { ch: YES_NO_TBC, step: "applicant", help: "For example banking, insurance or securities. Check with your legal adviser." }),
  af("planned_date", "Planned submission date", "Required documents: certificates certified within 30 days before submission", "date", { step: "applicant", need: false, help: "Used to check that certified copies will still be within 30 days." }),

  af("p2.sectors", "Business sector(s)", "Schedule I, Part II(a)", "multi", { ch: S1_SECTORS, step: "business", help: "Tick all that apply." }),
  af("p2.sector_other", "Other sector (please specify)", "Schedule I, Part II(a)", "text", { step: "business", need: false }),
  af("p2.description", "Description of the business activities", "Schedule I, Part II(b)", "area", { step: "business" }),
  af("p2.loc_within", "The proposed office is within the Area of Authority of the Colombo Port City", "Schedule I, Part II(c)", "check", { step: "business", need: false }),
  af("p2.loc_within_addr", "Full address in Port City", "Schedule I, Part II(c)", "area", { step: "business", when: a => getPath(a, "p2.loc_within") }),
  af("p2.loc_desig", "The proposed office is a designated location under section 64 of the Act", "Schedule I, Part II(c)", "check", { step: "business", need: false }),
  af("p2.loc_desig_addr", "Full address of the designated location", "Schedule I, Part II(c)", "area", { step: "business", when: a => getPath(a, "p2.loc_desig") }),
  af("p2.floor_sqm", "Proposed floor area (sqm)", "Required documents: letter requesting designation under section 64", "num", { step: "business" }),
  af("q.premises_owned", "Does the applicant own the premises?", "Required documents: evidence of occupancy rights", "yn", { step: "business" }),
  af("p2.fdi_currency", "Foreign direct investment - currency", "Schedule I, Part II(d)", "text", { step: "business", help: "Foreign currency (FCY), e.g. USD." }),
  af("p2.fdi_quantum", "Foreign direct investment - amount", "Schedule I, Part II(d)", "num", { step: "business" }),
  af("p2.fdi_mode", "Foreign direct investment - mode of funding", "Schedule I, Part II(d)", "choice", { ch: FUND_MODES, step: "business" }),
  af("p2.fdi_source", "Foreign direct investment - source", "Schedule I, Part II(d)", "text", { step: "business" }),
  af("p2.lkr_currency", "Other investments - currency", "Schedule I, Part II(d)", "text", { step: "business", dflt: "LKR" }),
  af("p2.lkr_quantum", "Other investments (LKR) - amount", "Schedule I, Part II(d)", "num", { step: "business" }),
  af("p2.lkr_mode", "Other investments - mode of funding", "Schedule I, Part II(d)", "choice", { ch: FUND_MODES, step: "business" }),
  af("p2.lkr_source", "Other investments - source", "Schedule I, Part II(d)", "text", { step: "business" }),
  af("p2.signatory", "Authorised signatory", "Schedule I, Part II(g)", "text", { step: "business", sug: c => c.signatory_name }),
  af("p2.signatory_designation", "Authorised signatory - designation", "Letters and declarations", "text", { step: "business", sug: c => c.signatory_designation }),
  af("p2.contact", "Contact person", "Schedule I, Part II(g)", "text", { step: "business", sug: c => c.contact_name }),
  af("p2.sup_name", "Supervisory authority - name", "Schedule I, Part II(h) (if applicable)", "text", { step: "business", help: "The regulator in the country of incorporation, if any. Mark 'Not applicable' if there is none." }),
  af("p2.sup_address", "Supervisory authority - address", "Schedule I, Part II(h)", "area", { step: "business" }),
  af("p2.sup_official", "Official with oversight - name", "Schedule I, Part II(h)", "text", { step: "business" }),
  af("p2.sup_designation", "Official with oversight - designation", "Schedule I, Part II(h)", "text", { step: "business" }),
  af("p2.sup_phone", "Official with oversight - telephone", "Schedule I, Part II(h)", "text", { step: "business" }),
  af("p2.sup_email", "Official with oversight - email", "Schedule I, Part II(h)", "text", { step: "business" }),
  af("p2.other_info", "Any other information relevant to the application", "Schedule I, Part II(i)", "area", { step: "business" }),

  af("p6.objective", "Objective of establishment", "Schedule I, Part VI(a)", "area", { step: "proposal" }),
  af("p6.products", "Type of products or services", "Schedule I, Part VI(b)", "area", { step: "proposal", help: "For offshore banking, name the services under section 46 of the Act." }),
  af("p6.target_market", "Target market", "Schedule I, Part VI(c); Business plan", "area", { step: "proposal" }),
  af("p6.strategy", "Business operational and strategic plan", "Schedule I, Part VI(d); Business plan", "area", { step: "proposal", help: "A credible and viable plan that sets out how the business objectives will be put into practice." }),
  af("p6.controls", "Internal policies and controls suited to the business profile and risks", "Schedule I, Part VI(e)", "area", { step: "proposal" }),
  af("bp.operating_model", "Operating model", "Business plan (Required documents list)", "area", { step: "proposal", help: "How the business will run: team, delivery, systems, partners." }),
  af("bp.assumptions", "Main assumptions behind the financial projections", "Business plan (Required documents list)", "area", { step: "proposal", need: false }),
];
const APP_FMAP = Object.fromEntries(APP_SPEC.map(f => [f.k, f]));
/* Part VI(f) manpower table */
const MP_ROWS = [["mp", "a) Managerial & Professional"], ["ts", "b) Technical & Supervisory"], ["sk", "c) Operation workers - skilled"], ["us", "c) Operation workers - unskilled"], ["cg", "d) Clerical & General workers"]];

/* ---------- people in the application (Parts II(e)-(f), III, IV, V; Directors & Shareholders form; Business Profile KMP) ---------- */
const pf = (k, l, t = "text", o = {}) => Object.assign({ k, l, t }, o);
const PERSON_SPEC = [
  pf("kind", "Individual or company", "choice", { ch: ["Individual", "Corporate"], g: "who", need: true }),
  pf("name", "Full name (as per NIC or passport) or company name", "text", { g: "who", need: true }),
  pf("roles", "Roles in the application", "multi", { ch: Object.values(ROLE), g: "who", need: true }),
  pf("shareholding_pct", "Ownership (%)", "num", { g: "who", when: p => hasRole(p, "sh"), need: true }),
  pf("nationality", "Nationality, or country of incorporation", "text", { g: "who", need: true }),
  pf("address", "Address", "area", { g: "who", sens: "personal", need: true }),
  pf("id_no", "Registration no. (companies), passport no. (foreign nationals) or NIC no. (Sri Lankan citizens)", "text", { g: "who", sens: "id", need: true }),
  pf("position", "Position to be held", "text", { g: "who", when: p => hasRole(p, "dir"), need: true }),
  pf("designation_pc", "Designation in the Port City operation", "text", { g: "who", when: p => hasRole(p, "kmp"), need: true }),
  pf("years_sector", "Experience in the intended business sector (years)", "num", { g: "who", when: p => hasRole(p, "kmp"), need: true }),
  pf("source_person_id", "Linked company register record", "text", { g: "hidden" }),
  // Information of Directors and Shareholders form
  pf("other_businesses", "Names of other businesses or companies engaged in", "area", { g: "ds", when: p => hasRole(p, "sh") || hasRole(p, "dir"), need: true }),
  pf("jurisdictions", "Jurisdiction of registration of those businesses", "text", { g: "ds", when: p => hasRole(p, "sh") || hasRole(p, "dir"), need: true }),
  pf("years_operation", "Years of operation of those businesses", "text", { g: "ds", when: p => hasRole(p, "sh") || hasRole(p, "dir"), need: true }),
  pf("other_details", "Any other relevant details", "area", { g: "ds", when: p => hasRole(p, "sh") || hasRole(p, "dir"), need: false }),
  // Part III - corporate partners / members / founders
  pf("c_nature", "Nature and type of business", "area", { g: "p3", need: true }),
  pf("c_inc_date", "Date of incorporation or registration", "date", { g: "p3", need: true }),
  pf("c_inc_place", "Place of incorporation or registration", "text", { g: "p3", need: true }),
  pf("c_lic_date", "Licence - date (if applicable)", "date", { g: "p3" }),
  pf("c_lic_type", "Licence - type (if applicable)", "text", { g: "p3" }),
  pf("c_lic_no", "Licence - number (if applicable)", "text", { g: "p3" }),
  pf("c_sup_name", "Supervisory authority - name (if applicable)", "text", { g: "p3" }),
  pf("c_sup_address", "Supervisory authority - address", "area", { g: "p3" }),
  pf("c_sup_tel", "Supervisory authority - telephone", "text", { g: "p3" }),
  pf("c_sup_email", "Supervisory authority - email", "text", { g: "p3" }),
  pf("c_capital", "Capital and reserves, latest three years (state currency)", "rows", { g: "p3", rows: 3, cols: [["year", "Year"], ["capital", "Capital"], ["retained", "Retained profits / accumulated losses"], ["other", "Other reserves"]], help: "Required only if the ownership interest is 5% or more." }),
  pf("c_perf", "Financial performance, latest three years (state currency)", "rows", { g: "p3", rows: 3, cols: [["year", "Financial year"], ["assets", "Total assets"], ["liabilities", "Total liabilities"], ["pbt", "Profit / loss before tax"]], help: "Required only if the ownership interest is 5% or more. Attach audited financial statements for three years." }),
  pf("c_holders", "Shareholders holding 5% or more of this company", "rows", { g: "p3", rows: 13, cols: [["name", "Name"], ["country", "Country"], ["pct", "%"]] }),
  pf("c_board", "Board of directors of this company", "rows", { g: "p3", rows: 10, cols: [["name", "Name"], ["nationality", "Nationality"], ["nature", "Executive or non-executive"]] }),
  // Parts IV and V - individuals
  pf("title", "Title (Mr, Mrs, Dr, Miss)", "text", { g: "p45", need: true }),
  pf("dob", "Date of birth", "date", { g: "p45", sens: "id", need: true }),
  pf("pob", "Place of birth", "text", { g: "p45", sens: "id", need: true }),
  pf("gender", "Gender", "choice", { g: "p45", ch: ["Male", "Female", "Other"], need: true }),
  pf("nic", "NIC no. (Sri Lankans)", "text", { g: "p45", sens: "id" }),
  pf("passport_no", "Passport no.", "text", { g: "p45", sens: "id" }),
  pf("passport_expiry", "Passport expiry date", "date", { g: "p45", sens: "id" }),
  pf("passport_country", "Passport country of issue", "text", { g: "p45", sens: "id" }),
  pf("passport_authority", "Passport issuing authority", "text", { g: "p45", sens: "id" }),
  pf("residence_length", "Length of (proposed) residence in Sri Lanka, if any", "text", { g: "p45" }),
  pf("work_permit", "Work permit applied for before or with this application?", "yn", { g: "p45", help: "If yes, attach a certified copy of the work permit." }),
  pf("nw_assets", "Net worth statement - total assets (currency and amount)", "text", { g: "p4", sens: "bank" }),
  pf("nw_liabilities", "Net worth statement - total liabilities (currency and amount)", "text", { g: "p4", sens: "bank" }),
  pf("banks", "Bank statements certified by the bank", "rows", { g: "p4", sens: "bank", rows: 3, cols: [["bank", "Bank"], ["type", "Account type"], ["date", "Statement date"], ["amount", "Currency and amount"]] }),
  pf("cv_edu", "CV - tertiary / highest education", "rows", { g: "cv", rows: 1, cols: [["type", "Qualification"], ["inst", "School / college / university"], ["year", "Year"]] }),
  pf("cv_prof", "CV - professional qualifications", "rows", { g: "cv", rows: 3, cols: [["type", "Qualification"], ["inst", "Institution"], ["year", "Year"]] }),
  pf("cv_memb", "CV - membership of professional bodies", "rows", { g: "cv", rows: 3, cols: [["type", "Type and details"], ["inst", "Institution"], ["year", "Year"]] }),
  pf("cv_work", "CV - past and current work experience", "rows", { g: "cv", rows: 3, cols: [["from", "From"], ["to", "To"], ["employer", "Employer"], ["designation", "Designation"], ["resp", "Key responsibilities"]] }),
  pf("cv_dirs", "CV - directorships in other companies", "rows", { g: "cv", rows: 4, cols: [["company", "Company"], ["place", "Place of incorporation"], ["date", "Date of appointment"], ["nature", "Executive or non-executive"]] }),
];
const PERSON_FMAP = Object.fromEntries(PERSON_SPEC.map(f => [f.k, f]));
/* Which parts of Schedule I a person needs */
function personParts(p, a) {
  const parts = [], notCo = a && a.legal !== "Company";
  if (hasRole(p, "sh") && notCo) parts.push(p.kind === "Corporate" ? "III" : "IV");
  if (hasRole(p, "dir") && p.kind !== "Corporate") parts.push("V");
  return parts;
}
function personGroups(p, a) {
  const parts = personParts(p, a), g = ["who"];
  if (hasRole(p, "sh") || hasRole(p, "dir")) g.push("ds");
  if (parts.includes("III")) g.push("p3");
  if (parts.includes("IV") || parts.includes("V")) g.push("p45");
  if (parts.includes("IV")) g.push("p4", "cv");
  return g;
}
const PERSON_GROUP_LABELS = { who: ["Who they are", "Used in Schedule I, Part II(e)-(g), and the other application forms."],
  ds: ["Information of Directors and Shareholders form", "The Commission's prescribed form, one row per director or shareholder."],
  p3: ["Schedule I, Part III - corporate partner / member / founder", "Completed for each corporate member when the applicant is not a company."],
  p45: ["Schedule I, Parts IV and V - personal details", "Part IV for individual members (when the applicant is not a company); Part V for each director and member of the key management body."],
  p4: ["Schedule I, Part IV(h) - financial net worth", "Required only if the ownership interest is 5% or more."],
  cv: ["Schedule I, Part IV(i) - curriculum vitae", "Required only if the ownership interest is more than 5%."] };
function personMissing(p, a) {
  const gs = personGroups(p, a), out = [];
  for (const f of PERSON_SPEC) {
    if (!gs.includes(f.g) || !f.need || (f.when && !f.when(p))) continue;
    if (!filled(p[f.k]) && !(p.marks || {})[f.k]) out.push(f.l);
  }
  if (gs.includes("p45") && !filled(p.nic) && !filled(p.passport_no) && !(p.marks || {}).passport_no) out.push("NIC no. or passport no.");
  return out;
}

/* ---------- readiness ---------- */
const APP_STEPS = [["overview", "Overview"], ["applicant", "Applicant"], ["business", "Business"], ["people", "People"], ["proposal", "Proposed business"],
  ["projections", "Projections"], ["profile", "Business profile"], ["declarations", "Declarations"], ["checklist", "Documents"], ["forms", "Forms and downloads"], ["history", "History"]];
function stepMissing(a, step) {
  const out = [];
  for (const f of APP_SPEC) {
    if (f.step !== step || f.need === false || (f.when && !f.when(a))) continue;
    if (!filled(getPath(a, f.k)) && !(a.marks || {})[f.k]) out.push(f.l);
  }
  if (step === "business" && !getPath(a, "p2.loc_within") && !getPath(a, "p2.loc_desig")) out.push("Location of proposed office (within Port City or a designated location)");
  if (step === "proposal") { const m = getPath(a, "p6.mp") || {}; if (!MP_ROWS.some(([k]) => filled((m[k] || {}).local) || filled((m[k] || {}).nonlocal))) out.push("Manpower planning table"); }
  if (step === "people") {
    const ps = appPeople("app_id", a.id);
    if (!ps.some(p => hasRole(p, "sh"))) out.push("At least one shareholder, member, partner or founder");
    if (!ps.some(p => hasRole(p, "dir"))) out.push("At least one director or member of the key management body");
    if (!ps.some(p => hasRole(p, "kmp"))) out.push("Key management personnel for the Port City operation");
    ps.forEach(p => { const m = personMissing(p, a); if (m.length) out.push(`${p.name || "Unnamed person"}: ${m.length} detail(s) missing`); });
  }
  if (step === "projections") { const t = a.tef || {}, v = t.v || {}; if (!["revenue", "expenses"].every(k => (v[k] || []).some(filled))) out.push("Projected revenue and expenses"); if (!["m_local", "m_foreign", "o_local", "o_foreign"].some(k => (v[k] || []).some(filled))) out.push("Manpower plan"); if (!(v.floor || []).some(filled)) out.push("Office floor space"); }
  if (step === "profile") { const p = a.prof || {}; ["sectors", "years_exp", "countries", "segments", "client_sectors"].forEach(k => { if (!filled(p[k])) out.push(PROFILE_LABELS[k]); }); }
  if (step === "declarations") { const d = a.decl || {}; if (!filled(d.director1)) out.push("Directors signing the AP Declaration"); if (a.q && a.q.group_sl === "Yes" && !filled(d.parent_name)) out.push("Parent company name and address (Annexure I)"); if (!Store.list("ubo").length) out.push("Beneficial owners (Company Profile > Beneficial owners)"); ["name", "capacity", "email"].forEach(k => { if (!filled((d.presenter || {})[k])) out.push("UBO presenter: " + k); }); }
  return out;
}
const PROFILE_LABELS = { sectors: "Business sectors", years_exp: "Years of experience in the relevant sectors", countries: "Countries served", segments: "Target segments", client_sectors: "Industry / business sectors of clients" };
function appReadiness(a) {
  const steps = APP_STEPS.filter(([k]) => !["overview", "checklist", "forms", "history"].includes(k)).map(([k, l]) => ({ k, l, missing: stepMissing(a, k) }));
  const cl = checklistRows(a), docsOk = cl.filter(r => r.done).length;
  return { steps, docs: { ok: docsOk, total: cl.length }, ready: steps.every(s => !s.missing.length) && docsOk === cl.length };
}

/* ---------- supporting documents checklist ----------
   From the Commission's list of required documents (application process page) and Schedule I Part VII.
   "per" expands an item into one line per person or entity. "gen" = the system can prepare a draft or fill the form. */
const CL_STATUS = ["Not started", "Requested", "Received", "Certified", "Ready", "Not applicable"];
const CHECKLIST = [
  { k: "s1", t: "Application form (Schedule I), completed", src: "Application process page, step 1; Schedule I", gen: "s1" },
  { k: "fee", t: "Proof of payment of the application processing fee", src: "Schedule I, instruction (2); Fees Regulations No. 2 of 2024 (Gazette 2387/38)", help: "Confirm the current fee with the Commission before paying." },
  { k: "form_i", t: "Offshore Company Registration Form (Form I)", src: "Schedule I, Part VII(B); application process page", when: isCo, help: "Not supplied to Quayzen, so it can't be filled here. Download it from the Commission's website." },
  { k: "coi", t: "Certificate of Incorporation, certified by the issuing authority within 30 days before submission", src: "Required documents; Schedule I, Part VII(B)", when: isCo, cert30: true },
  { k: "constitution", t: "Constitutional documents (charter, statute, memorandum or articles of association, or equivalent), certified by the company registry, company secretary or attorney-at-law; certified English translation if not in English", src: "Required documents; Schedule I, Part VII(B)", when: isCo },
  { k: "res_impediment", t: "Board resolution confirming no legal impediment in the country of incorporation to carry on business as an offshore company", src: "Required documents; Schedule I, Part VII(B) (statement signed by each director)", when: isCo, gen: "res_impediment" },
  { k: "res_signatory", t: "Board resolution appointing the Authorised Signatory, signed by all directors (or certified by the company secretary where there is a sole director)", src: "Required documents; Schedule I, Part VII(A)", gen: "res_signatory" },
  { k: "passports", t: "Certified copy of passport", src: "Required documents (all directors and individual shareholders); Schedule I, Part VII(A)", per: "passport" },
  { k: "corp_coi", t: "Certificate of Incorporation of corporate shareholder, certified within 30 days before submission", src: "Required documents; Schedule I, Part VII(A)", per: "corporate", cert30: true },
  { k: "assoc_coi", t: "Certificate of Incorporation of associated entity, certified within 30 days before submission", src: "Required documents (associated entities of the applicant and/or its shareholders); Business Profile form", per: "entity", cert30: true },
  { k: "bank_ref", t: "Bank reference letter (good standing, account type and length of banking relationship)", src: "Required documents (all directors and shareholders)", per: "bankref" },
  { k: "ap_decl", t: "Authorised Person Declaration, signed by the Authorised Signatory (and the parent company where applicable)", src: "Required documents; AP Declaration (prescribed format)", gen: "ap_decl" },
  { k: "ubo_decl", t: "Ultimate Beneficial Ownership Declaration, signed on company letterhead", src: "Required documents; UBO Declaration (prescribed format)", gen: "ubo" },
  { k: "tef", t: "Technical Evaluation Form, completed", src: "Required documents; Technical Evaluation Form (prescribed format)", gen: "tef" },
  { k: "s64", t: "Letter requesting designation of the proposed location under section 64 (address and floor area in sqm), signed by the Authorised Signatory", src: "Required documents: Request for Designation of Proposed Location", gen: "s64" },
  { k: "occupancy", t: "Evidence of occupancy rights (lease, tenancy agreement, landlord authorisation or correspondence with the owner)", src: "Required documents: Request for Designation of Proposed Location", when: a => (a.q || {}).premises_owned === "No" },
  { k: "form1", t: "Form 1 (Form 20 where applicable) under the Companies Act, No. 7 of 2007", src: "Required documents", when: a => isCo(a) && (a.q || {}).lk_inc === "Yes" },
  { k: "reg_lic", t: "Regulatory licences for regulated activities", src: "Required documents; AP Declaration, clause (f)", when: a => (a.q || {}).regulated !== "No" },
  { k: "cvs", t: "Curriculum vitae", src: "Required documents (key management personnel of the Port City operation); Business Profile form", per: "kmp" },
  { k: "bplan", t: "Business plan (maximum four pages, PDF): activities, operating model, target markets, financial projections", src: "Required documents; Schedule I, Part VI(A)", gen: "bplan" },
  { k: "funds", t: "Evidence of funds and source of funds (e.g. last three months' bank statements, audited financial statements, loan agreements, investment portfolio statements)", src: "Required documents" },
  { k: "fin_statements", t: "Certified audited financial statements and reports for the last three years, where available", src: "Schedule I, Part VI(B)" },
  { k: "ds_info", t: "Information of Directors and Shareholders, completed", src: "Required documents (prescribed format)", gen: "ds" },
  { k: "bprofile", t: "Business Profile and Key Management Personnel Information, completed", src: "Required documents (prescribed format)", gen: "bprofile" },
  { k: "work_permit", t: "Certified copy of work permit", src: "Schedule I, Part IV(g) and Part V(h)", per: "permit" },
];
function checklistRows(a) {
  const ps = appPeople("app_id", a.id), st = a.checklist || {}, out = [];
  const ents = ((a.prof || {}).entities || []).filter(e => e && e.name && e.type && e.type !== "Applicant");
  const per = {
    passport: ps.filter(p => p.kind !== "Corporate" && (hasRole(p, "dir") || hasRole(p, "sh"))),
    corporate: ps.filter(p => p.kind === "Corporate" && hasRole(p, "sh")),
    bankref: ps.filter(p => hasRole(p, "dir") || hasRole(p, "sh")),
    kmp: ps.filter(p => hasRole(p, "kmp")),
    permit: ps.filter(p => p.work_permit === "Yes"),
  };
  for (const it of CHECKLIST) {
    if (it.when && !it.when(a)) continue;
    const subs = it.per === "entity" ? ents.map((e, i) => ({ key: `${it.k}:e${i}`, who: `${e.name} (${e.type})` })) : it.per ? per[it.per].map(p => ({ key: `${it.k}:${p.id}`, who: p.name || "Unnamed person" })) : [{ key: it.k, who: "" }];
    for (const s of subs) {
      const e = st[s.key] || {}, status = e.status || "Not started";
      const warn = [];
      if (it.cert30 && e.cert_date) { const ref = a.planned_date || today(), age = daysUntil(ref) - daysUntil(e.cert_date); if (age > 30) warn.push(`Certified ${age} days before ${a.planned_date ? "the planned submission date" : "today"} - more than 30 days.`); }
      if (status === "Not applicable" && !e.note) warn.push("Give the reason it does not apply.");
      out.push({ it, key: s.key, who: s.who, e, status, warn, done: (status === "Ready" || (status === "Not applicable" && !!e.note)) && !warn.length });
    }
  }
  return out;
}

/* ---------- Technical Evaluation Form ---------- */
const TEF_ROWS = [
  { k: "fdi_equity", l: "FDI - Equity", g: "FDI (USD)", ccy: "USD", det: true, s1: 9, s2: 16, pair: true, help: "Capital invested by a foreign investor in the AP." },
  { k: "fdi_loans", l: "FDI - Loans", g: "FDI (USD)", ccy: "USD", det: true, s1: 10, s2: 17, pair: true, help: "Loans or other financing from a foreign parent company or related group entity." },
  { k: "fdi_reinvested", l: "FDI - Reinvested earnings", g: "FDI (USD)", ccy: "USD", det: true, s1: 11, s2: 18, pair: true, help: "Profits retained and used in the business instead of being distributed." },
  { k: "usd_adv", l: "Customer advances (USD)", g: "Other USD funding", ccy: "USD", det: true, s1: 13, s2: 20, pair: true },
  { k: "usd_other", l: "Other USD funding (give details)", g: "Other USD funding", ccy: "USD", det: true, s1: 14, s2: 21, pair: true },
  { k: "lkr_equity", l: "LKR - Equity", g: "LKR funding", ccy: "LKR", det: true, s1: 16, s2: 23 },
  { k: "lkr_loans", l: "LKR - Loans", g: "LKR funding", ccy: "LKR", det: true, s1: 17, s2: 24 },
  { k: "lkr_adv", l: "LKR - Customer advances", g: "LKR funding", ccy: "LKR", det: true, s1: 18, s2: 25 },
  { k: "lkr_other", l: "LKR - Other (give details)", g: "LKR funding", ccy: "LKR", det: true, s1: 19, s2: 26 },
  { k: "revenue", l: "Projected revenue", g: "Financial performance (USD)", ccy: "USD", s1: 25, s2: 30 },
  { k: "expenses", l: "Projected expenses", g: "Financial performance (USD)", ccy: "USD", s1: 28, s2: 33 },
  { k: "net_income", l: "Projected net income", g: "Financial performance (USD)", ccy: "USD", s1: 30, s2: 35 },
  { k: "m_local", l: "Management - local employees at year end", g: "Manpower", int: true, s1: 36, s2: 41 },
  { k: "m_foreign", l: "Management - foreign employees at year end", g: "Manpower", int: true, s1: 37, s2: 42 },
  { k: "m_rem_local", l: "Management - local remuneration (USD a year)", g: "Manpower", ccy: "USD", s1: 39, s2: 44 },
  { k: "m_rem_foreign", l: "Management - foreign remuneration (USD a year)", g: "Manpower", ccy: "USD", s1: 40, s2: 45 },
  { k: "o_local", l: "Others - local employees at year end", g: "Manpower", int: true, s1: 42, s2: 47 },
  { k: "o_foreign", l: "Others - foreign employees at year end", g: "Manpower", int: true, s1: 43, s2: 48 },
  { k: "o_rem_local", l: "Others - local remuneration (USD a year)", g: "Manpower", ccy: "USD", s1: 45, s2: 50 },
  { k: "o_rem_foreign", l: "Others - foreign remuneration (USD a year)", g: "Manpower", ccy: "USD", s1: 46, s2: 51 },
  { k: "floor", l: "Office floor space requirement (sqm)", g: "Office space", s1: 54, s2: 59 },
];
const TEF_PAIR_LABELS = { ll: "Land lease", dev: "Development" };
const tefSheet = a => a.app_type === "Primary BSI" ? "primary" : "ap";
/* Value for one row and year (0-9). For Primary BSI FDI rows, the two halves are summed. */
function tefVal(a, k, y) {
  const v = (a.tef || {}).v || {}, row = TEF_ROWS.find(r => r.k === k);
  if (row && row.pair && tefSheet(a) === "primary") { const l = (v[k + "_ll"] || [])[y], d = (v[k + "_dev"] || [])[y]; return filled(l) || filled(d) ? (Number(l) || 0) + (Number(d) || 0) : null; }
  const x = (v[k] || [])[y]; return filled(x) ? Number(x) : null;
}
const tefSum = (a, k) => Array.from({ length: 10 }, (_, y) => tefVal(a, k, y) || 0).reduce((t, x) => t + x, 0);
function tefTotals(a) {
  const yr = y => ({
    fdi: ["fdi_equity", "fdi_loans", "fdi_reinvested"].reduce((t, k) => t + (tefVal(a, k, y) || 0), 0),
    usd_other: ["usd_adv", "usd_other"].reduce((t, k) => t + (tefVal(a, k, y) || 0), 0),
    lkr: ["lkr_equity", "lkr_loans", "lkr_adv", "lkr_other"].reduce((t, k) => t + (tefVal(a, k, y) || 0), 0),
    staff: ["m_local", "m_foreign", "o_local", "o_foreign"].reduce((t, k) => t + (tefVal(a, k, y) || 0), 0),
    local: (tefVal(a, "m_local", y) || 0) + (tefVal(a, "o_local", y) || 0), foreign: (tefVal(a, "m_foreign", y) || 0) + (tefVal(a, "o_foreign", y) || 0),
    rem_local: (tefVal(a, "m_rem_local", y) || 0) + (tefVal(a, "o_rem_local", y) || 0), rem_foreign: (tefVal(a, "m_rem_foreign", y) || 0) + (tefVal(a, "o_rem_foreign", y) || 0),
  });
  return Array.from({ length: 10 }, (_, y) => yr(y));
}
/* Suggestion for Schedule I Part II(d) from the projections (the user decides) */
function fdiSuggestion(a) {
  const tot = tefTotals(a).reduce((t, y) => t + y.fdi, 0); if (!tot) return null;
  const eq = tefSum(a, "fdi_equity") + tefSum(a, "fdi_reinvested"), debt = tefSum(a, "fdi_loans");
  const det = ["fdi_equity", "fdi_loans", "fdi_reinvested"].map(k => (((a.tef || {}).d || {})[k] || {}).provider).filter(Boolean);
  return { currency: "USD", quantum: r2(tot), mode: eq && debt ? "Debt and equity" : debt ? "Debt" : "Equity", source: [...new Set(det)].join("; ") };
}

/* ---------- licence filings after the licence is issued ---------- */
const FILING_KINDS = {
  change: { label: "Notice of change (Schedule III)", short: "Notice of change", src: "Schedule III", help: "Tell the Commission about any change to the particulars in your application, within 30 days of the change, with evidence of the change." },
  renewal: { label: "Application for renewal (Schedule V)", short: "Renewal", src: "Schedule V", help: "Apply to renew the licence. Fees Regulations No. 2 of 2024: the renewal fee is payable two months before expiry. Notify any material change made before the renewed licence is issued." },
  annual: { label: "Annual return (Schedule IV)", short: "Annual return (Schedule IV)", src: "Schedule IV", help: "The annual return in the regulations' format. If the Commission sends its own Annual Return form, use the Annual Returns section instead." },
  surrender: { label: "Notice of intention to surrender (Schedule VI)", short: "Surrender", src: "Schedule VI", help: "Give notice that the licence will be surrendered. Offshore companies also submit Form V (notice of intention to cease business)." },
};
const FILING_STATUS = ["Draft", "Ready for review", "Approved", "Submitted", "Acknowledged", "Closed"];
/* Schedule III items A-K with the rows the form provides (former, new, date of change, reason) */
const S3_ITEMS = [
  ["A", "Name of Authorised Person", 2, "name"], ["B", "Address within the Area of Authority of the Colombo Port City", 2, "pc_address"],
  ["C", "Address in the country of residency, citizenship, incorporation, registration or formation", 2, "home_address"], ["D", "Legal form", 1, "legal_form"],
  ["E", "Scope or description of business activities", 2, "activities"], ["F", "New shareholders / members / partners / founders, or exit of shareholders", 5, null, "For a new member, complete Part III and/or Part IV of the application form for them."],
  ["G", "Appointment or cessation of directors / key management", 4, null, "For a new member, complete Part V of the application form for them."],
  ["H", "Details of affiliates carrying on business in Sri Lanka (if any)", 1, null], ["I", "Change of authorised signatory or contact person", 1, "signatory"],
  ["J", "Change of details of the supervisory authority (if applicable)", 3, null], ["K", "Any other changes (including changes to be notified under the agreement with the Commission)", 2, null]];
function companyCurrent(key) {
  const c = Store.company() || {}, off = Store.list("offices").find(o => o.location === "Inside Colombo Port City" && o.status === "In use");
  return { name: c.name, pc_address: off ? off.address : "", home_address: c.register_address, legal_form: c.legal_form, activities: (Store.get("licences", c.main_licence_id) || {}).approved_activities || c.business_sector, signatory: [c.signatory_name, c.contact_name].filter(Boolean).join(" / ") }[key] || "";
}

