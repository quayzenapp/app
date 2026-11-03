/* ===== x_visa.js ===== */
/* Visas under the Commission's Standard Operating Procedure (SOP) - Visa Application Process for Colombo Port City, supplied 1 Nov 2026,
   and the "Request for the grant of landing endorsement / extension of resident visa" form.
   SOP route: register the AP with the Department of Immigration and Emigration (DIE) -> request a landing endorsement through the Commission
   -> Commission recommends to DIE -> pay DIE, landing endorsement issued -> arrive within 30 days -> apply for the resident visa within 30 days of arrival.
   Also: resignation and visa cancellation (leave within two weeks), monthly reporting, and general conditions. Tracking only: nothing is sent. */

const CPC_VISA_TYPES = ["Investor", "Business", "Employee", "Colombo Port City - Property Lessee"];
LOOKUPS.visa_statuses.splice(1, 0, "Landing endorsement - preparing request", "Landing endorsement - requested from the Commission", "Landing endorsement - recommended to DIE", "Landing endorsement - issued", "Arrived - resident visa to be applied for", "Resident visa - applied to DIE");
LOOKUPS.visa_statuses.push("Resigned - cancellation requested");
(() => {
  const d = REG.visas, add = (after, fs) => { const i = d.fields.findIndex(f => f.name === after); d.fields.splice(i + 1, 0, ...fs); };
  add("visa_category", [F("cpc_type", "CPC visa category (landing endorsement form)", "choice", { choices: CPC_VISA_TYPES, help: "Visa category on the Commission's request form." }), F("request_kind", "Request", "choice", { choices: ["Landing endorsement (to be converted to resident visa on arrival)", "Extension of resident visa"], dflt: "Landing endorsement (to be converted to resident visa on arrival)" }), F("designation", "Designation")]);
  add("passport_expiry", [F("date_of_birth", "Date of birth", "date", { sensitive: "id" }), F("gender", "Gender", "choice", { choices: ["Male", "Female"] }), F("mobile", "Mobile", "text", { sensitive: "personal" }), F("email", "Email", "text", { sensitive: "personal" }), F("domicile", "Country of domicile")]);
  d.fields.push(
    F("requested_until", "Requested duration of visa (until)", "date", { group: "Visa procedure (SOP)" }),
    F("pcc_date", "Police clearance certificate - date issued", "date", { group: "Visa procedure (SOP)", help: "Must be issued within the past three months by the country of domicile." }),
    F("pcc_auth", "Police clearance authenticated by an embassy, high commission or consulate?", "choice", { group: "Visa procedure (SOP)", choices: ["Yes", "No", "Not needed (Chinese national - Commission due diligence)"], help: "SOP Step 2(e)(ii). Chinese nationals follow a separate check of about 4-6 weeks." }),
    F("employment_history", "Countries of employment in the past three years, with visa reference (one per line: country - visa ref)", "textarea", { group: "Visa procedure (SOP)" }),
    F("le_request_date", "Landing endorsement requested from the Commission on", "date", { group: "Visa procedure (SOP)" }), F("le_request_no", "Request no. (on the form)", "text", { group: "Visa procedure (SOP)" }),
    F("le_issue_date", "Landing endorsement issued on", "date", { group: "Visa procedure (SOP)", help: "Arrive within 30 days of this date." }),
    F("arrival_date", "Arrival in Sri Lanka", "date", { group: "Visa procedure (SOP)", help: "Apply for the resident visa within 30 days." }), F("residence_address", "Residential address in Sri Lanka", "textarea", { group: "Visa procedure (SOP)", sensitive: "personal" }),
    F("rv_apply_date", "Resident visa applied for on", "date", { group: "Visa procedure (SOP)" }), F("medical_date", "Medical certificate (IOM MHAC) date", "date", { group: "Visa procedure (SOP)" }), F("insurance_until", "Medical insurance valid until", "date", { group: "Visa procedure (SOP)" }),
    F("rv_number", "Resident visa number", "text", { group: "Visa procedure (SOP)", sensitive: "id" }), F("epf_etf_no", "EPF / ETF registration no.", "text", { group: "Visa procedure (SOP)" }),
    F("resignation_date", "Resignation date", "date", { group: "Resignation and cancellation" }), F("departure_date", "Departure date", "date", { group: "Resignation and cancellation", help: "SOP: leave the country within two weeks of resignation." }),
    F("flight_no", "Departure flight", "text", { group: "Resignation and cancellation" }), F("cancel_notified", "Commission notified of resignation on", "date", { group: "Resignation and cancellation" }),
    F("dependents_json", "Dependents (stored as a table)", "text", { group: "hidden", readonly: true }));
  d.fmap = {}; d.fields.forEach(f => d.fmap[f.name] = f);
})();
const _groupsOf = groupsOf; groupsOf = def => _groupsOf(def).filter(([g]) => g !== "hidden");
LOOKUPS.visa_categories.unshift("Port City Colombo - Investor", "Port City Colombo - Business", "Port City Colombo - Employee", "Port City Colombo - Property Lessee");

