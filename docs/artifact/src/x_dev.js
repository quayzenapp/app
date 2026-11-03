/* ===== x_dev.js ===== */
/* Development approvals, for Primary BSI developers and plot lessees.
   Sources (supplied 1 Nov 2026): Colombo Port City (Development Control) Regulations No. 01 of 2023 - Schedule I (Application form for
   planning clearance / development permit), Schedule V (Fees), DCR Supplementary Forms 01-06; CAA form CAA/AE/06/04 (i);
   and the Commission's Development Approvals page (planning clearance, then development permit; submit to applications@portcity.gov.lk).
   The certificate of conformity appears only in the fee schedule; its process was not supplied. */

MODULES.push("development", "checklists");
Object.assign(PERM_CODES, { admin: PERM_CODES.admin + "aa", compliance: PERM_CODES.compliance + "ww", hr: PERM_CODES.hr + "rw",
  finance: PERM_CODES.finance + "ww", reviewer: PERM_CODES.reviewer + "aa", adviser: PERM_CODES.adviser + "rr" });
TYPES.push("dev_projects", "checklists");

const DEV_FEE_RATE = 1.5; // USD per sqm of gross floor area (DCR Schedule V)
const DEV_STAGES = [["pc", "Planning clearance", 0.2], ["dp", "Development permit", 0.5], ["coc", "Certificate of conformity", 0.3]];
const DEV_STATUS = ["Not started", "Preparing", "Submitted", "Further information requested", "Issued"];
const QP = [["civil", "Chartered Civil Engineer", 2, [3, 4], 1, [12, 13, 14]], ["elec", "Chartered Electrical Engineer", 5, [8, 9], 2, [15, 16, 17]], ["bse", "Chartered Building Services Engineer", 6, [10, 11], 3, [18, 19, 20]], ["mech", "Chartered Mechanical Engineer", 7, [12, 13], 4, [21, 22, 23]], ["fire", "Fire Engineer (Corporate Member, Institution of Fire Engineers UK)", 14, [15, 16], 5, [24, 25, 26]]];
const ROLE_QP = ["Reviewed the design and drawings", "Carried out the design and prepared the drawings"];
const notLessee = p => p.lessee === "No";

