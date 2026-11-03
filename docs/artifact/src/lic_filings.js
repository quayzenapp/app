/* ===== lic_filings.js ===== */
/* Licence filings after the licence is issued: Schedule III (+ offshore Form III), Schedule IV, Schedule V, Schedule VI (+ offshore Form V).
   Each filing goes Draft -> Ready for review -> Approved (second person, fixed copy kept) -> Submitted (recorded by the user) -> Acknowledged / Closed. */

const isOffshore = () => { const c = Store.company() || {}; return /offshore/i.test(c.legal_form || "") || Store.list("apps").some(a => a.status === APP_STATUS.issued && a.legal === "Company" && a.origin === "Foreign"); };
const mainLic = () => { const c = Store.company() || {}; return Store.get("licences", c.main_licence_id) || null; };
const pcAddress = () => { const o = Store.list("offices").find(x => x.location === "Inside Colombo Port City" && x.status === "In use"); return o ? o.address : ""; };

/* [key, label, type, pdf field(s), opts]; opts.sug(filing) proposes a value from the records */
const S4_SPEC = [
  ["licence_no", "Licence number", "text", "Text1", { ref: "1(a)", sug: () => (mainLic() || {}).number || Store.company().licence_number }],
  ["name", "Name of Authorised Person", "text", "Text2", { ref: "1(b)", sug: () => Store.company().name }],
  ["address", "Address of Authorised Person", "area", "Text3", { ref: "1(c)", sug: () => pcAddress() || Store.company().registered_address || Store.company().register_address }],
  ["signatory", "Authorised signatory", "text", "Text5", { ref: "1(d)", sug: () => Store.company().signatory_name }],
  ["contact", "Contact person", "text", "Text6", { ref: "1(d)", sug: () => Store.company().contact_name }],
  ["office_space", "Office space acquired in the Area of Authority (state the unit, e.g. 300 sqm)", "text", "Text20", { ref: "2(b)" }],
  ["fdi.currency", "FDI - currency", "text", "Text21", { ref: "2(c)" }], ["fdi.quantum", "FDI - amount as at the date of this return", "num", "Text22", { ref: "2(c)" }], ["fdi.mode", "FDI - mode of funding", "choice", "Text23", { ref: "2(c)", ch: FUND_MODES }], ["fdi.source", "FDI - source", "text", "Text24", { ref: "2(c)" }],
  ["lkr.currency", "Other investments - currency", "text", "Text25", { ref: "2(d)", dflt: "LKR" }], ["lkr.quantum", "Other investments - amount as at the date of this return", "num", "Text26", { ref: "2(d)" }], ["lkr.mode", "Other investments - mode of funding", "choice", "Text33", { ref: "2(d)", ch: FUND_MODES }], ["lkr.source", "Other investments - source", "text", "Text34", { ref: "2(d)" }],
  ["signer", "Full name of director or authorised signatory", "text", "Text27", { ref: "Confirmation", sug: () => Store.company().signatory_name }],
];
const S4_MP = [["a", "a) Managerial & Professional", 7, 11, 15, 29], ["b", "b) Technical & Supervisory", 8, 12, 16, 30], ["c", "c) Operation workers (skilled and unskilled)", 9, 13, 17, 31], ["d", "d) Clerical & General workers", 10, 14, 18, 32]];
const S5_SPEC = [
  ["who", "Applicant is a company (We / us) or an individual (I / me)", "choice", null, { ch: ["Company (We, us)", "Individual (I, me)"], dflt: "Company (We, us)" }],
  ["name", "Name of applicant", "text", "Text497", { sug: () => Store.company().name }],
  ["address", "Address of applicant", "text", "Text498", { sug: () => oneLine(pcAddress() || Store.company().registered_address || Store.company().register_address) }],
  ["licence_no", "Current licence number", "text", "Text499", { sug: () => (mainLic() || {}).number || Store.company().licence_number }],
  ["licence_date", "Date of issue of the current licence", "date", "Text500", { sug: () => (mainLic() || {}).issue_date }],
  ["variant", "Confirmation (a): which sentence applies", "choice", null, { ch: ["The latest annual return remains true and accurate", "The latest annual return, as amended by a notice of change, remains true and accurate"], help: "Schedule V, footnote 1: select the applicable sentence." }],
  ["ar_date", "Date of the latest annual return", "date", null, { sug: () => { const r = Store.list("returns").filter(x => x.submitted_at).sort((p, q) => q.submitted_at.localeCompare(p.submitted_at))[0]; const f = Store.list("filings").filter(x => x.kind === "annual" && x.submitted_date).sort((p, q) => q.submitted_date.localeCompare(p.submitted_date))[0]; return [r && r.submitted_at, f && f.submitted_date].filter(Boolean).sort().pop(); } }],
  ["notice_date", "Date of the notice of change (if the second sentence applies)", "date", null, { sug: () => { const f = Store.list("filings").filter(x => x.kind === "change" && x.submitted_date).sort((p, q) => q.submitted_date.localeCompare(p.submitted_date))[0]; return f && f.submitted_date; } }],
  ["letter_date", "Date of the letter (leave blank to date it when signing)", "date", "Text495", { need: false }],
];
const S6_SPEC = [
  ["applicant", "Name of applicant", "text", "Text507", { sug: () => Store.company().signatory_name }],
  ["ap_name", "Name of Authorised Person", "text", "Text508", { sug: () => Store.company().name }],
  ["relationship", "Relationship of applicant to the Authorised Person", "text", "Text509", { sug: () => Store.company().signatory_designation }],
  ["licence_no", "Number of the licence", "text", "Text510", { sug: () => (mainLic() || {}).number || Store.company().licence_number }],
  ["issue_date", "Date of issue of the licence", "date", "Text511", { sug: () => (mainLic() || {}).issue_date }],
  ["expiry_date", "Date of expiry of the licence", "date", "Text512", { sug: () => (mainLic() || {}).expiry_date }],
  ["reason", "Reason for surrender", "area", ["Text513", "Text514", "Text515", "Text516"]],
];
const O5_SPEC = [
  ["reg_no", "Company registration number", "text", "Text1", { sug: () => Store.company().registration_no }], ["name", "Company name", "text", "Text2", { sug: () => Store.company().name }],
  ["country", "Country of incorporation", "text", "Text3", { sug: () => Store.company().country_of_incorporation }], ["cease_date", "Date of ceasing to carry on business", "date", { dmy: ["Text4", "Text5", "Text6"] }],
  ["director", "Name of director / authorised representative", "text", "Text7", { sug: () => Store.company().signatory_name }],
  ["sb.name", "Submitted by - name", "text", "Text9", { sug: () => Store.company().contact_name }], ["sb.designation", "Submitted by - designation", "text", "Text10"], ["sb.address", "Submitted by - address", "area", ["Text11", "Text12"]],
  ["sb.email", "Submitted by - email", "text", "Text13", { sug: () => Store.company().contact_email }], ["sb.tel", "Submitted by - telephone", "text", "Text14", { sug: () => Store.company().contact_phone }], ["sb.mobile", "Submitted by - mobile", "text", "Text15"],
];
const O3_SPEC = [
  ["ref", "CPCEC reference number", "text", "Text1", { sec: "Company" }], ["name", "Company name", "text", "Text2", { sec: "Company", sug: () => Store.company().name }],
  ["const_date", "02. Date of change to the charter, statute, memorandum or articles", "date", { dmy: ["Text3", "Text4", "Text5"] }, { sec: "02. Constitution", help: "Annex the altered document, with an English translation if needed." }],
  ["dir_a", "03(a) Change of director and/or particulars of directors", "check", { check: "Check Box4" }, { sec: "03. Directors and management officers" }], ["dir_b", "03(b) Change of other management officers and/or their particulars", "check", { check: "Check Box5" }, { sec: "03. Directors and management officers" }],
  ["cease.name", "Ceasing to hold office - full name", "text", "Text6", { sec: "03. Ceasing to hold office" }], ["cease.designation", "Designation", "text", "Text7", { sec: "03. Ceasing to hold office" }], ["cease.passport", "Passport no. (with country of issue)", "text", "Text8", { sec: "03. Ceasing to hold office" }], ["cease.nic", "NIC no. (Sri Lankans)", "text", "Text9", { sec: "03. Ceasing to hold office" }], ["cease.address", "Address", "area", ["Text10", "Text11"], { sec: "03. Ceasing to hold office" }], ["cease.date", "Date of ceasing to hold office", "date", "Text12", { sec: "03. Ceasing to hold office" }], ["cease.reason", "Reason", "area", ["Text13", "Text14"], { sec: "03. Ceasing to hold office" }],
  ["appoint.name", "New director or officer - full name", "text", "Text15", { sec: "03. Appointment" }], ["appoint.designation", "Designation", "text", "Text16", { sec: "03. Appointment" }], ["appoint.passport", "Passport no. (with country of issue)", "text", "Text17", { sec: "03. Appointment" }], ["appoint.nic", "NIC no. (Sri Lankans)", "text", "Text18", { sec: "03. Appointment" }], ["appoint.address", "Address", "area", ["Text19", "Text20"], { sec: "03. Appointment" }], ["appoint.office", "Office held in the company", "text", "Text21", { sec: "03. Appointment" }], ["appoint.date", "Date of appointment", "date", "Text22", { sec: "03. Appointment" }],
  ["dchg.new_name", "New name", "text", "Text23", { sec: "03. Change of particulars of an existing director or officer" }], ["dchg.former_name", "Former name", "text", "Text24", { sec: "03. Change of particulars of an existing director or officer" }], ["dchg.new_id", "New passport / NIC", "text", "Text25", { sec: "03. Change of particulars of an existing director or officer" }], ["dchg.new_address", "New address", "area", ["Text26", "Text27"], { sec: "03. Change of particulars of an existing director or officer" }], ["dchg.former_address", "Former address", "area", ["Text28", "Text29"], { sec: "03. Change of particulars of an existing director or officer" }], ["dchg.new_designation", "New designation", "text", "Text30", { sec: "03. Change of particulars of an existing director or officer" }], ["dchg.former_designation", "Former designation", "text", "Text31", { sec: "03. Change of particulars of an existing director or officer" }], ["dchg.date", "Date of change", "date", { dmy: ["Text32", "Text33", "Text34"] }, { sec: "03. Change of particulars of an existing director or officer" }],
  ["ar_a", "04(a) Change of authorised representative", "check", { check: "Check Box35" }, { sec: "04. Authorised representative in Sri Lanka" }], ["ar_b", "04(b) Change of particulars of authorised representative", "check", { check: "Check Box36" }, { sec: "04. Authorised representative in Sri Lanka" }],
  ["arc.name", "Representative ceasing - full name", "text", "Text37", { sec: "04. Representative ceasing" }], ["arc.designation", "Designation", "text", "Text38", { sec: "04. Representative ceasing" }], ["arc.passport", "Passport no. (with country of issue)", "text", "Text39", { sec: "04. Representative ceasing" }], ["arc.nic", "NIC no.", "text", "Text40", { sec: "04. Representative ceasing" }], ["arc.address", "Address", "area", ["Text41", "Text42"], { sec: "04. Representative ceasing" }], ["arc.date", "Date of ceasing (the form asks for DD/MM/YY)", "date", "Text43", { sec: "04. Representative ceasing" }], ["arc.reason", "Reason", "text", "Text44", { sec: "04. Representative ceasing" }],
  ["ara.name", "New representative - full name", "text", "Text46", { sec: "04. New representative" }], ["ara.passport", "Passport no. (with country of issue)", "text", "Text47", { sec: "04. New representative" }], ["ara.nic", "NIC no.", "text", "Text48", { sec: "04. New representative" }], ["ara.address", "Address", "area", ["Text49", "Text50"], { sec: "04. New representative" }], ["ara.occupation", "Occupation", "text", "Text51", { sec: "04. New representative" }], ["ara.date", "Date of appointment", "date", "Text52", { sec: "04. New representative" }],
  ["archg.new_name", "New name", "text", "Text53", { sec: "04. Change of particulars of the representative" }], ["archg.former_name", "Former name", "text", "Text54", { sec: "04. Change of particulars of the representative" }], ["archg.new_id", "New passport / NIC", "text", "Text55", { sec: "04. Change of particulars of the representative" }], ["archg.new_address", "New address", "area", ["Text56", "Text57"], { sec: "04. Change of particulars of the representative" }], ["archg.former_address", "Former address", "area", ["Text58", "Text59"], { sec: "04. Change of particulars of the representative" }], ["archg.new_designation", "New designation", "text", "Text60", { sec: "04. Change of particulars of the representative" }], ["archg.former_designation", "Former designation", "text", "Text61", { sec: "04. Change of particulars of the representative" }], ["archg.date", "Date of change", "date", { dmy: ["Text62", "Text63", "Text64"] }, { sec: "04. Change of particulars of the representative" }],
  ["reg.prev", "05. Previous address of registered / principal office", "area", ["Text65", "Text66"], { sec: "05. Registered office in the country of incorporation" }], ["reg.new", "New address", "area", ["Text67", "Text68"], { sec: "05. Registered office in the country of incorporation" }], ["reg.date", "Date of change", "date", { dmy: ["Text69", "Text70", "Text71"] }, { sec: "05. Registered office in the country of incorporation" }],
  ["pc.prev", "06. Previous address of the office in Port City", "area", ["Text72", "Text73"], { sec: "06. Office in the Area of Authority" }], ["pc.new", "New address", "area", ["Text74", "Text75"], { sec: "06. Office in the Area of Authority" }], ["pc.date", "Date of change", "date", { dmy: ["Text76", "Text78", "Text77"] }, { sec: "06. Office in the Area of Authority" }],
  ["reg6_date", "07. Date of change of matters in regulation 6", "date", { dmy: ["Text79", "Text81", "Text80"] }, { sec: "07. Other matters (regulation 6)" }],
  ["signer", "Full name of director or authorised representative", "text", "Text82", { sec: "Signature block", sug: () => Store.company().signatory_name }],
  ["sb.name", "Submitted by - name", "text", "Text85", { sec: "Submitted by", sug: () => Store.company().contact_name }], ["sb.designation", "Designation", "text", "Text86", { sec: "Submitted by" }], ["sb.address", "Address", "area", ["Text87", "Text88"], { sec: "Submitted by" }], ["sb.email", "Email", "text", "Text89", { sec: "Submitted by", sug: () => Store.company().contact_email }], ["sb.tel", "Telephone", "text", "Text90", { sec: "Submitted by", sug: () => Store.company().contact_phone }], ["sb.mobile", "Mobile", "text", "Text91", { sec: "Submitted by" }],
];
const S3_MAP = { A: [[375, 376, 377, 378], [396, 397, null, 398]], B: [[379, 380, 381, 382], [401, 400, null, 399]], C: [[383, 384, 385, 386], [402, 403, null, 404]], D: [[387, 388, 389, 390]], E: [[391, 392, 393, 394], [405, 406, null, 407]],
  F: [[408, 413, 418, 423], [409, 414, 419, 424], [410, 415, 420, 425], [411, 416, 421, 426], [412, 417, 422, 427]], G: [[443, 428, 429, 430], [431, 432, 433, 434], [435, 436, 437, 438], [439, 440, 441, 442]],
  H: [[444, 445, 446, 447]], I: [[448, 449, 450, 451]], J: [[452, 453, 454, 455], [456, 457, 458, 459], [460, 461, 462, 463]], K: [[464, 465, 466, 467], [468, 469, 470, 471]] };