/* SOP stages for one person */
const VISA_STEPS = [
  ["prep", "Prepare the request", v => !!v.le_request_date, "Passport bio-data page, employment contract, police clearance (within 3 months; authenticated unless Chinese national), request form, dependants' documents."],
  ["le", "Commission recommends to DIE", v => !!v.le_issue_date || /recommended|issued|Arrived|Resident|Approved/.test(v.application_status || ""), "The Commission sends its recommendation letter, the signed request form and the passport copy to DIE. The AP's own request letter to DIE is submitted at DIE."],
  ["issued", "Pay DIE; landing endorsement issued", v => !!v.le_issue_date, "DIE asks for payment, then issues the landing endorsement. Arrive within 30 days."],
  ["arrive", "Arrive in Sri Lanka", v => !!v.arrival_date, "Carry the company's arrival letter (name, designation, passport no., contact person, place of stay, job description)."],
  ["rv", "Apply for the resident visa", v => !!v.rv_apply_date, "Within 30 days of arrival: application form, passport copy, company letter, Commission recommendation, IOM medical certificate, medical insurance, police clearance."],
  ["done", "Resident visa issued", v => v.application_status === "Approved" || !!v.rv_number, "Pay the DIE visa fee. The planned stay must end at least two months before the passport expires."]];