/* [key, label, type, section, opts] */
const DEV_SPEC = [
  ["name", "Project name", "text", "Project and land", { need: true }], ["plot_no", "Plot number", "text", "Project and land", { need: true, ref: "DCR Schedule I, 04" }],
  ["ref_no", "Reference number (if the Commission has given one)", "text", "Project and land", { ref: "DCR Schedule I, 01" }], ["use", "Proposed use", "text", "Project and land", { need: true }],
  ["lessee", "Is the applicant the lessee of the plot?", "yn", "Project and land", { need: true, help: "If not, the lessee gives a Power of Attorney (DCR Supplementary Form 01)." }],
  ["high_rise", "Is it a high-rise structure?", "yn", "Project and land", { need: true, help: "High-rise structures need a height clearance from the Civil Aviation Authority (CAA form)." }],
  ["ap.name", "Applicant - name", "text", "Applicant", { need: true, sug: () => Store.company().name, ref: "DCR Schedule I, 02" }], ["ap.id", "Applicant - NIC, passport or company registration no.", "text", "Applicant", { need: true, sug: () => Store.company().registration_no }],
  ["ap.address", "Applicant - mailing address", "area", "Applicant", { need: true, sug: () => Store.company().registered_address || Store.company().register_address }], ["ap.tel", "Applicant - telephone (fixed)", "text", "Applicant", { sug: () => Store.company().contact_phone }],
  ["ap.mobile", "Applicant - mobile", "text", "Applicant"], ["ap.email", "Applicant - email", "text", "Applicant", { need: true, sug: () => Store.company().contact_email }],
  ["lo.name", "Landowner / lessee - name", "text", "Landowner (if the applicant is not the lessee)", { need: notLessee, ref: "DCR Schedule I, 03" }], ["lo.id", "Landowner - NIC, passport or company registration no.", "text", "Landowner (if the applicant is not the lessee)", { need: notLessee }],
  ["lo.address", "Landowner - mailing address", "area", "Landowner (if the applicant is not the lessee)", { need: notLessee }], ["lo.tel", "Landowner - telephone (fixed)", "text", "Landowner (if the applicant is not the lessee)"],
  ["lo.mobile", "Landowner - mobile", "text", "Landowner (if the applicant is not the lessee)"], ["lo.email", "Landowner - email", "text", "Landowner (if the applicant is not the lessee)", { need: notLessee }],
  ["poa.holder", "Power of attorney holder - full name", "text", "Landowner (if the applicant is not the lessee)", { need: notLessee, ref: "DCR Supplementary Form 01" }], ["poa.holder_id", "Power of attorney holder - NIC / passport no.", "text", "Landowner (if the applicant is not the lessee)", { need: notLessee }],
  ["ar.name", "Chartered architect - name", "text", "Chartered architect", { need: true, ref: "DCR Supplementary Forms 02 and 03" }], ["ar.institution", "Institution", "text", "Chartered architect", { need: true }],
  ["ar.membership", "Membership number", "text", "Chartered architect", { need: true }], ["ar.company", "Company name", "text", "Chartered architect", { need: true }],
  ["ar.reg_no", "Professional registration no. (Architects Registration Board)", "text", "Chartered architect", { need: true }], ["ar.id", "Passport / NIC no.", "text", "Chartered architect", { need: true }],
  ["ar.role", "What the architect did", "choice", "Chartered architect", { need: true, ch: ROLE_QP }],
  ["eng_role", "What the engineers did", "choice", "Engineers and other qualified persons", { ch: ROLE_QP, ref: "DCR Supplementary Forms 05 and 06" }],
  ...QP.flatMap(([k, l]) => [["qp." + k + ".name", `${l} - name`, "text", "Engineers and other qualified persons"], ["qp." + k + ".institution", "Institution", "text", "Engineers and other qualified persons"], ["qp." + k + ".membership", "Membership no.", "text", "Engineers and other qualified persons"], ["qp." + k + ".company", "Company", "text", "Engineers and other qualified persons"], ["qp." + k + ".reg_no", "Professional registration no.", "text", "Engineers and other qualified persons"], ["qp." + k + ".id", "Passport / NIC no.", "text", "Engineers and other qualified persons"]]),
];
const CDP_ITEMS = [["a", "Illustrative details of massing", 50], ["b", "Landscape drawings", 49], ["c", "Internal roads", 42], ["e", "Infrastructure", 44], ["f", "Open spaces", 45], ["g", "Elevations", 46], ["h", "Sections", 47], ["j", "Any other information", 48]];
const CDP_PARAMS = [["height", "Building height (m)", "Building Height m_2", 36], ["far", "Maximum FAR", "Maximum FAR", 37], ["gfa", "Gross floor area (sqm)", "Gross Floor Area", 38], ["bcov", "Building coverage", "Building Coverage", 39], ["lcov", "Landscape coverage", "Landscape Coverage", 40]];
const CAA_SPEC = [
  ["owner", "Owner / client / company - name", "text", "Owner, client or company", { pdf: "Name", sug: p => getPath(p, "ap.name") }], ["owner_address", "Address", "area", "Owner, client or company", { pdf: ["Address", "1", "2"], sug: p => getPath(p, "ap.address") }],
  ["vat", "VAT no. (if any)", "text", "Owner, client or company", { pdf: "If VAT No" }], ["structure_type", "Type of structure (house / apartment / condominium, or describe)", "text", "Clearance details", { pdf: "Type of structure House Apartment Condominium" }],
  ["structure_address", "Address of the structure", "area", "Clearance details", { pdf: ["Address_2", "including Water Tanks Warning Lights Lift Room etc"] }], ["height", "Maximum height requested, including water tanks, warning lights, lift room (state ft or m)", "text", "Clearance details", { pdf: "Text2" }],
  ["survey_no", "Survey plan no.", "text", "Documents submitted", { pdf: "No" }], ["surveyor", "Surveyor name", "text", "Documents submitted", { pdf: "Surveyor Name" }], ["survey_date", "Survey plan date of issue", "date", "Documents submitted", { pdf: "Date3_af_date" }],
  ["plan_no", "Building plan no.", "text", "Documents submitted", { pdf: "No_2" }], ["plan_by", "Chartered architect / engineer who prepared the building plan", "text", "Documents submitted", { pdf: "Name of Chartered ArchitectEngineer", sug: p => getPath(p, "ar.name") }], ["plan_date", "Building plan date of issue", "date", "Documents submitted", { pdf: "Date4_af_date" }],
  ["google", "Google map of the location attached?", "yn", "Documents submitted", { radio: "Group1" }], ["contact", "Name and contact no. of the authorised person", "text", "Documents submitted", { pdf: "4 Name and contact no of authorized person" }],
  ["signer", "Name of the applicant (printed under the signature)", "text", "Documents submitted", { pdf: "undefined", sug: p => getPath(p, "ap.name") }],
];
const DEV_CHECK = {
  pc: [["pc_form", "Application form (DCR Schedule I), completed", "DCR Schedule I", "d1"], ["pc_fee", "Payment slip or bank transfer reference for the processing fee (20% of USD 1.50 x GFA)", "DCR Schedule I, item (i); Schedule V"],
    ["pc_poa", "Power of Attorney from the lessee (DCR Supplementary Form 01), signed by the lessee, the attorney holder and a Commissioner of Oaths / Attorney-at-Law", "DCR Schedule I, item (ii)", "p1", notLessee],
    ["pc_f02", "Declaration by the applicant on appointing the chartered architect (Supplementary Form 02)", "DCR Schedule I, item (iii)", "p2"], ["pc_f03", "Declaration by the chartered architect (Supplementary Form 03)", "DCR Schedule I, item (iv)", "p3"],
    ["pc_f04", "Conceptual development plan with items (a)-(j) (Supplementary Form 04)", "DCR Schedule I, item (v)", "p4"], ["pc_survey", "Extract of the approved survey plan", "DCR Schedule I, 04"], ["pc_lease", "Copy of the lease agreement", "DCR Schedule I, 04"],
    ["pc_caa", "CAA request for height clearance, with survey plan copy, council-size building plan drawing, Google Earth printout and (if needed) surveyor's elevation report", "Development Approvals page; CAA form CAA/AE/06/04 (i)", "caa", p => p.high_rise !== "No"]],
  dp: [["dp_pc", "Planning clearance obtained", "Development Approvals page (development permit follows planning clearance)"], ["dp_fee", "Payment slip or bank transfer reference for the processing fee (50% of USD 1.50 x GFA)", "DCR Schedule I; Schedule V"],
    ["dp_draw", "Landscape, building, detailed structural, geotechnical and MEP drawings by the qualified persons", "DCR Schedule I, development permit item (ii)"], ["dp_review", "Third-party review report on the structural, geotechnical and MEP designs, from a reviewer accepted by the Commission", "DCR Schedule I, development permit item (ii)"],
    ["dp_extra", "Any additional plans, details or specifications the Commission asks for", "DCR Schedule I, development permit item (iii)"], ["dp_f05", "Declaration by the applicant on appointing the qualified persons (Supplementary Form 05)", "DCR Schedule I, development permit item (iv)", "p5"],
    ["dp_f06", "Declaration by each qualified person (Supplementary Form 06)", "DCR Schedule I, development permit item (v)", "p6"]],
  coc: [["coc_fee", "Processing fee for the certificate of conformity (30% of USD 1.50 x GFA)", "Schedule V"], ["coc_process", "Confirm the certificate of conformity process and documents with the Commission (not in the supplied documents)", "Schedule V; DCR Supplementary Forms 03 and 06 (supervision until the certificate is obtained)"]],
};
const devGfa = p => Number(getPath(p, "cdp.prop.gfa")) || (p.floors || []).reduce((t, f) => t + (Number(f.gfa) || 0), 0) || null;
const devFees = p => { const g = devGfa(p); return g ? DEV_STAGES.map(([k, l, r]) => ({ k, l, pct: r, usd: r2(DEV_FEE_RATE * g * r) })).concat([{ k: "total", l: "Total", pct: 1, usd: r2(DEV_FEE_RATE * g) }]) : null; };
function devCheckRows(p) { const out = []; for (const [st] of DEV_STAGES) for (const [k, t, src, gen, when] of DEV_CHECK[st]) { if (when && !when(p)) continue; const e = (p.checklist || {})[k] || {}, status = e.status || "Not started"; out.push({ st, k, t, src, gen, e, status, done: status === "Ready" || (status === "Not applicable" && !!e.note) }); } return out; }
function devMissing(p) { return DEV_SPEC.filter(([k, , , , o = {}]) => (typeof o.need === "function" ? o.need(p) : o.need) && !filled(getPath(p, k))).map(s => s[1]); }