/* Items A-E use two lines of boxes for one change; the others have one line per change */
const S3_CAP = k => ["A", "B", "C", "E"].includes(k) ? 1 : S3_MAP[k].length;

/* ======================= PAGE ======================= */
PAGES.changes = () => {
  const fs = Store.list("filings").sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")), w = canLic(), lic = mainLic();
  const open = fs.filter(f => !["Submitted", "Acknowledged", "Closed"].includes(f.status));
  const due = open.filter(f => f.due_date && daysUntil(f.due_date) <= 30);
  const kinds = Object.entries(FILING_KINDS).map(([k, d]) => `<button class="tile card" data-act="filing-new" data-kind="${k}"${w ? "" : " disabled"}><b>${esc(d.label)}</b><span class="small muted">${esc(d.help)}</span></button>`).join("");
  return ovHead("Licence changes", "Notices and applications to the Commission after the licence is issued: changes to your particulars, renewal, the Schedule IV annual return and surrender. Each is prepared on the Commission's own form.")
  + hlCards([{ value: lic ? esc(lic.number || "Recorded") : "Not set", label: "Main licence", sub: lic && lic.expiry_date ? `expires ${fmtDate(lic.expiry_date)}` : "", kind: lic && lic.expiry_date && daysUntil(lic.expiry_date) <= 90 ? "warn" : "" },
    { value: open.length, label: "Filings in progress" }, { value: due.length, label: "Due within 30 days", kind: due.length ? "warn" : "" }, { value: fs.filter(f => f.status === "Submitted").length, label: "Submitted, awaiting acknowledgement" }])
  + (lic && lic.expiry_date && daysUntil(lic.expiry_date) <= 90 && !fs.some(f => f.kind === "renewal" && f.status !== "Closed") ? `<div class="banner warn">The licence expires on ${fmtDate(lic.expiry_date)}. The renewal fee is payable two months before expiry (Fees Regulations No. 2 of 2024). ${w ? '<button class="link" data-act="filing-new" data-kind="renewal">Start the renewal application</button>' : ""}</div>` : "")
  + `${w ? `<h3>Start a filing</h3><div class="ogrid">${kinds}</div>` : ""}
  <div class="card"><h3>Filings</h3><div class="tw"><table class="t"><thead><tr><th>Filing</th><th>Type</th><th>Status</th><th>Due</th><th>Submitted</th></tr></thead><tbody>
  ${fs.map(f => `<tr><td><a href="#" data-act="filing-open" data-id="${f.id}">${esc(f.title)}</a></td><td>${esc(FILING_KINDS[f.kind].short)}</td><td>${badge(f.status)}</td><td>${f.due_date ? fmtDate(f.due_date) + (daysUntil(f.due_date) < 0 && !["Submitted", "Acknowledged", "Closed"].includes(f.status) ? ' <span class="badge bad">overdue</span>' : "") : ""}</td><td>${fmtDate(f.submitted_date)}</td></tr>`).join("") || '<tr><td colspan="5" class="empty">No filings yet.</td></tr>'}</tbody></table></div></div>
  <p class="small muted">Offshore companies: the change notice also prepares Form III, and the surrender notice prepares Form V. ${isOffshore() ? "This company looks like an offshore company (from its legal form or application)." : "Turn these on inside each filing if they apply."}</p>`;
};
ACTIONS["filing-new"] = async el => {
  const kind = el.dataset.kind, d = FILING_KINDS[kind], c = Store.company(), data = {};
  const seed = (spec, base) => spec.forEach(([k, , , , o = {}]) => { const v = o.sug ? o.sug() : o.dflt; if (filled(v)) setPath(base, k, v); });
  if (kind === "renewal") seed(S5_SPEC, data); if (kind === "annual") { seed(S4_SPEC, data); data.as_at = today(); } if (kind === "surrender") { seed(S6_SPEC, data); data.o5 = {}; seed(O5_SPEC, data.o5); }
  if (kind === "change") { data.items = []; data.o3 = {}; seed(O3_SPEC, data.o3); }
  const lic = mainLic(), title = kind === "renewal" ? `Renewal of licence ${lic && lic.number ? lic.number : ""}`.trim() : kind === "annual" ? `Annual return (Schedule IV) ${today().slice(0, 4)}` : kind === "surrender" ? "Notice of intention to surrender the licence" : `Notice of change ${fmtDate(today())}`;
  const due = kind === "renewal" && lic && lic.expiry_date ? addDays(lic.expiry_date, -60) : null;
  const id = await Store.save("filings", { kind, title, status: "Draft", data, offshore: isOffshore(), due_date: due, events: [{ at: nowIso(), by: Store.uid, status: "Draft", note: "Started" }] });
  await Store.audit("filings", id, "Created", `${d.label} started`); go({ kind: "filing", id }); toast("Started. Values from your records are filled in as suggestions - check each one.");
};
ACTIONS["filing-open"] = el => go({ kind: "filing", id: el.dataset.id });