function visaDeadlines(v) {
  const out = [], add = (t, d, done) => d && out.push({ t, d, done, days: daysUntil(d) });
  if (v.le_issue_date && !v.arrival_date) add("Arrive in Sri Lanka (30 days from the landing endorsement)", addDays(v.le_issue_date, 30));
  if (v.arrival_date && !v.rv_apply_date) add("Apply for the resident visa (30 days from arrival)", addDays(v.arrival_date, 30));
  if (v.pcc_date && !v.le_request_date) add("Police clearance stops being 'within three months'", addMonthsDay(v.pcc_date, 3));
  if (v.resignation_date && !v.departure_date) add("Leave Sri Lanka (two weeks from resignation)", addDays(v.resignation_date, 14));
  if (v.resignation_date && !v.cancel_notified) add("Notify the Commission of the resignation", v.resignation_date);
  if (v.requested_until && v.passport_expiry && Store.canSee("id") && addDays(v.requested_until, 60) > v.passport_expiry) out.push({ t: "Planned stay must end at least two months before the passport expires", d: v.passport_expiry, warn: true, days: daysUntil(v.passport_expiry) });
  return out;
}
const visaDeps = v => { try { return JSON.parse(v.dependents_json || "[]"); } catch (e) { return []; } };
EXTRAS.visas = v => {
  const w = Store.can("visas", "write"), deps = visaDeps(v), dl = visaDeadlines(v), cur = VISA_STEPS.findIndex(s => !s[2](v)), sp = Store.canSee("personal"), dis = w && sp ? "" : " disabled";
  return `<div class="card"><h3>Visa procedure (Commission SOP)</h3><ol class="stepper">${VISA_STEPS.map(([k, l, ok], i) => `<li class="${ok(v) ? "done" : i === cur ? "cur" : ""}" title="${esc(VISA_STEPS[i][3])}"><span>${ok(v) ? "✓" : i + 1}</span>${esc(l)}</li>`).join("")}</ol>
   ${cur >= 0 ? `<p class="small" style="margin-top:8px"><b>Next:</b> ${esc(VISA_STEPS[cur][3])}</p>` : ""}
   ${dl.length ? `<ul class="small tl">${dl.map(x => `<li><b>${esc(x.t)}</b>: ${fmtDate(x.d)} <span class="badge ${x.days < 0 ? "bad" : x.days <= 7 || x.warn ? "warn" : "info"}">${x.days < 0 ? -x.days + " days ago" : "in " + x.days + " days"}</span></li>`).join("")}</ul>` : ""}
   <div class="row">${fmtButtons("visa-gen", `data-id="${v.id}" data-k="le"`, ["pdf", "docx"], "pdf")}<span class="small muted">Landing endorsement request form</span></div>
   <div class="row">${fmtButtons("visa-gen", `data-id="${v.id}" data-k="arrival"`, ["docx", "pdf"], null)}<span class="small muted">Arrival letter for the employee (SOP Step 4 note)</span></div>
   ${v.resignation_date ? `<div class="row">${fmtButtons("visa-gen", `data-id="${v.id}" data-k="resign"`, ["docx", "pdf"], null)}<span class="small muted">Resignation notice to the Commission (SOP B)</span></div>` : ""}</div>
  <div class="card"><h3>Dependents (spouse and children under 18)</h3>${sp ? `<form class="f" data-form="visa-deps" data-id="${v.id}" novalidate><div class="tw"><table class="t small rowsin"><thead><tr><th>Full name</th><th>Passport no.</th><th>Date of birth</th><th>Nationality</th><th>Gender</th><th>Spouse / child</th><th>Visa until</th></tr></thead><tbody>
   ${Array.from({ length: 4 }, (_, i) => { const d = deps[i] || {}; return `<tr>${[["name", "text"], ["passport", "text"], ["dob", "date"], ["nationality", "text"], ["gender", ["", "Male", "Female"]], ["rel", ["", "Spouse", "Child"]], ["until", "date"]].map(([k, t]) => `<td>${Array.isArray(t) ? `<select name="d.${i}.${k}"${dis}>${t.map(o => `<option${o === (d[k] || "") ? " selected" : ""}>${o}</option>`).join("")}</select>` : `<input type="${t}" name="d.${i}.${k}" value="${esc(d[k] || "")}"${dis}>`}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div>
   ${w ? '<div class="row"><button class="btn sm p">Save dependents</button></div>' : ""}<p class="help">The form has four rows. Each dependent applies separately for the resident visa after arrival.</p></form>` : '<p class="muted small">Restricted for your role.</p>'}</div>`;
};
FORMS["visa-deps"] = async form => { const v = Store.get("visas", form.dataset.id), deps = []; for (let i = 0; i < 4; i++) { const d = {}; ["name", "passport", "dob", "nationality", "gender", "rel", "until"].forEach(k => { const x = form.querySelector(`[name="d.${i}.${k}"]`); if (x && x.value) d[k] = x.value; }); if (d.name) deps.push(d); } await Store.save("visas", { dependents_json: JSON.stringify(deps) }, v.id); await Store.audit("visas", v.id, "Updated", `Dependents: ${deps.length}`); toast("Saved."); render(); };

/* ---------- forms and letters ---------- */
function leValues(v) {
  const c = Store.company(), off = Store.list("offices").find(o => o.status === "In use") || Store.list("offices")[0], deps = visaDeps(v), d8 = ddmmyyyy, prop = v.cpc_type === "Colombo Port City - Property Lessee";
  const vals = { "Request No": v.le_request_no, Text_Fullname1: v.person_name, Text_Passport1: v.passport_number, Date_Passport1_af_date: d8(v.date_of_birth), Text_Nationality1: v.nationality, Text_Mobile1: v.mobile, Text_Email1: v.email, Date_Visa1_af_date: d8(v.requested_until) };
  if (!prop) Object.assign(vals, { Text_APName: c.name, Text_Address: off ? off.address : c.registered_address, Text_Mobile: c.contact_phone, Text_Email: c.contact_email });
  String(v.employment_history || "").split(/\n+/).filter(Boolean).slice(0, 3).forEach((l, i) => { const [ct, ref] = l.split(/\s+-\s+/); vals[`Text_Country${i + 1}`] = (ct || "").trim(); vals[`Text_Visa${i + 1}`] = (ref || "").trim(); });
  deps.slice(0, 4).forEach((d, i) => { const n = i + 2; Object.assign(vals, { [`Text_Fullname${n}`]: d.name, [`Text_Passport${n}`]: d.passport, [`Date_Passport${n}_af_date`]: d8(d.dob), [`Text_Nationality${n}`]: d.nationality, [`Date_Visa${n}_af_date`]: d8(d.until) }); });
  const selects = { Dropdown_Gender1: v.gender }; deps.slice(0, 4).forEach((d, i) => { selects[`Dropdown_Gender${i + 2}`] = d.gender; selects[`Dropdown_SC${i + 2}`] = d.rel; });
  const checks = { [/Extension/.test(v.request_kind || "") ? "REQUEST FOR EXTENSION OF RESIDENT VISA" : "REQUEST FOR THE GRANT OF LANDING ENDORSEMENT  RESIDENT VISA"]: true, [{ Investor: "Investor", Business: "Business", Employee: "Employee", "Colombo Port City - Property Lessee": "Colombo Port City  Property Lessee" }[v.cpc_type] || ""]: !!v.cpc_type };
  delete checks[""];
  return { vals, selects, checks, prop, deps };
}
async function buildLe(v, f) {
  if (!Store.canSee("personal") || !Store.canSee("id")) throw ["The request form needs names and passport details, which your role cannot see."];
  const L = leValues(v), name = `Landing_endorsement_request_${fileSafe(v.person_name)}`;
  if (f === "pdf") { const r = await fillPdfForm("le", L.vals, L.checks, { selects: L.selects, never: ["Date_Commission_af_date"] }); return [{ name: name + ".pdf", blob: new Blob([r.bytes], { type: "application/pdf" }), check: r, notes: ["The 'For Official Use Only' part repeats the names automatically, as the form is designed; the Commission signs and stamps it.", "Tick the supporting documents on page 2 when you attach them.", ...(L.prop ? ["Section 01 is left blank: it does not apply to Property Lessee visas."] : [])] }]; }
  const m = { title: "Colombo Port City Visa Recommendation - Request for the grant of landing endorsement / extension of resident visa", subtitle: v.person_name, note: COPY_NOTE("visa recommendation request form"),
    blocks: [{ h: "Request" }, { kv: [["Request", v.request_kind || ""], ["Request no.", v.le_request_no || ""]] }, ...(L.prop ? [] : [{ h: "01. Details of the Authorised Person" }, { kv: [["Name", L.vals.Text_APName], ["Address (Port City / designated location)", L.vals.Text_Address], ["Mobile", L.vals.Text_Mobile], ["Email", L.vals.Text_Email]] }]),
      { h: "02. Main applicant" }, { kv: [["Visa category", v.cpc_type || ""], ["Requested duration (until)", ddmmyyyy(v.requested_until)], ["Full name", v.person_name], ["Passport no.", v.passport_number], ["Date of birth", ddmmyyyy(v.date_of_birth)], ["Nationality", v.nationality], ["Gender", v.gender], ["Mobile", v.mobile], ["Email", v.email]] },
      { h: "Countries of employment in the past three years" }, { p: v.employment_history || "-" }, { h: "Dependents" }, { table: { cols: ["Full name", "Passport no.", "Date of birth", "Nationality", "Gender", "Spouse / child", "Until"], rows: L.deps.map(d => [d.name, d.passport, ddmmyyyy(d.dob), d.nationality, d.gender, d.rel, ddmmyyyy(d.until)]) } },
      { h: "Supporting documents" }, { list: ["Copy of the bio-data page of the passport (applicant and dependents)", "Police clearance certificate (applicant and dependents)", "Spouse: marriage certificate or affidavit", "Children: birth certificate or affidavit", "Dependents: affidavit where applicable", "Employment contract (employee visa)", "Leaseholder agreement (property lessee visa)"] }] };
  return modelsToFiles([{ name, model: m }], f);
}
function visaLetterModel(v, kind) {
  const c = Store.company(), sig = [c.signatory_name || "[Authorised signatory]", c.signatory_designation || "", c.name];
  if (kind === "arrival") return { title: "", footer: "Arrival letter", blocks: [{ p: "[On company letterhead]" }, { p: `Date: ${fmtDate(today())}` }, { h: "To whom it may concern - arrival in Sri Lanka under a landing endorsement" },
    { p: `This is to confirm that the person named below is employed by ${c.name}, an Authorised Person of the Colombo Port City Economic Commission, and is arriving in Sri Lanka under a landing endorsement, to apply for a Colombo Port City resident visa within 30 days of arrival.` },
    { kv: [["Full name", v.person_name], ["Designation", v.designation || v.role || ""], ["Passport number", Store.canSee("id") ? v.passport_number : "[passport number]"], ["Company representative to contact on arrival", `${c.contact_name || "[name]"}, ${c.contact_phone || "[phone]"} (languages: [languages the employee is familiar with])`], ["Residential address or place of stay", v.residence_address || "[address]"], ["Job description and responsibilities (as in the employment contract)", "[job description]"]] },
    { p: "Yours faithfully," }, { p: sig.join("\n") }] };
  return { title: "", footer: "Notice of resignation", blocks: [{ p: "[On company letterhead]" }, { p: `Date: ${fmtDate(today())}` }, { p: "The Director-General\nColombo Port City Economic Commission" }, { h: `Resignation of an employee holding a Colombo Port City visa - ${c.name}` },
    { p: "In line with the Commission's visa procedure, we notify you that the employee below has resigned. Please request the Department of Immigration and Emigration to cancel the visa." },
    { kv: [["Employee name", v.person_name], ["Passport number", Store.canSee("id") ? v.passport_number : "[passport number]"], ["Designation", v.designation || v.role || ""], ["Date of resignation", fmtDate(v.resignation_date)], ["Date of departure and flight", `${fmtDate(v.departure_date) || "[date]"} ${v.flight_no || "[flight]"}`]] },
    { p: "Attached: copy of the passport bio-data page and the resident visa stamp." }, { p: "Yours faithfully," }, { p: sig.join("\n") }] };
}
ACTIONS["visa-gen"] = el => { const v = Store.get("visas", el.dataset.id), k = el.dataset.k, f = el.dataset.f;
  return runAndSave({ le: "the request form", arrival: "the arrival letter", resign: "the resignation notice" }[k], () => k === "le" ? buildLe(v, f) : modelsToFiles([{ name: `${k === "arrival" ? "Arrival_letter" : "Resignation_notice"}_${fileSafe(v.person_name)}`, model: visaLetterModel(v, k) }], f), files => Store.audit("visas", v.id, "Forms prepared", files.map(x => x.name).join(", "))); };

/* Company request letter listing several applicants (SOP Step 2(a)) and the monthly report (SOP C1) */
function visaBatchModel(list) {
  const c = Store.company(), id = Store.canSee("id");
  return { title: "", footer: "Landing endorsement request letter", blocks: [{ p: "[On company letterhead]" }, { p: `Date: ${fmtDate(today())}` }, { p: "The Director-General\nColombo Port City Economic Commission" }, { h: `Request for landing endorsements - ${c.name}${c.licence_number ? " (Licence " + c.licence_number + ")" : ""}` },
    { p: "We request the Commission to recommend landing endorsements, to be converted to Colombo Port City resident visas on arrival, for the applicants below. Their passport copies, employment contracts, completed request forms and police clearance certificates are attached." },
    { table: { cols: ["Name", "Passport no.", "Designation", "Visa category", "Requested duration (until)"], rows: list.map(v => [v.person_name, id ? v.passport_number : "[restricted]", v.designation || v.role || "", v.cpc_type || v.visa_category || "", ddmmyyyy(v.requested_until)]) } },
    { p: "Yours faithfully," }, { p: [c.signatory_name || "[Authorised signatory]", c.signatory_designation || "", c.name].join("\n") }] };
}
function visaMonthlyModel(month) {
  const vs = Store.list("visas").filter(v => !v.archived), id = Store.canSee("id"), pe = Store.canSee("personal");
  return { title: `Monthly visa report - ${Store.company().name}`, subtitle: `Month: ${month}. Columns follow the Commission's template in the visa SOP (section C1).`, sheet: "Visa report", note: "Check the figures against your records before sending. Use the Commission's Excel template if it has sent you one.",
    blocks: [{ table: { cols: ["No", "Request letter reference", "Name", "Passport no.", "Passport expiry", "Nationality", "Designation", "Visa type", "Duration requested", "Security clearance - domicile country", "Security clearance submitted", "LE request date", "LE approved date", "Arrival date", "Resident visa no.", "Resident visa duration", "Resident visa status", "Residential address", "EPF/ETF registration", "Resignation date", "Departure date", "Flight no."],
      rows: vs.map((v, i) => [i + 1, v.le_request_no || "", pe ? v.person_name : "[restricted]", id ? v.passport_number || "" : "[restricted]", id ? ddmmyyyy(v.passport_expiry) : "", v.nationality || "", v.designation || v.role || "", v.cpc_type || v.visa_category || "", v.requested_until ? "Till " + ddmmyyyy(v.requested_until) : "", v.domicile || "", ddmmyyyy(v.pcc_date), ddmmyyyy(v.le_request_date), ddmmyyyy(v.le_issue_date), ddmmyyyy(v.arrival_date), id ? v.rv_number || "" : "", v.expiry_date ? "Till " + ddmmyyyy(v.expiry_date) : "", ["Cancelled", "Expired"].includes(v.application_status) || v.resignation_date ? "Cancelled" : v.rv_number || v.application_status === "Approved" ? "Active" : v.application_status || "", pe ? v.residence_address || "" : "", v.epf_etf_no || "", ddmmyyyy(v.resignation_date), ddmmyyyy(v.departure_date), v.flight_no || ""]) } }] };
}
function visaSopCard() {
  const vs = Store.list("visas"), open = vs.filter(v => !v.archived && VISA_STEPS.findIndex(s => !s[2](v)) >= 0 && !v.resignation_date), dl = vs.flatMap(v => visaDeadlines(v).map(x => Object.assign({ v }, x))).filter(x => x.days <= 30).sort((a, b) => a.days - b.days);
  const by = VISA_STEPS.map(([k, l], i) => ({ label: l, value: vs.filter(v => !v.resignation_date && VISA_STEPS.findIndex(s => !s[2](v)) === i).length }));
  return `<div class="card"><h3>Visa procedure (Commission SOP)</h3>${visaFlow()}
   <div class="vgrid">${vizCard("People at each step", hbars(by, fmtNum, "No visa records yet.", { keepZero: true }))}${vizCard("Deadlines in the next 30 days", dl.length ? `<ul class="small tl">${dl.slice(0, 8).map(x => `<li><a href="#" data-act="open" data-type="visas" data-id="${x.v.id}">${esc(Store.canSee("personal") ? x.v.person_name : "Visa record")}</a>: ${esc(x.t)} - ${fmtDate(x.d)}</li>`).join("")}</ul>` : '<p class="small muted">Nothing due.</p>')}</div>
   <div class="row"><span class="small"><b>Request letter for several applicants</b> (SOP Step 2(a)):</span>${fmtButtons("visa-batch", "", ["docx", "pdf"], null)}<span class="small muted">${open.length} person(s) not yet through the procedure</span></div>
   <div class="row"><span class="small"><b>Monthly report</b> (SOP C1):</span><input type="month" id="vmonth" value="${today().slice(0, 7)}" aria-label="Month">${fmtButtons("visa-month", "", ["xlsx", "pdf", "docx"], null)}</div>
   <p class="small"><a href="#" data-act="nav" data-section="checklists">Checklists</a> has the SOP's one-off and recurring duties: registering the AP with DIE, monthly reporting, EPF/ETF and quarterly tax receipts, police notification, interpreter arrangements and the cyber-abuse audit.</p></div>`;
}
ACTIONS["visa-batch"] = el => { const list = Store.list("visas").filter(v => !v.archived && !v.le_issue_date && !v.resignation_date); if (!list.length) return toast("Nobody is waiting for a landing endorsement.", "info"); return runAndSave("the request letter", () => modelsToFiles([{ name: "Landing_endorsement_request_letter", model: visaBatchModel(list) }], el.dataset.f)); };
ACTIONS["visa-month"] = el => { const m = (document.getElementById("vmonth") || {}).value || today().slice(0, 7); return runAndSave("the monthly report", () => modelsToFiles([{ name: `Monthly_visa_report_${m}`, model: visaMonthlyModel(m) }], el.dataset.f), files => Store.audit("visas", null, "Exported", `Monthly visa report ${m}`)); };
const _visasOverview = visasOverview;
visasOverview = function () { return _visasOverview().replace(hlFor("visas"), hlFor("visas") + visaSopCard()); };
function visaFlow() {
  const S = [["AP registered with DIE", "Articles, certificate of incorporation, AP licence, offshore registration, Form 20 / Form 1, Commission's recommendation letter", "You"], ["Request through the Commission", "Request letter, passport copies, contracts, request form, police clearance (within 3 months)", "You"], ["Commission recommends to DIE", "Recommendation letter and the signed request form", "Commission"], ["DIE payment; landing endorsement", "Arrive within 30 days", "DIE"], ["Resident visa within 30 days of arrival", "IOM medical, insurance, police clearance, Commission letter", "You"], ["Monthly report and cancellations", "Report by month end; notify resignations; leave within two weeks", "You"]];
  return `<div class="route compact">${S.map(([t, d, who], i) => `<div class="rstep ${who === "You" ? "you" : "them"}"><div class="rh"><span class="rn">${i + 1}</span><b>${esc(t)}</b><span class="chip">${esc(who)}</span></div><div class="small">${esc(d)}</div></div>`).join("")}</div>`;
}
/* Reminders from the SOP deadlines */
const _cr2 = collectReminders;
collectReminders = function () {
  const out = _cr2(); if (!Store.can("visas") || !canSection("visas")) return out;
  const who = v => Store.canSee("personal") ? v.person_name : (v.role || "Visa record");
  Store.list("visas").filter(v => !v.archived).forEach(v => visaDeadlines(v).filter(x => !x.warn && x.days <= 14).forEach(x => { out.push({ kind: "Visa procedure", title: `${who(v)}: ${x.t}`, due: x.d, days: x.days, nav: { kind: "record", type: "visas", id: v.id }, detail: "" }); }));
  return out.sort((a, b) => a.days - b.days);
};