/* ---------- the forms ---------- */
const PLOT = p => p.plot_no || "";
const roleChecks = (role, a, b) => ({ [C(a)]: role === ROLE_QP[0], [C(b)]: role === ROLE_QP[1] });
const DEV_FORMS = {
  d1: { t: "DCR Schedule I - Application for planning clearance / development permit", src: "DCR Schedule I", f: p => {
    const v = { Text19: p.ref_no, Text20: getPath(p, "ap.name"), Text21: getPath(p, "ap.id"), Text22: getPath(p, "ap.address"), Text23: getPath(p, "ap.tel"), Text24: getPath(p, "ap.mobile"), Text25: getPath(p, "ap.email"), Text32: PLOT(p) };
    if (notLessee(p)) Object.assign(v, { Text26: getPath(p, "lo.name"), Text27: getPath(p, "lo.id"), Text28: getPath(p, "lo.address"), Text29: getPath(p, "lo.tel"), Text30: getPath(p, "lo.mobile"), Text31: getPath(p, "lo.email") });
    const ck = p.checklist || {}; return { v, c: { "Check Box33": (ck.pc_survey || {}).status === "Ready", "Check Box34": (ck.pc_lease || {}).status === "Ready" } }; } },
  p1: { t: "DCR Supplementary Form 01 - Power of attorney", src: "DCR Supplementary Form 01", when: notLessee, f: p => { const h = wrapPlain(getPath(p, "poa.holder") || "", 1); return { v: { Text9: getPath(p, "lo.name"), Text10: getPath(p, "lo.id"), Text11: PLOT(p), Text12: h[0], Text14: getPath(p, "poa.holder_id") }, never: ["Date18_af_date"] }; } },
  p2: { t: "DCR Supplementary Form 02 - Declaration by the applicant on appointing a chartered architect", src: "DCR Supplementary Form 02", f: p => ({ v: { Text1: PLOT(p), Text4: getPath(p, "ar.name"), Text5: getPath(p, "ar.institution"), Text6: getPath(p, "ar.membership"), "Details of the ApplicantRow1": getPath(p, "ap.name"), "Details of the ApplicantRow2": getPath(p, "ap.id") }, c: roleChecks(getPath(p, "ar.role"), 7, 8), never: ["Date1_af_date"] }) },
  p3: { t: "DCR Supplementary Form 03 - Declaration by the chartered architect", src: "DCR Supplementary Form 03", f: p => ({ v: { Text1: PLOT(p), Text3: getPath(p, "ar.name"), Text4: getPath(p, "ar.company"), Text5: getPath(p, "ar.reg_no"), Text6: getPath(p, "ar.id") }, c: roleChecks(getPath(p, "ar.role"), 1, 2), never: ["Date1_af_date"] }) },
  p4: { t: "DCR Supplementary Form 04 - Conceptual development plan", src: "DCR Supplementary Form 04", f: p => {
    const v = {}, c = {}; CDP_ITEMS.forEach(([k, , n]) => { if (getPath(p, "cdp.items." + k)) c[C(n)] = true; });
    CDP_PARAMS.forEach(([k, , alloc, prop]) => { v[alloc] = getPath(p, "cdp.alloc." + k); v[T(prop)] = getPath(p, "cdp.prop." + k); });
    (p.floors || []).slice(0, 3).forEach((f, i) => { const n = i + 1; Object.assign(v, { [`Use of the floorRow${n}`]: f.use, [`Floor numbers  LevelsRow${n}`]: f.levels, [`Height of the floorRow${n}`]: f.height, [`Net floor Area sqmRow${n}`]: f.nfa, [`Gross Floor Area sqmRow${n}`]: f.gfa }); });
    return { v, c, extra: (p.floors || []).length > 3 ? [["Floor area details - additional sheet", (p.floors || []).slice(3).map(f => `${f.use || ""} | ${f.levels || ""} | height ${f.height || ""} | NFA ${f.nfa || ""} sqm | GFA ${f.gfa || ""} sqm`).join("\n")]] : [] }; } },
  p5: { t: "DCR Supplementary Form 05 - Declaration by the applicant on appointing the qualified persons", src: "DCR Supplementary Form 05", f: p => { const v = { Text1: PLOT(p), Text27: getPath(p, "ap.name"), Text28: getPath(p, "ap.id") }; QP.forEach(([k, , , , , [a, b, cc]]) => { v[T(a)] = getPath(p, `qp.${k}.name`); v[T(b)] = getPath(p, `qp.${k}.institution`); v[T(cc)] = getPath(p, `qp.${k}.membership`); }); return { v, c: roleChecks(p.eng_role, 10, 11), never: ["Date1_af_date"] }; } },
  caa: { t: "CAA - Request to obtain height clearance for a high-rise structure", src: "CAA form CAA/AE/06/04 (i)", when: p => p.high_rise !== "No", f: p => {
    const d = p.caa || {}, v = {}, radios = {};
    for (const [k, , t, , o] of CAA_SPEC) { const val = d[k] ?? (o.sug ? o.sug(p) : null); if (!filled(val)) continue; if (o.radio) { radios[o.radio] = val; continue; } const txt = t === "date" ? ddmmyyyy(val) : String(val); if (Array.isArray(o.pdf)) splitLines(txt, o.pdf.length).forEach((x, i) => v[o.pdf[i]] = x); else v[o.pdf] = txt; }
    return { v, radios, never: ["Text1", "Text3", "Text4"] }; } },
};
/* Supplementary Form 06: one copy for each qualified person */
function devForm06(p, k) {
  const q = QP.find(x => x[0] === k), d = getPath(p, "qp." + k) || {}, [, , disc, [ra, rb], plotN] = q;
  return { v: { [T(plotN)]: PLOT(p), Text17: d.name, Text18: d.company, Text19: d.reg_no, Text20: d.id }, c: Object.assign({ [C(disc)]: true }, roleChecks(p.eng_role, ra, rb)), never: ["Date1_af_date"] };
}
const devQPs = p => QP.filter(([k]) => getPath(p, `qp.${k}.name`));
async function devPdf(key, R, items) { return fillPdfForm(key, R.v, R.c || {}, { never: R.never || [], radios: R.radios, items: items || {} }); }
function devFormModel(p, key) {
  const F = DEV_FORMS[key], R = F.f(p), lab = { d1: [["Reference number", p.ref_no], ["Applicant", getPath(p, "ap.name")], ["NIC / passport / company registration no.", getPath(p, "ap.id")], ["Mailing address", getPath(p, "ap.address")], ["Telephone", getPath(p, "ap.tel")], ["Mobile", getPath(p, "ap.mobile")], ["Email", getPath(p, "ap.email")], ...(notLessee(p) ? [["Landowner", getPath(p, "lo.name")], ["Landowner ID", getPath(p, "lo.id")], ["Landowner address", getPath(p, "lo.address")], ["Landowner email", getPath(p, "lo.email")]] : []), ["Plot number", PLOT(p)]] }[key];
  const kv = lab || DEV_SPEC.filter(([k]) => ({ p1: /^(lo\.name|lo\.id|poa\.)/, p2: /^(ar\.(name|institution|membership|role)|ap\.(name|id))/, p3: /^ar\./, p5: /^(qp\.|eng_role|ap\.(name|id))/ })[key]?.test(k)).map(([k, l]) => [l, getPath(p, k) ?? ""]);
  const blocks = [{ kv: [["Plot number", PLOT(p)], ...kv] }];
  if (key === "p4") blocks.push({ h: "Included in the plan" }, { list: CDP_ITEMS.map(([k, l]) => `${getPath(p, "cdp.items." + k) ? "[x]" : "[ ]"} ${l}`) }, { h: "Proposed use and parameters" }, { table: { cols: ["Parameter", "Allocated", "Proposed"], rows: CDP_PARAMS.map(([k, l]) => [l, getPath(p, "cdp.alloc." + k) ?? "", getPath(p, "cdp.prop." + k) ?? ""]) } }, { h: "Floor area details" }, { table: { cols: ["Use", "Floor(s) / level(s)", "Height", "Net floor area (sqm)", "Gross floor area (sqm)"], rows: (p.floors || []).map(f => [f.use, f.levels, f.height, f.nfa, f.gfa]) } });
  if (key === "caa") return specToModel(F.t, F.src, CAA_SPEC, Object.assign({}, Object.fromEntries(CAA_SPEC.map(([k, , , , o]) => [k, o.sug ? o.sug(p) : null])), p.caa || {}));
  return { title: F.t, subtitle: p.name || "", note: COPY_NOTE(F.src), blocks };
}
function devOutputs(p) {
  const o = [];
  for (const [key, F] of Object.entries(DEV_FORMS)) if (!F.when || F.when(p)) o.push({ k: key, t: F.t, st: ["p5"].includes(key) ? "dp" : key === "d1" ? "pc" : "pc", orig: "pdf", fmts: ["pdf", "docx"],
    fn: async () => { const r = await devPdf(key === "p1" ? "p1" : key, F.f(p)); const ex = F.f(p).extra || []; const files = [{ name: `${fileSafe(F.src)}_${fileSafe(p.name)}.pdf`, blob: new Blob([r.bytes], { type: "application/pdf" }), check: r, notes: ["Signatures and dates are left blank.", ...(key === "p1" ? ["Executed before a Commissioner of Oaths or Attorney-at-Law."] : []), ...(["p2", "p3", "p5"].includes(key) ? ["The 'reviewed' / 'carried out' box is ticked from what you entered - check it before signing."] : [])] }];
      if (r.cont.length || ex.length) files.push({ name: `${fileSafe(F.src)}_additional_sheet_${fileSafe(p.name)}.pdf`, blob: await continuationPdf(F.t, getPath(p, "ap.name") || p.name, [...r.cont, ...ex]), notes: ["Additional sheet for details that did not fit on the form."] }); return files; },
    model: () => [{ name: `${fileSafe(F.src)}_copy_${fileSafe(p.name)}`, model: devFormModel(p, key) }] });
  const qps = devQPs(p);
  if (qps.length) o.push({ k: "p6", t: "DCR Supplementary Form 06 - Declaration by each qualified person", st: "dp", orig: "pdf", fmts: ["pdf", "docx"], fn: async () => { const out = []; for (const [k, l] of qps) { const r = await devPdf("p6", devForm06(p, k)); out.push({ name: `DCR_Supplementary_Form_06_${k}_${fileSafe(getPath(p, `qp.${k}.name`))}.pdf`, blob: new Blob([r.bytes], { type: "application/pdf" }), check: r, notes: [`${l}. The discipline and role boxes are ticked from what you entered - the engineer checks them before signing.`] }); } return out; },
    model: () => qps.map(([k, l]) => ({ name: `DCR_Supplementary_Form_06_copy_${k}`, model: { title: "DCR Supplementary Form 06 - Declaration by the relevant qualified person", subtitle: `${l} · ${p.name || ""}`, note: COPY_NOTE("DCR Supplementary Form 06"), blocks: [{ kv: [["Qualified as", l], ["Role", p.eng_role || ""], ["Plot number", PLOT(p)], ["Name", getPath(p, `qp.${k}.name`)], ["Company", getPath(p, `qp.${k}.company`)], ["Professional registration no.", getPath(p, `qp.${k}.reg_no`)], ["Passport / NIC no.", getPath(p, `qp.${k}.id`)]] }] } })) });
  o.forEach(x => { if (x.k === "p6" || x.k === "p5") x.st = "dp"; });
  o.push({ k: "data", t: "Project workbook: parameters, floor areas, fees and checklist", st: "all", orig: null, fmts: ["xlsx", "pdf", "docx"], model: () => [{ name: `Development_project_${fileSafe(p.name)}`, model: devDataModel(p) }] });
  return o;
}
function devDataModel(p) {
  const fees = devFees(p);
  return { title: `Development project - ${p.name || ""}`, subtitle: `Plot ${PLOT(p)} · ${p.use || ""} · as at ${fmtDate(today())}`, sheet: "Project", note: "Working summary prepared in Quayzen. Fees follow DCR Schedule V (USD 1.50 per sqm of gross floor area); confirm the amount with the Commission before paying.",
    blocks: [{ h: "Project" }, { kv: DEV_SPEC.filter(([k]) => !/^qp\./.test(k)).map(([k, l]) => [l, getPath(p, k) ?? ""]) }, { h: "Proposed use and parameters" }, { table: { cols: ["Parameter", "Allocated", "Proposed"], rows: CDP_PARAMS.map(([k, l]) => [l, getPath(p, "cdp.alloc." + k) ?? "", getPath(p, "cdp.prop." + k) ?? ""]) } },
      { h: "Floor areas" }, { table: { cols: ["Use", "Floor(s) / level(s)", "Height", "Net floor area (sqm)", "Gross floor area (sqm)"], rows: (p.floors || []).map(f => [f.use, f.levels, f.height, Number(f.nfa) || f.nfa || "", Number(f.gfa) || f.gfa || ""]) } },
      { h: "Fees (DCR Schedule V)" }, { table: { cols: ["Stage", "Share", "USD"], rows: fees ? fees.map(f => [f.l, Math.round(f.pct * 100) + "%", f.usd]) : [["Enter the gross floor area to work out the fees", "", ""]] } },
      { h: "Stages" }, { table: { cols: ["Stage", "Status", "Submitted", "Reference", "Issued"], rows: DEV_STAGES.map(([k, l]) => { const s = (p.stages || {})[k] || {}; return [l, s.status || "Not started", fmtDate(s.submitted), s.ref || "", fmtDate(s.issued)]; }) } },
      { h: "Checklist" }, { table: { cols: ["Stage", "Item", "Status", "Note", "Source"], rows: devCheckRows(p).map(r => [DEV_STAGES.find(s => s[0] === r.st)[1], r.t, r.status, r.e.note || "", r.src]) } }] };
}