/* ======================= FILING VIEW ======================= */
const filingLocked = f => ["Submitted", "Acknowledged", "Closed"].includes(f.status);
VIEWS.filing = ({ id }) => {
  const f = Store.get("filings", id); if (!f) return '<div class="card empty">Not found. <button class="link" data-act="back">Back</button></div>';
  const d = FILING_KINDS[f.kind], locked = !canLic() || filingLocked(f), body = { change: filingChange, renewal: filingRenewal, annual: filingAnnual, surrender: filingSurrender }[f.kind](f, locked);
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Licence changes</button><h1>${esc(f.title)}</h1><div class="row">${badge(f.status)}<span class="small muted">${esc(d.label)}</span>${f.due_date ? `<span class="small">Due ${fmtDate(f.due_date)}</span>` : ""}</div></div>
   <div class="acts">${filingActions(f)}</div></div>
   <p class="note small">${esc(d.help)}</p>${body}
   <div class="card"><h3>Status and history</h3><ul class="tl">${(f.events || []).slice().reverse().map(e => `<li><b>${esc(e.status)}</b> <span class="muted small">${esc(e.at)} · ${esc(Store.name(e.by))}</span>${e.note ? `<div class="small">${esc(e.note)}</div>` : ""}</li>`).join("")}</ul>${historyHTML(Store.history("filings", f.id))}</div>`;
};
function filingActions(f) {
  if (!canLic()) return "";
  const b = (to, l, cls = "") => `<button class="btn ${cls}" data-act="filing-status" data-id="${f.id}" data-to="${to}">${esc(l)}</button>`;
  const dl = fmtButtons("filing-gen", `data-id="${f.id}"`, ["pdf", "docx"], "pdf");
  switch (f.status) {
    case "Draft": return dl + b("Ready for review", "Mark ready for review", "p");
    case "Ready for review": return dl + (canLic("approve") ? `<button class="btn ok" data-act="filing-approve" data-id="${f.id}">Approve</button>` : "") + b("Draft", "Back to draft");
    case "Approved": return dl + b("Submitted", "Record submission", "p") + b("Draft", "Back to draft");
    case "Submitted": return dl + b("Acknowledged", "Record acknowledgement", "p");
    case "Acknowledged": return dl + b("Closed", "Close");
    default: return dl;
  }
}
function specFieldsHTML(f, spec, base, locked, path) {
  const data = getPath(f, path) || {};
  let sec0 = null; const out = [];
  for (const [k, l, t, , o = {}] of spec) {
    if (o.sec && o.sec !== sec0) { if (sec0 !== null) out.push("</div></fieldset>"); out.push(`<fieldset><legend>${esc(o.sec)}</legend><div class="grid2">`); sec0 = o.sec; }
    const v = getPath(data, k), name = `${path}.${k}`, dis = locked ? " disabled" : "", sug = !locked && o.sug ? o.sug() : null, id = "ff_" + name.replace(/\W/g, "_");
    let inp;
    if (t === "area") inp = `<textarea id="${id}" name="${name}" rows="2"${dis}>${esc(v ?? "")}</textarea>`;
    else if (t === "choice") inp = `<select id="${id}" name="${name}"${dis}><option value="">—</option>${o.ch.map(x => `<option${x === v ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`;
    else if (t === "check") inp = `<label class="radio"><input type="checkbox" id="${id}" name="${name}" value="1"${v ? " checked" : ""}${dis}> Tick</label>`;
    else inp = `<input id="${id}" type="${t === "date" ? "date" : "text"}" name="${name}" value="${esc(v ?? "")}"${dis}${t === "num" ? ' inputmode="decimal"' : ""}>`;
    out.push(`<div class="fld${t === "area" ? " wide" : ""}"><label for="${id}">${esc(l)} ${o.ref ? refChip(FILING_KINDS[f.kind].src + " " + o.ref) : ""}</label>${inp}<div class="fx">${o.help ? `<span class="help">${esc(o.help)}</span>` : "<span></span>"}${sug && String(sug) !== String(v ?? "") ? `<button type="button" class="link small" data-act="app-sug" data-for="${id}" data-v="${esc(sug)}">Use from records: ${esc(String(sug).slice(0, 50))}</button>` : ""}</div></div>`);
  }
  if (sec0 !== null) out.push("</div></fieldset>");
  return spec.some(s => (s[4] || {}).sec) ? out.join("") : `<fieldset><div class="grid2">${out.join("")}</div></fieldset>`;
}
function readSpec(form, spec, path, before) {
  const out = clone(before || {}), errs = [];
  for (const [k, l, t] of spec) {
    const i = form.querySelector(`[name="${CSS.escape(path + "." + k)}"]`); if (!i || i.disabled) continue;
    let v = t === "check" ? i.checked : i.value.trim() || null;
    if (t === "num" && v != null) { try { v = cleanNum(v, l); } catch (e) { errs.push(e); continue; } }
    setPath(out, k, v);
  }
  if (errs.length) throw errs; return out;
}
async function saveFiling(f, patch, what) {
  if (filingLocked(f)) throw ["This filing has been submitted, so it is locked."];
  if (["Ready for review", "Approved"].includes(f.status)) { patch.status = "Draft"; patch.events = (f.events || []).concat([{ at: nowIso(), by: Store.uid, status: "Draft", note: `Changed after ${f.status.toLowerCase()}: ${what}` }]); toast("Changed after review, so it is back to Draft and needs approving again.", "warn"); }
  await Store.save("filings", patch, f.id); await Store.audit("filings", f.id, "Updated", `${f.title}: ${what}`);
}
const saveBtn = locked => locked ? "" : '<div class="row sticky-save"><button class="btn p">Save</button></div>';

/* ---------- Schedule III (+ Form III) ---------- */
function filingChange(f, locked) {
  const items = (f.data || {}).items || [], earliest = items.map(i => i.date).filter(Boolean).sort()[0], ppl = Store.list("app_people").filter(p => p.filing_id === f.id);
  const byCode = {}; items.forEach(i => (byCode[i.code] = byCode[i.code] || []).push(i));
  return `<div class="card"><h3>Changes to notify ${refChip("Schedule III, items A-K")}</h3><p class="small muted">Add one line per change. The form must reach the Commission within 30 days of the change, with documents that evidence it.${earliest ? ` Earliest change: ${fmtDate(earliest)}, so the notice is due by <b>${fmtDate(addDays(earliest, 30))}</b>.` : ""}</p>
   <form class="f" data-form="s3-items" data-id="${f.id}" data-autosave="1" novalidate><div class="tw"><table class="t s3"><thead><tr><th>Item</th><th>Former details</th><th>New details</th><th>Date of change</th><th>Reason</th><th></th></tr></thead><tbody>
   ${items.map((it, i) => `<tr><td><b>${esc(it.code)}</b> <span class="small">${esc((S3_ITEMS.find(x => x[0] === it.code) || [])[1] || "")}</span></td><td><textarea name="i.${i}.former" rows="2"${locked ? " disabled" : ""} aria-label="Former details">${esc(it.former || "")}</textarea></td><td><textarea name="i.${i}.new" rows="2"${locked ? " disabled" : ""} aria-label="New details">${esc(it.new || "")}</textarea></td><td><input type="date" name="i.${i}.date" value="${esc(it.date || "")}"${locked ? " disabled" : ""} aria-label="Date of change"></td><td><textarea name="i.${i}.reason" rows="2"${locked ? " disabled" : ""} aria-label="Reason">${esc(it.reason || "")}</textarea></td><td>${locked ? "" : `<button type="button" class="link small" data-act="s3-del" data-id="${f.id}" data-i="${i}">Remove</button>`}</td></tr>`).join("") || '<tr><td colspan="6" class="empty">No changes added yet.</td></tr>'}</tbody></table></div>
   ${locked ? "" : `<div class="row"><select name="newcode" aria-label="Item to add"><option value="">Add a change…</option>${S3_ITEMS.map(([c, l, , , h]) => { const n = (byCode[c] || []).length, full = n >= S3_CAP(c); return `<option value="${c}"${full ? " disabled" : ""}>${c}. ${esc(l)}${full ? " (form is full)" : ""}</option>`; }).join("")}</select><button class="btn p">Save${items.length ? "" : " and add"}</button></div>`}</form>
   ${items.some(i => i.code === "F" || i.code === "G") ? `<p class="note small">New shareholders need Part III and/or Part IV of the application form; new directors or key management need Part V. Add each person below and Quayzen prepares those parts of Schedule I for them.</p>` : ""}</div>
  ${items.some(i => i.code === "F" || i.code === "G") ? `<div class="card"><h3>Profiles for new members (Schedule I, Parts III, IV, V)</h3>${ppl.map(p => `<div class="li"><a href="#" data-act="fp-open" data-filing="${f.id}" data-id="${p.id}">${esc(p.name)}</a> <span class="small muted">${esc((p.roles || []).join("; "))}</span></div>`).join("") || '<p class="muted small">None added.</p>'}${locked ? "" : `<button class="btn sm" data-act="fp-open" data-filing="${f.id}" data-id="">Add a person</button>`}</div>` : ""}
  <div class="card"><h3><label class="radio"><input type="checkbox" data-change="f-offshore" data-id="${f.id}"${f.offshore ? " checked" : ""}${locked ? " disabled" : ""}> Also prepare offshore Form III</label></h3><p class="small muted">Offshore companies notify changes to the Form I particulars on Form III (regulation 6(1)), in addition to Schedule III.</p>
   ${f.offshore ? `<form class="f" data-form="o3" data-id="${f.id}" data-autosave="1" novalidate>${locked ? "" : '<p><button type="button" class="btn sm" data-act="o3-from-s3" data-id="' + f.id + '">Fill from the Schedule III changes</button></p>'}${specFieldsHTML(f, O3_SPEC, null, locked, "data.o3")}${saveBtn(locked)}</form>` : ""}</div>`;
}
FORMS["s3-items"] = async (form, o = {}) => {
  const f = Store.get("filings", form.dataset.id), items = clone((f.data || {}).items || []);
  items.forEach((it, i) => ["former", "new", "date", "reason"].forEach(k => { const x = form.querySelector(`[name="i.${i}.${k}"]`); if (x) it[k] = x.value.trim() || null; }));
  const add = form.querySelector('[name="newcode"]'); if (add && add.value) { const def = S3_ITEMS.find(x => x[0] === add.value); items.push({ code: add.value, former: def[3] ? companyCurrent(def[3]) || null : null, new: null, date: null, reason: null }); }
  const counts = {}; for (const it of items) { counts[it.code] = (counts[it.code] || 0) + 1; if (counts[it.code] > S3_CAP(it.code)) throw [`Item ${it.code}: the form has room for ${S3_CAP(it.code)} change(s). Put the rest on a separate notice.`]; }
  const dates = items.map(i => i.date).filter(Boolean).sort(), due = dates[0] ? addDays(dates[0], 30) : null;
  await saveFiling(f, { data: Object.assign({}, f.data, { items }), due_date: due }, "Schedule III changes"); UI.typing = false; if (!o.silent) { toast("Saved."); render(); }
};
ACTIONS["s3-del"] = async el => { const f = Store.get("filings", el.dataset.id), items = clone(f.data.items); items.splice(+el.dataset.i, 1); await saveFiling(f, { data: Object.assign({}, f.data, { items }) }, "Schedule III change removed"); render(); };
CHANGES["f-offshore"] = async el => { const f = Store.get("filings", el.dataset.id); await saveFiling(f, { offshore: el.checked }, el.checked ? "Offshore form added" : "Offshore form removed"); render(); };
FORMS.o3 = async (form, o = {}) => { const f = Store.get("filings", form.dataset.id); const o3 = readSpec(form, O3_SPEC, "data.o3", (f.data || {}).o3); await saveFiling(f, { data: Object.assign({}, f.data, { o3 }) }, "Form III"); UI.typing = false; if (!o.silent) { toast("Saved."); render(); } };
ACTIONS["o3-from-s3"] = el => {
  const f = Store.get("filings", el.dataset.id), items = (f.data || {}).items || [], set = (k, v) => { const i = document.querySelector(`[name="data.o3.${k}"]`); if (i && v) i.value = v; };
  const one = c => items.find(i => i.code === c);
  if (one("B")) { set("pc.prev", one("B").former); set("pc.new", one("B").new); set("pc.date", one("B").date); }
  if (one("C")) { set("reg.prev", one("C").former); set("reg.new", one("C").new); set("reg.date", one("C").date); }
  const g = items.filter(i => i.code === "G"); if (g.length) { const cb = document.querySelector('[name="data.o3.dir_a"]'); if (cb) cb.checked = true; }
  UI.typing = true; toast("Filled what matches. Add the personal details for directors and representatives, then save.", "info");
};
ACTIONS["fp-open"] = el => go({ kind: "appperson", filing_id: el.dataset.filing, id: el.dataset.id || null });

/* ---------- Schedule V ---------- */
function filingRenewal(f, locked) {
  const lic = mainLic(), last = Store.list("returns").filter(r => r.status === "Submitted").length;
  return `${lic ? `<div class="card"><p class="small">Licence <b>${esc(lic.number || "")}</b>, issued ${fmtDate(lic.issue_date) || "—"}, expires <b>${fmtDate(lic.expiry_date) || "—"}</b>. Fees Regulations No. 2 of 2024: the renewal fee is payable two months before expiry${lic.expiry_date ? ` (by ${fmtDate(addDays(lic.expiry_date, -60))})` : ""}.</p></div>` : ""}
  <form class="f" data-form="spec" data-spec="S5" data-id="${f.id}" data-autosave="1" novalidate>${specFieldsHTML(f, S5_SPEC, null, locked, "data")}${saveBtn(locked)}</form>
  <div class="card"><h3>The confirmations in the form</h3><p class="small">By signing, the director or authorised signatory confirms that (a) the annual return information is still true and accurate, (b) the Authorised Person remained solvent and is not in any insolvency or bankruptcy process, and (c) all laws and licensing conditions are complied with. Quayzen does not make these confirmations; the signatory decides whether they can be given.</p>${last ? "" : '<p class="small wt">No submitted annual return is recorded in Quayzen.</p>'}</div>`;
}
/* ---------- Schedule IV ---------- */
function filingAnnual(f, locked) {
  const m = (f.data || {}).mp || {}, num = (k, c) => `<input class="num sm" name="mp.${k}.${c}" value="${esc(((m[k] || {})[c]) ?? "")}"${locked ? " disabled" : ""} inputmode="decimal" aria-label="${k} ${c}">`;
  return `<div class="card"><p class="small">Schedule IV is the annual return format in the regulations. If the Commission has sent its own Annual Return form, use <a href="#" data-act="nav" data-section="returns">Annual Returns</a> instead.</p>${locked ? "" : `<div class="row"><label class="small">Figures as at <input type="date" name="as_at" form="s4f" value="${esc((f.data || {}).as_at || today())}"></label><button class="btn sm" data-act="s4-fill" data-id="${f.id}">Suggest figures from the registers</button></div><p class="help">Headcount from the workforce register (employees only), office space from the office register, investment from confirmed funding records. You check and change them.</p>`}</div>
  <form class="f" id="s4f" data-form="s4" data-id="${f.id}" data-autosave="1" novalidate>${specFieldsHTML(f, S4_SPEC, null, locked, "data")}
   <fieldset><legend>2(a) Manpower</legend><div class="tw"><table class="t bgrid"><thead><tr><th>Category</th><th class="num">Local</th><th class="num">Non-local</th><th class="num">Total</th><th>Expected remuneration</th></tr></thead><tbody>
   ${S4_MP.map(([k, l]) => `<tr><td>${esc(l)}</td><td>${num(k, "local")}</td><td>${num(k, "nonlocal")}</td><td class="num">${fmtNum((Number((m[k] || {}).local) || 0) + (Number((m[k] || {}).nonlocal) || 0))}</td><td><input name="mp.${k}.remun" value="${esc(((m[k] || {}).remun) ?? "")}"${locked ? " disabled" : ""} aria-label="${k} remuneration"></td></tr>`).join("")}
   <tr class="tot"><td>Total (a)+(b)+(c)+(d)</td><td></td><td></td><td></td><td><input name="mp.total_remun" value="${esc(m.total_remun ?? "")}"${locked ? " disabled" : ""} aria-label="Total remuneration"></td></tr></tbody></table></div>
   <p class="help">The Schedule IV form has a total box only for remuneration.${(f.data || {}).mp_note ? " " + esc(f.data.mp_note) : ""}</p></fieldset>${saveBtn(locked)}</form>`;
}
FORMS.s4 = async (form, o = {}) => {
  const f = Store.get("filings", form.dataset.id), data = readSpec(form, S4_SPEC, "data", f.data), mp = {}, errs = [];
  for (const [k, l] of S4_MP) { mp[k] = {}; for (const c of ["local", "nonlocal"]) { const x = form.querySelector(`[name="mp.${k}.${c}"]`); try { const n = cleanNum(x && x.value, l); if (n != null) mp[k][c] = n; } catch (e) { errs.push(e); } } const r = form.querySelector(`[name="mp.${k}.remun"]`); if (r && r.value.trim()) mp[k].remun = r.value.trim(); }
  if (errs.length) throw errs; const tr = form.querySelector('[name="mp.total_remun"]'); if (tr && tr.value.trim()) mp.total_remun = tr.value.trim();
  const asat = document.querySelector('[name="as_at"]'); data.as_at = asat ? asat.value || today() : data.as_at; data.mp = mp; data.mp_note = (f.data || {}).mp_note;
  await saveFiling(f, { data }, "Schedule IV"); UI.typing = false; if (!o.silent) { toast("Saved."); render(); }
};
ACTIONS["s4-fill"] = el => {
  const asat = (document.querySelector('[name="as_at"]') || {}).value || today(), set = (n, v) => { const i = document.querySelector(`[name="${n}"]`); if (i && v != null && v !== "") i.value = v; };
  const emp = Store.list("employees").filter(e => e.worker_type === "Employee" && e.start_date <= asat && (!e.end_date || e.end_date >= asat) && e.status !== "Offer accepted - not started");
  const cat = e => ({ Management: "a", Professional: "a", Technical: "b", Support: "c", Administrative: "d" })[e.staff_category] || null;
  const cnt = {}; let unk = 0; emp.forEach(e => { const k = cat(e); if (!k) { unk++; return; } cnt[k] = cnt[k] || { local: 0, nonlocal: 0 }; cnt[k][e.nationality_group === "Sri Lankan" ? "local" : "nonlocal"]++; });
  S4_MP.forEach(([k]) => { set(`mp.${k}.local`, (cnt[k] || {}).local || 0); set(`mp.${k}.nonlocal`, (cnt[k] || {}).nonlocal || 0); });
  const sqm = Store.list("offices").filter(o => o.location === "Inside Colombo Port City" && (o.in_use_from || "") <= asat && (!o.in_use_to || o.in_use_to >= asat) && o.status !== "Planned").reduce((t, o) => t + (Number(o.area_sqm) || 0), 0);
  if (sqm) set("data.office_space", `${fmtNum(r2(sqm))} sqm`);
  const inv = Store.list("investments").filter(i => i.review_status === "Confirmed" && (i.entry_date || i.received_date || "") <= asat);
  const fdi = inv.filter(i => ["Equity investment", "Reinvested earnings", "Intra-company debt"].includes(i.classification || i.fund_class)).reduce((t, i) => t + (Number(i.usd_amount) || 0), 0);
  if (fdi) { set("data.fdi.currency", "USD"); set("data.fdi.quantum", r2(fdi)); }
  UI.typing = true; toast(`Suggested from the registers as at ${fmtDate(asat)}: ${emp.length} employee(s)${unk ? `, ${unk} without a staff category (not counted)` : ""}. Staff categories were mapped as Management/Professional → a, Technical → b, Support → c, Administrative → d. Check the mapping, remuneration and investment, then save.`, "info");
};
/* ---------- Schedule VI (+ Form V) ---------- */
function filingSurrender(f, locked) {
  return `<form class="f" data-form="spec" data-spec="S6" data-id="${f.id}" data-autosave="1" novalidate>${specFieldsHTML(f, S6_SPEC, null, locked, "data")}${saveBtn(locked)}</form>
  <div class="card"><h3>The certification in the form</h3><p class="small">The applicant certifies that in the previous three months the Authorised Person has not changed its name, traded or carried on business, or done anything other than winding up its affairs or meeting legal requirements, and that no insolvency or bankruptcy process has started. Quayzen does not make this certification.</p></div>
  <div class="card"><h3><label class="radio"><input type="checkbox" data-change="f-offshore" data-id="${f.id}"${f.offshore ? " checked" : ""}${locked ? " disabled" : ""}> Also prepare offshore Form V (notice of intention to cease business)</label></h3>
   ${f.offshore ? `<form class="f" data-form="o5" data-id="${f.id}" data-autosave="1" novalidate>${specFieldsHTML(f, O5_SPEC, null, locked, "data.o5")}${saveBtn(locked)}</form>` : ""}</div>`;
}
FORMS.spec = async (form, o = {}) => { const f = Store.get("filings", form.dataset.id), spec = { S5: S5_SPEC, S6: S6_SPEC }[form.dataset.spec]; const data = readSpec(form, spec, "data", f.data); await saveFiling(f, { data }, form.dataset.spec === "S5" ? "Schedule V" : "Schedule VI"); UI.typing = false; if (!o.silent) { toast("Saved."); render(); } };
FORMS.o5 = async (form, o = {}) => { const f = Store.get("filings", form.dataset.id), o5 = readSpec(form, O5_SPEC, "data.o5", (f.data || {}).o5); await saveFiling(f, { data: Object.assign({}, f.data, { o5 }) }, "Form V"); UI.typing = false; if (!o.silent) { toast("Saved."); render(); } };

/* ---------- workflow ---------- */
ACTIONS["filing-status"] = el => {
  const to = el.dataset.to, f = Store.get("filings", el.dataset.id);
  openModal(`<h2>${esc(to === "Submitted" ? "Record submission" : to)}</h2>${to === "Submitted" ? '<p class="small">Record what you sent. Quayzen has not sent anything.</p>' : ""}<form class="f" data-form="filing-status" data-id="${f.id}" data-to="${esc(to)}" novalidate>
   ${["Submitted", "Acknowledged"].includes(to) ? `<div class="fld"><label>Date</label><input type="date" name="date" value="${today()}" required></div><div class="fld"><label>Reference</label><input name="ref"></div>` : ""}
   <div class="fld"><label>Note</label><textarea name="note" rows="2"></textarea></div><div class="row"><button class="btn p">Save</button><button type="button" class="btn" data-act="modal-close">Cancel</button></div></form>`);
};
FORMS["filing-status"] = async form => {
  const o = readForm(form), f = Store.get("filings", form.dataset.id), to = form.dataset.to, patch = { status: to };
  if (to === "Submitted") { if (f.status !== "Approved") throw ["Only an approved filing can be recorded as submitted."]; Object.assign(patch, { submitted_date: o.date, submission_ref: o.ref || null }); }
  if (to === "Acknowledged") Object.assign(patch, { ack_date: o.date, ack_ref: o.ref || null });
  patch.events = (f.events || []).concat([{ at: nowIso(), by: Store.uid, status: to, note: [o.date && fmtDate(o.date), o.ref, o.note].filter(Boolean).join(" · ") }]);
  await Store.save("filings", patch, f.id); await Store.audit("filings", f.id, "Status changed", `${f.title}: ${f.status} → ${to}`); closeModal(); toast(`Recorded: ${to}.`); render();
};
ACTIONS["filing-approve"] = async el => {
  const f = Store.get("filings", el.dataset.id); needDifferentPerson(f.updated_by, "approve this filing");
  const data = JSON.stringify({ filing: f, people: Store.list("app_people").filter(p => p.filing_id === f.id) }), hash = await sha256(data), vno = Store.list("snapshots").filter(s => s.filing_id === f.id).length + 1;
  const sid = await Store.save("snapshots", { kind: "filing", filing_id: f.id, version_no: vno, data, hash, approved_by: Store.uid, approved_at: today() });
  await Store.save("filings", { status: "Approved", approved_by: Store.uid, approved_at: today(), approved_snapshot: sid, events: (f.events || []).concat([{ at: nowIso(), by: Store.uid, status: "Approved", note: `Version ${vno} approved` }]) }, f.id);
  await Store.audit("filings", f.id, "Approved", `${f.title}: version ${vno} approved (SHA-256 ${hash.slice(0, 12)}…)`); toast("Approved. A fixed copy has been kept."); render();
};

/* ---------- generating the forms ---------- */
async function buildFiling(f) {
  const files = [], D = f.data || {}, c = Store.company(), who = c.name;
  const pdf = (name, r, notes = []) => files.push({ name, blob: new Blob([r.bytes], { type: "application/pdf" }), check: r, notes });
  if (f.kind === "change") {
    const items = D.items || []; if (!items.length) throw ["Add at least one change first."];
    const v = { Text373: (mainLic() || {}).number || c.licence_number || "", Text374: c.name }, labels = {}, cont = [];
    const byCode = {}; items.forEach(i => (byCode[i.code] = byCode[i.code] || []).push(i));
    for (const [code, list] of Object.entries(byCode)) {
      const map = S3_MAP[code];
      if (S3_CAP(code) === 1 && map.length === 2) { const it = list[0], [r1, r2] = map; // one change over two lines of boxes
        [["former", 0], ["new", 1], ["reason", 3]].forEach(([k, j]) => { const ls = /\n/.test(it[k] || "") ? splitLines(it[k], 2) : it[k] ? wrapPlain(it[k], 2) : []; if (ls[0]) { v[T(r1[j])] = ls[0]; labels[T(r1[j])] = `Item ${code} - ${k}`; } if (ls[1]) { v[T(r2[j])] = ls[1]; labels[T(r2[j])] = `Item ${code} - ${k} (continued)`; } });
        if (it.date) v[T(r1[2])] = ddmmyyyy(it.date);
      } else list.forEach((it, i) => { const r = map[i]; [["former", 0], ["new", 1], ["reason", 3]].forEach(([k, j]) => { if (it[k]) { v[T(r[j])] = it[k]; labels[T(r[j])] = `Item ${code}${list.length > 1 ? ` (${i + 1})` : ""} - ${k}`; } }); if (it.date && r[2]) v[T(r[2])] = ddmmyyyy(it.date); });
    }
    if (D.o3 && D.o3.signer) v.Text472 = D.o3.signer; else if (c.signatory_name) v.Text472 = c.signatory_name;
    const r = await fillPdfForm("s3", v, {}, { items: labels, never: ["Text474"] }); pdf(`Schedule_III_Notice_of_change_${fileSafe(who)}.pdf`, r, ["Signature and date are left blank."]); cont.push(...r.cont);
    if (f.offshore) { const o3 = await fillSpecForm("o3", O3_SPEC, D.o3 || {}, { never: ["Text92", "Text93", "Text94"] }); pdf(`Form_III_Offshore_changes_${fileSafe(who)}.pdf`, o3, ["Signature and submission date are left blank."]); cont.push(...o3.cont.map(([l, t]) => ["Form III: " + l, t])); }
    const ppl = Store.list("app_people").filter(p => p.filing_id === f.id);
    for (const p of ppl) for (const part of personParts(p, { legal: "" })) { // Schedule III: new members complete Part III / IV, new directors Part V
      const X = { v: { Text1: c.name }, c: {}, items: {}, notes: [] }; if (part === "III") s1Part3(p, X); else s1Part45(p, X, part);
      const rr = await fillPdfForm("s1", X.v, X.c, { items: X.items, never: S1.never }); pdf(`Schedule_I_Part_${part}_${fileSafe(p.name)}.pdf`, rr, [`Copy of the application form with only Part ${part} filled, for ${p.name}.`]); cont.push(...rr.cont);
    }
    if (cont.length) files.push({ name: `Notice_of_change_continuation_sheet_${fileSafe(who)}.pdf`, blob: await continuationPdf("Schedule III - Notice of change", who, cont), notes: [`${cont.length} item(s) did not fit in the boxes.`] });
  }
  if (f.kind === "renewal") {
    const co = /^Company/.test(D.who || "Company"), v = {}, sel = {};
    const r0 = await fillSpecForm("s5", S5_SPEC.filter(s => s[3]), D, { never: ["Text505"] }); // text fields first, then the We/I choices
    const PDFLib = await libs.pdflib(), pdfd = await PDFLib.PDFDocument.load(r0.bytes), fm = pdfd.getForm();
    ["Dropdown496", "Dropdown503", "Dropdown505"].forEach(n => { try { fm.getDropdown(n).select(co ? "We" : "I"); } catch (e) { r0.problems.push(`${n}: could not choose`); } });
    ["Dropdown501", "Dropdown502", "Dropdown506"].forEach(n => { try { fm.getDropdown(n).select(co ? "us" : "me"); } catch (e) { r0.problems.push(`${n}: could not choose`); } });
    const second = /amended/.test(D.variant || ""), ar = ddmmyyyy(D.ar_date), font = await pdfd.embedFont(PDFLib.StandardFonts.Helvetica);
    const tf = (n, t) => { if (!t) return; const x = fm.getTextField(n), rr = x.acroField.getWidgets()[0].getRectangle(), fit = fitText(font, t, rr.width, rr.height) || { size: 7 }; x.setFontSize(fit.size); x.setText(t); };
    if (second) { tf("Text503", ar); tf("Text504", ddmmyyyy(D.notice_date)); } else tf("Text502", ar);
    fm.updateFieldAppearances(font); const bytes = await pdfd.save();
    const back = (await PDFLib.PDFDocument.load(bytes)).getForm(), want = co ? ["We", "us"] : ["I", "me"];
    if (back.getDropdown("Dropdown496").getSelected()[0] !== want[0] || back.getDropdown("Dropdown506").getSelected()[0] !== want[1]) r0.problems.push("We / I choice not kept");
    const notes = [`Confirmation (a): "${second ? "as amended by the notice of change" : "remains true and accurate"}" sentence filled; the other sentence's dates are left blank (Schedule V, footnote 1).`, "Signature and signature date are left blank."];
    if (!D.ar_date) notes.unshift("Date of the latest annual return is blank.");
    pdf(`Schedule_V_Renewal_${fileSafe(who)}.pdf`, Object.assign(r0, { bytes, ticked: 0 }), notes);
  }
  if (f.kind === "annual") {
    const v = {}, mp = D.mp || {};
    S4_MP.forEach(([k, , l, n, t, rm]) => { const r = mp[k] || {}; if (filled(r.local) || filled(r.nonlocal)) { v[T(l)] = String(r.local ?? 0); v[T(n)] = String(r.nonlocal ?? 0); v[T(t)] = String((Number(r.local) || 0) + (Number(r.nonlocal) || 0)); } if (r.remun) v[T(rm)] = r.remun; });
    if (mp.total_remun) v.Text19 = mp.total_remun;
    pdf(`Schedule_IV_Annual_return_${fileSafe(who)}.pdf`, await fillSpecForm("s4", S4_SPEC, D, { v, never: ["Date35_af_date"] }), ["Signature and date are left blank."]);
  }
  if (f.kind === "surrender") {
    pdf(`Schedule_VI_Notice_of_surrender_${fileSafe(who)}.pdf`, await fillSpecForm("s6", S6_SPEC, D, { never: ["Text517"] }), ["Signature and date are left blank."]);
    if (f.offshore) pdf(`Form_V_Notice_to_cease_business_${fileSafe(who)}.pdf`, await fillSpecForm("o5", O5_SPEC, D.o5 || {}, { never: ["Text16", "Text17", "Text18"] }), ["Signature and submission date are left blank."]);
  }
  return files;
}
function filingModels(f) {
  const D = f.data || {}, c = Store.company(), who = fileSafe(c.name), out = [];
  if (f.kind === "change") {
    out.push({ name: `Schedule_III_Notice_of_change_copy_${who}`, model: { title: "Schedule III - Notice of change or alteration to the particulars in the application for a licence", subtitle: `${c.name} · licence ${(mainLic() || {}).number || c.licence_number || ""}`, note: COPY_NOTE("Schedule III"), blocks: [{ table: { cols: ["Item", "Former details", "New details", "Date of change", "Reason"], rows: (D.items || []).map(i => [`${i.code}. ${(S3_ITEMS.find(x => x[0] === i.code) || [])[1] || ""}`, i.former || "", i.new || "", ddmmyyyy(i.date), i.reason || ""]) } }, { kv: [["Full name of director or authorised signatory", (D.o3 || {}).signer || c.signatory_name || ""]] }] } });
    if (f.offshore) out.push({ name: `Form_III_Offshore_changes_copy_${who}`, model: specToModel("Offshore Form III - Informing the changes or alterations of particulars", "Offshore Form III", O3_SPEC, D.o3 || {}) });
  }
  if (f.kind === "renewal") out.push({ name: `Schedule_V_Renewal_copy_${who}`, model: specToModel("Schedule V - Application for renewal of licence (Annexure A)", "Schedule V", S5_SPEC, D) });
  if (f.kind === "annual") { const mp = D.mp || {}; out.push({ name: `Schedule_IV_Annual_return_copy_${who}`, model: specToModel("Schedule IV - Annual return", "Schedule IV", S4_SPEC, D, [{ h: "2(a) Manpower" }, { table: { cols: ["Category", "Local", "Non-local", "Total", "Expected remuneration"], rows: [...S4_MP.map(([k, l]) => { const r = mp[k] || {}; return [l, r.local ?? "", r.nonlocal ?? "", (Number(r.local) || 0) + (Number(r.nonlocal) || 0), r.remun || ""]; }), ["Total", "", "", "", mp.total_remun || ""]] } }]) }); }
  if (f.kind === "surrender") { out.push({ name: `Schedule_VI_Notice_of_surrender_copy_${who}`, model: specToModel("Schedule VI - Notice of intention to surrender licence", "Schedule VI", S6_SPEC, D) }); if (f.offshore) out.push({ name: `Form_V_Notice_to_cease_business_copy_${who}`, model: specToModel("Offshore Form V - Notice of intention to cease carrying on business", "Offshore Form V", O5_SPEC, D.o5 || {}) }); }
  return out;
}
ACTIONS["filing-gen"] = async el => {
  const f = Store.get("filings", el.dataset.id), wait = toast("Preparing…", "info");
  try {
    let files = [], errors = []; try { files = el.dataset.f === "docx" ? await modelsToFiles(filingModels(f), "docx") : await buildFiling(f); } catch (e) { errors = [].concat(e).map(m => m.message || String(m)); }
    if (wait) wait.remove();
    for (const x of files) { if (!(await saveFile((Store.company().is_demo ? "DEMO_" : "") + x.name, x.blob))) break; }
    if (files.length) { await Store.save("filings", { generated_at: nowIso() }, f.id); await Store.audit("filings", f.id, "Forms prepared", files.map(x => x.name).join(", ").slice(0, 280)); }
    genSummary(files, errors);
  } finally { if (wait) wait.remove(); }
};