/* ======================= SCREENS ======================= */
PAGES.develop = () => {
  const ps = Store.list("dev_projects").sort((a, b) => (a.name || "").localeCompare(b.name || "")), w = Store.can("development", "write");
  const gfa = ps.reduce((t, p) => t + (devGfa(p) || 0), 0);
  return ovHead("Development approvals", "For Primary BSI developers and plot lessees. Each plot goes through planning clearance, then the development permit, then the certificate of conformity. Quayzen fills DCR Schedule I, Supplementary Forms 01-06 and the CAA height clearance request, works out the fees and tracks the documents.", w ? '<button class="btn p" data-act="dev-new">Add a project</button>' : "")
  + `<div class="card">${devFlow(null)}<p class="small muted">From the Commission's Development Approvals page and the Development Control Regulations No. 01 of 2023. Submissions go to applications@portcity.gov.lk. The certificate of conformity process was not in the supplied documents.</p></div>`
  + hlCards([{ value: ps.length, label: "Projects" }, { value: gfa ? fmtNum(r2(gfa)) + " sqm" : "—", label: "Gross floor area" }, { value: gfa ? "USD " + fmtK(gfa * DEV_FEE_RATE) : "—", label: "Total processing fees (Schedule V)" }, { value: ps.filter(p => DEV_STAGES.some(([k]) => ((p.stages || {})[k] || {}).status === "Submitted")).length, label: "Awaiting the Commission" }])
  + `<div class="card"><h3>Projects</h3><div class="tw"><table class="t"><thead><tr><th>Project</th><th>Plot</th><th>Use</th><th class="num">GFA (sqm)</th>${DEV_STAGES.map(s => `<th>${esc(s[1])}</th>`).join("")}<th>Documents</th></tr></thead><tbody>
   ${ps.map(p => { const cr = devCheckRows(p); return `<tr><td><a href="#" data-act="dev-open" data-id="${p.id}">${esc(p.name || "(unnamed)")}</a></td><td>${esc(p.plot_no || "")}</td><td>${esc(p.use || "")}</td><td class="num">${fmtNum(devGfa(p))}</td>${DEV_STAGES.map(([k]) => `<td>${badge(((p.stages || {})[k] || {}).status || "Not started")}</td>`).join("")}<td>${cr.filter(r => r.done).length} of ${cr.length}</td></tr>`; }).join("") || `<tr><td colspan="${5 + DEV_STAGES.length}" class="empty">No projects yet.</td></tr>`}</tbody></table></div></div>`;
};
function devFlow(p) {
  const steps = [["pc", "Planning clearance", "DCR Schedule I; Supplementary Forms 01 (if not the lessee), 02, 03, 04; CAA height clearance (high-rise); fee 20%"], ["dp", "Development permit", "Drawings and third-party review; Supplementary Forms 05 and 06; fee 50%"], ["coc", "Certificate of conformity", "Fee 30%. The architect and engineers supervise until it is obtained"]];
  return `<ol class="stepper dev">${steps.map(([k, l, d]) => { const s = p ? (((p.stages || {})[k] || {}).status || "Not started") : null; return `<li class="${s === "Issued" ? "done" : s && s !== "Not started" ? "cur" : ""}"><span>${s === "Issued" ? "✓" : steps.findIndex(x => x[0] === k) + 1}</span><div><b>${esc(l)}</b>${s ? ` ${badge(s)}` : ""}<div class="small">${esc(d)}</div></div></li>`; }).join("")}</ol>`;
}
ACTIONS["dev-new"] = async () => { const id = await Store.save("dev_projects", { name: "New project", lessee: "Yes", high_rise: null, eng_role: ROLE_QP[1], ap: { name: Store.company().name, id: Store.company().registration_no || null, email: Store.company().contact_email || null }, caa: {}, cdp: { items: {}, alloc: {}, prop: {} }, floors: [], stages: {}, checklist: {} }); await Store.audit("dev_projects", id, "Created", "Development project added"); go({ kind: "devproj", id }); };
ACTIONS["dev-open"] = el => go({ kind: "devproj", id: el.dataset.id });
const DEV_TABS = [["overview", "Overview"], ["details", "Project and people"], ["plan", "Conceptual plan"], ["caa", "Height clearance"], ["check", "Documents"], ["forms", "Forms and downloads"], ["history", "History"]];
VIEWS.devproj = ({ id }) => {
  const p = Store.get("dev_projects", id); if (!p) return '<div class="card empty">Not found. <button class="link" data-act="back">Back</button></div>';
  const t = UI.tab.devproj || "overview", locked = !Store.can("development", "write"), miss = devMissing(p), cr = devCheckRows(p);
  const nav = `<div class="appnav">${DEV_TABS.filter(([k]) => k !== "caa" || p.high_rise !== "No").map(([k, l]) => `<button class="tab${k === t ? " on" : ""}" data-act="dev-tab" data-t="${k}">${esc(l)}${k === "details" && miss.length ? ` <span class="cnt">${miss.length}</span>` : k === "check" ? ` <span class="cnt${cr.every(r => r.done) ? " ok" : ""}">${cr.every(r => r.done) ? "✓" : cr.filter(r => !r.done).length}</span>` : ""}</button>`).join("")}</div>`;
  const body = { overview: devOverview, details: devDetails, plan: devPlan, caa: devCaa, check: devChecklist, forms: devForms, history: x => `<div class="card"><h3>Change history</h3>${historyHTML(Store.history("dev_projects", x.id))}</div>` }[t](p, locked);
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Development approvals</button><h1>${esc(p.name || "Project")}</h1><div class="row"><span class="small muted">Plot ${esc(p.plot_no || "—")} · ${esc(p.use || "use not set")}</span></div></div>
   <div class="acts">${locked ? "" : `<button class="btn bad" data-act="dev-archive" data-id="${p.id}">Archive</button>`}</div></div>${nav}${body}`;
};
ACTIONS["dev-tab"] = async el => { const f = document.querySelector('main form[data-autosave="1"]'); if (f && UI.typing) { try { await FORMS[f.dataset.form](f, { silent: true }); } catch (e) { showErrors(e); return; } } UI.typing = false; UI.tab.devproj = el.dataset.t; render(); };
ACTIONS["dev-archive"] = el => confirmModal("Archive this project? It is hidden from the list but kept.", async () => { await Store.save("dev_projects", { archived: true }, el.dataset.id); await Store.audit("dev_projects", el.dataset.id, "Archived", "Development project archived"); back(); });
function devOverview(p, locked) {
  const fees = devFees(p), cr = devCheckRows(p), miss = devMissing(p);
  return `<div class="card">${devFlow(p)}${locked ? "" : `<div class="row" style="margin-top:10px">${DEV_STAGES.map(([k, l]) => `<button class="btn sm" data-act="dev-stage" data-id="${p.id}" data-k="${k}">Update ${esc(l.toLowerCase())}</button>`).join("")}</div>`}</div>`
  + hlCards([{ value: devGfa(p) ? fmtNum(devGfa(p)) + " sqm" : "Not set", label: "Gross floor area (proposed)", kind: devGfa(p) ? "" : "warn" }, { value: fees ? "USD " + fmtNum(fees[3].usd) : "—", label: "Total processing fees", sub: fees ? fees.slice(0, 3).map(f => `${f.l.split(" ")[0]} ${fmtK(f.usd)}`).join(" · ") : "enter the GFA" }, { value: `${cr.filter(r => r.done).length} of ${cr.length}`, label: "Documents ready" }, { value: miss.length, label: "Details missing", kind: miss.length ? "warn" : "" }])
  + `<div class="cols"><div class="card"><h3>Fees (DCR Schedule V)</h3>${fees ? `<table class="t small"><thead><tr><th>Stage</th><th class="num">Share</th><th class="num">USD</th></tr></thead><tbody>${fees.map(f => `<tr${f.k === "total" ? ' class="tot"' : ""}><td>${esc(f.l)}</td><td class="num">${Math.round(f.pct * 100)}%</td><td class="num">${fmtMoney(f.usd)}</td></tr>`).join("")}</tbody></table><p class="help">USD 1.50 x ${fmtNum(devGfa(p))} sqm gross floor area. Confirm the amount with the Commission before paying; the fee is worked out on the GFA it accepts.</p>` : '<p class="muted small">Enter the proposed gross floor area on the Conceptual plan tab.</p>'}</div>
   <div class="card"><h3>Stage records</h3><dl class="kv">${DEV_STAGES.map(([k, l]) => { const s = (p.stages || {})[k] || {}; return `<dt>${esc(l)}</dt><dd>${badge(s.status || "Not started")} ${s.submitted ? "submitted " + fmtDate(s.submitted) : ""} ${s.ref ? "· ref " + esc(s.ref) : ""} ${s.issued ? "· issued " + fmtDate(s.issued) : ""}${s.fee_paid ? `<div class="small">Fee paid ${fmtDate(s.fee_paid)} ${esc(s.fee_ref || "")}</div>` : ""}</dd>`; }).join("")}</dl></div></div>
   ${miss.length ? `<div class="card"><h3>Details still missing</h3><ul class="small">${miss.slice(0, 12).map(m => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}`;
}
ACTIONS["dev-stage"] = el => { const p = Store.get("dev_projects", el.dataset.id), k = el.dataset.k, s = (p.stages || {})[k] || {}, l = DEV_STAGES.find(x => x[0] === k)[1];
  openModal(`<h2>${esc(l)}</h2><p class="small">Record what happened. Quayzen has not sent anything.</p><form class="f" data-form="dev-stage" data-id="${p.id}" data-k="${k}" novalidate><div class="grid2">
   <div class="fld"><label>Status</label><select name="status">${DEV_STATUS.map(x => `<option${x === (s.status || "Not started") ? " selected" : ""}>${x}</option>`).join("")}</select></div>
   <div class="fld"><label>Submitted on</label><input type="date" name="submitted" value="${esc(s.submitted || "")}"></div><div class="fld"><label>Reference</label><input name="ref" value="${esc(s.ref || "")}"></div>
   <div class="fld"><label>Issued on</label><input type="date" name="issued" value="${esc(s.issued || "")}"></div><div class="fld"><label>Fee paid on</label><input type="date" name="fee_paid" value="${esc(s.fee_paid || "")}"></div><div class="fld"><label>Payment reference</label><input name="fee_ref" value="${esc(s.fee_ref || "")}"></div>
   <div class="fld wide"><label>Conditions or notes</label><textarea name="notes" rows="3">${esc(s.notes || "")}</textarea></div></div>
   <div class="row"><button class="btn p">Save</button><button type="button" class="btn" data-act="modal-close">Cancel</button></div></form>`); };
FORMS["dev-stage"] = async form => { const o = readForm(form), p = Store.get("dev_projects", form.dataset.id), k = form.dataset.k, stages = clone(p.stages || {}), old = (stages[k] || {}).status;
  if (o.status === "Issued" && !o.issued) throw ["Enter the date it was issued."]; if (o.status === "Submitted" && !o.submitted) throw ["Enter the date it was submitted."];
  if (k !== "pc" && ["Submitted", "Issued"].includes(o.status) && ((stages.pc || {}).status !== "Issued")) toast("The development permit normally follows the planning clearance, which is not recorded as issued.", "warn");
  stages[k] = Object.fromEntries(Object.entries(o).map(([x, v]) => [x, v || null]));
  if (k === "pc" && o.status === "Issued") { const ck = clone(p.checklist || {}); ck.dp_pc = Object.assign({}, ck.dp_pc, { status: "Ready", note: `Issued ${fmtDate(o.issued)}${o.ref ? ", ref " + o.ref : ""}` }); await Store.save("dev_projects", { checklist: ck }, p.id); }
  await Store.save("dev_projects", { stages }, p.id); await Store.audit("dev_projects", p.id, "Stage updated", `${p.name}: ${DEV_STAGES.find(x => x[0] === k)[1]} ${old || "Not started"} → ${o.status}${o.ref ? " (" + o.ref + ")" : ""}`); closeModal(); toast("Saved."); render(); };
const devWrap = p => ({ kind: "change", d: p });
function devDetails(p, locked) {
  const spec = DEV_SPEC.map(s => { const o = Object.assign({}, s[4] || {}); delete o.ref; if (o.sug) { const fn = o.sug; o.sug = () => fn(p); } return [s[0], s[1] + (s[4] && s[4].ref ? ` (${s[4].ref})` : ""), s[2] === "yn" ? "choice" : s[2], null, Object.assign(o, { sec: s[3], ch: s[2] === "yn" ? YES_NO : o.ch })]; });
  return `<form class="f" data-form="dev-details" data-id="${p.id}" data-autosave="1" novalidate>${specFieldsHTML(devWrap(p), spec, null, locked, "d")}${saveBtn(locked)}</form>`;
}
FORMS["dev-details"] = async (form, o = {}) => {
  const p = Store.get("dev_projects", form.dataset.id), spec = DEV_SPEC.map(s => [s[0], s[1], s[2] === "yn" ? "choice" : s[2]]), d = readSpec(form, spec, "d", p);
  delete d.id; const ch = DEV_SPEC.filter(([k]) => String(getPath(p, k) ?? "") !== String(getPath(d, k) ?? "")).map(([k, l]) => ({ label: l, old: getPath(p, k) ?? null, new: getPath(d, k) ?? null }));
  if (!ch.length) { if (!o.silent) toast("No changes to save.", "info"); UI.typing = false; return; }
  await Store.save("dev_projects", d, p.id); await Store.audit("dev_projects", p.id, "Updated", `Project details: ${d.name || ""}`, ch); UI.typing = false; if (!o.silent) { toast("Saved."); render(); }
};
function devPlan(p, locked) {
  const dis = locked ? " disabled" : "", fl = Array.from({ length: Math.max(4, (p.floors || []).length + 2) }, (_, i) => (p.floors || [])[i] || {}), g = devGfa(p);
  return `<form class="f" data-form="dev-plan" data-id="${p.id}" data-autosave="1" novalidate>
   <fieldset><legend>Included in the conceptual development plan ${refChip("DCR Supplementary Form 04")}</legend><div class="mchk">${CDP_ITEMS.map(([k, l]) => `<label><input type="checkbox" name="it.${k}"${getPath(p, "cdp.items." + k) ? " checked" : ""}${dis}> ${k}. ${esc(l)}</label>`).join("")}</div><p class="help">Item (d) is the parameters table and item (i) the floor areas below. Tick an item only if the plan prepared by the qualified person includes it.</p></fieldset>
   <fieldset><legend>(d) Proposed use and parameters of the land plot</legend><div class="tw"><table class="t bgrid"><thead><tr><th>Parameter</th><th>Allocated</th><th>Proposed</th></tr></thead><tbody>${CDP_PARAMS.map(([k, l]) => `<tr><td>${esc(l)}</td><td><input name="al.${k}" value="${esc(getPath(p, "cdp.alloc." + k) ?? "")}"${dis} aria-label="${esc(l)} allocated"></td><td><input name="pr.${k}" value="${esc(getPath(p, "cdp.prop." + k) ?? "")}"${dis} aria-label="${esc(l)} proposed"></td></tr>`).join("")}</tbody></table></div>
    <p class="help">The proposed gross floor area is used for the fees (USD 1.50 per sqm). ${g ? `Fees on ${fmtNum(g)} sqm: USD ${fmtNum(r2(g * DEV_FEE_RATE))} in total.` : ""}</p></fieldset>
   <fieldset><legend>(i) Floor area by use at each floor</legend><div class="tw"><table class="t small rowsin"><thead><tr><th>Use of the floor</th><th>Floor number(s) / level(s)</th><th>Height of the floor</th><th>Net floor area (sqm)</th><th>Gross floor area (sqm)</th></tr></thead><tbody>
   ${fl.map((f, i) => `<tr>${["use", "levels", "height", "nfa", "gfa"].map(c => `<td><input name="fl.${i}.${c}" value="${esc(f[c] ?? "")}"${dis} aria-label="${c} row ${i + 1}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>
   <p class="help">The form has three rows; the rest go on an additional sheet, as the form allows. Save to get more empty rows. Total GFA of the rows: ${fmtNum(r2((p.floors || []).reduce((t, f) => t + (Number(f.gfa) || 0), 0)))} sqm.</p></fieldset>${saveBtn(locked)}</form>`;
}
FORMS["dev-plan"] = async (form, o = {}) => {
  const p = Store.get("dev_projects", form.dataset.id), cdp = { items: {}, alloc: {}, prop: {} }, floors = [];
  CDP_ITEMS.forEach(([k]) => { const x = form.querySelector(`[name="it.${k}"]`); if (x && x.checked) cdp.items[k] = true; });
  CDP_PARAMS.forEach(([k]) => { const a = form.querySelector(`[name="al.${k}"]`), b = form.querySelector(`[name="pr.${k}"]`); if (a && a.value.trim()) cdp.alloc[k] = a.value.trim(); if (b && b.value.trim()) cdp.prop[k] = b.value.trim(); });
  if (cdp.prop.gfa && !Number.isFinite(Number(String(cdp.prop.gfa).replace(/,/g, "")))) throw ["Proposed gross floor area: enter a number of square metres."]; if (cdp.prop.gfa) cdp.prop.gfa = Number(String(cdp.prop.gfa).replace(/,/g, ""));
  for (let i = 0; i < 200; i++) { const r = {}; let any = false; for (const c of ["use", "levels", "height", "nfa", "gfa"]) { const x = form.querySelector(`[name="fl.${i}.${c}"]`); if (!x) { any = null; break; } if (x.value.trim()) { r[c] = x.value.trim(); any = true; } } if (any === null) break; if (any) floors.push(r); }
  if (JSON.stringify({ cdp, floors }) === JSON.stringify({ cdp: p.cdp, floors: p.floors })) { if (!o.silent) toast("No changes to save.", "info"); UI.typing = false; return; }
  await Store.save("dev_projects", { cdp, floors }, p.id); await Store.audit("dev_projects", p.id, "Updated", `Conceptual plan: ${floors.length} floor row(s), GFA ${cdp.prop.gfa || "not set"}`); UI.typing = false; if (!o.silent) { toast("Saved."); render(); }
};
function devCaa(p, locked) {
  const spec = CAA_SPEC.map(([k, l, t, sec, o]) => [k, l, t === "yn" ? "choice" : t, null, { sec, ch: t === "yn" ? YES_NO : undefined, sug: o.sug ? () => o.sug(p) : undefined }]);
  return `<div class="card"><p class="small">Civil Aviation Authority form CAA/AE/06/04 (i), listed on the Commission's Development Approvals page for high-rise structures. Submit with: a copy of the location's survey plan, a council-size drawing of the building plan showing height and elevation, a colour Google Earth printout with the location highlighted, and, if needed, an elevation report from a licensed surveyor.</p></div>
  <form class="f" data-form="dev-caa" data-id="${p.id}" data-autosave="1" novalidate>${specFieldsHTML({ kind: "change", d: p.caa || {} }, spec, null, locked, "d")}${saveBtn(locked)}</form>`;
}
FORMS["dev-caa"] = async (form, o = {}) => { const p = Store.get("dev_projects", form.dataset.id), caa = readSpec(form, CAA_SPEC.map(([k, l, t]) => [k, l, t === "yn" ? "choice" : t]), "d", p.caa || {}); await Store.save("dev_projects", { caa }, p.id); await Store.audit("dev_projects", p.id, "Updated", "CAA height clearance details"); UI.typing = false; if (!o.silent) { toast("Saved."); render(); } };
function devChecklist(p, locked) {
  const rows = devCheckRows(p), docs = Store.list("docs").filter(docVisible), dis = locked ? " disabled" : "";
  return DEV_STAGES.map(([st, l]) => `<div class="card"><h3>${esc(l)}</h3><div class="tw"><table class="t cl"><thead><tr><th>Document</th><th>Status</th><th>Stored document</th><th>Note</th></tr></thead><tbody>${rows.filter(r => r.st === st).map(r => `<tr class="${r.done ? "ok" : ""}"><td><b>${esc(r.t)}</b><div class="small muted">${esc(r.src)}</div>${r.gen ? '<span class="chip">Quayzen can prepare</span>' : ""}</td>
    <td><select data-change="dev-cl" data-id="${p.id}" data-k="${r.k}" data-f="status"${dis} aria-label="Status">${CL_STATUS.map(s => `<option${s === r.status ? " selected" : ""}>${s}</option>`).join("")}</select></td>
    <td><select data-change="dev-cl" data-id="${p.id}" data-k="${r.k}" data-f="doc_id"${dis} aria-label="Stored document"><option value="">—</option>${docs.map(d => `<option value="${d.id}"${d.id === r.e.doc_id ? " selected" : ""}>${esc(d.title.slice(0, 40))}</option>`).join("")}</select></td>
    <td><input value="${esc(r.e.note || "")}" data-change="dev-cl" data-id="${p.id}" data-k="${r.k}" data-f="note"${dis} aria-label="Note"></td></tr>`).join("")}</tbody></table></div></div>`).join("");
}
CHANGES["dev-cl"] = async el => { const p = Store.get("dev_projects", el.dataset.id), ck = clone(p.checklist || {}), e = ck[el.dataset.k] = ck[el.dataset.k] || {}, old = e[el.dataset.f] ?? null; e[el.dataset.f] = el.value || null; await Store.save("dev_projects", { checklist: ck }, p.id); await Store.audit("dev_projects", p.id, "Updated", `Checklist: ${el.dataset.k} ${el.dataset.f}`, [{ label: el.dataset.k + " " + el.dataset.f, old, new: e[el.dataset.f] }]); };
function devForms(p) {
  const outs = devOutputs(p), miss = devMissing(p);
  return `<div class="card"><h2>Forms and downloads</h2><p class="muted small">Each Commission form is filled field by field (highlighted button), with an editable Word copy. The project workbook is available in Excel, PDF and Word. Signatures and dates are left blank.</p>${miss.length ? `<p class="note small">${miss.length} detail(s) are still missing; the forms will have gaps.</p>` : ""}</div>
   ${[["pc", "Planning clearance"], ["dp", "Development permit"], ["all", "Whole project"]].map(([st, l]) => `<h3>${esc(l)}</h3><div class="ogrid">${outs.filter(x => x.st === st).map(x => `<div class="card tile"><b>${esc(x.t)}</b>${fmtButtons("dev-gen", `data-id="${p.id}" data-k="${x.k}"`, x.fmts, x.orig)}</div>`).join("")}</div>`).join("")}`;
}
ACTIONS["dev-gen"] = el => { const p = Store.get("dev_projects", el.dataset.id), x = devOutputs(p).find(o => o.k === el.dataset.k), f = el.dataset.f;
  return runAndSave(x.t, async () => f === x.orig && x.fn ? x.fn() : modelsToFiles(await x.model(), f), files => Store.audit("dev_projects", p.id, "Forms prepared", files.map(z => z.name).join(", ").slice(0, 280))); };

