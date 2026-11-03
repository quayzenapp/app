// @ts-nocheck
/* Port of the form filling in docs/artifact/src/lic_gen.js, kept close to the source. Server only.
   Fills the Commission's original files. Declarations, signatures and signature dates are never filled.
   `Store` must hold only what this role may see: restricted fields are stripped before this runs. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import JSZip from "jszip";
import * as PDFLib from "pdf-lib";
import { createLic, today } from "@/lib/lic/core";

const { DOMParser, XMLSerializer } = new JSDOM("").window;
const EXT = { s1: "pdf", s3: "pdf", s4: "pdf", s5: "pdf", s6: "pdf", o3: "pdf", o5: "pdf", ap_decl: "docx", ubo: "docx", ds: "docx", bprofile: "docx", tef: "xlsx" };
const libs = { pdflib: async () => PDFLib, jszip: async () => JSZip };
const fmtDate = (s) => (s ? new Date(String(s)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const r2 = (n) => Math.round(n * 100) / 100;
const fmtNum = (v) => (v == null ? "" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 }));
const fmtMoney = (v) => (v == null ? "" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtK = fmtNum;
const docxToModel = () => { throw new Error("Editable copies aren't built yet."); };
export async function formBytes(key) {
  if (!EXT[key]) throw new Error(`Unknown form ${key}`);
  return new Uint8Array(await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "assets/forms", `${key}.${EXT[key]}`)));
}

export function createGen(Store: any): any {
const lic = createLic(Store);
const { APP_FMAP, APP_LOCKED, APP_SPEC, APP_STAGES, APP_STATUS, APP_STEPS, APP_TYPES, CHECKLIST, CL_STATUS, FILING_KINDS, FILING_STATUS, FUND_MODES, LEGAL_FOREIGN, LEGAL_LOCAL, MARKS, MP_ROWS, PERSON_FMAP, PERSON_GROUP_LABELS, PERSON_SPEC, PROFILE_LABELS, ROLE, S1_SECTORS, S3_ITEMS, TEF_PAIR_LABELS, TEF_ROWS, addMonthsDay, af, appOf, appPeople, appReadiness, checklistRows, companyCurrent, ddmmyyyy, fdiSuggestion, filled, getPath, hasRole, isCo, personGroups, personMissing, personParts, pf, setPath, stepMissing, tefSheet, tefSum, tefTotals, tefVal, STATUS_FIELDS, ENTITY_TYPES, STEP_INTRO } = lic;
const FORM_SRC = { s1: "Schedule I - Application for licence", s3: "Schedule III - Notice of change", s4: "Schedule IV - Annual return", s5: "Schedule V - Renewal", s6: "Schedule VI - Surrender",
  o3: "Offshore Form III - Changes to particulars", o5: "Offshore Form V - Notice to cease business", ap_decl: "AP Declaration", ubo: "UBO Declaration", ds: "Information of Directors and Shareholders",
  bprofile: "Business Profile and KMP Information", tef: "Technical Evaluation Form" };
const fileSafe = s => String(s || "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

/* ---------- PDF filling ---------- */
const UNI = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", "•": "-", " ": " ", "−": "-", "­": "" };
function pdfSafe(font, s, bad) {
  s = String(s ?? "").replace(/[‘’“”–—…• −­]/g, c => UNI[c]).replace(/\r/g, "");
  let out = "";
  for (const ch of s) { if (ch === "\n") { out += ch; continue; } try { font.widthOfTextAtSize(ch, 10); out += ch; } catch (e) { out += "?"; bad.add(ch); } }
  return out;
}
function wrapLines(font, text, size, width) {
  const lines = [];
  for (const para of String(text).split("\n")) {
    let cur = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = cur ? cur + " " + word : word;
      if (font.widthOfTextAtSize(t, size) <= width) cur = t;
      else { if (cur) lines.push(cur); cur = word; while (font.widthOfTextAtSize(cur, size) > width && cur.length > 1) { let i = cur.length - 1; while (i > 1 && font.widthOfTextAtSize(cur.slice(0, i), size) > width) i--; lines.push(cur.slice(0, i)); cur = cur.slice(i); } }
    }
    lines.push(cur);
  }
  return lines;
}
/* Largest font size (10 down to 6) at which the text fits the box; multiline when the box is tall enough */
function fitText(font, text, w, h) {
  const iw = w - 4, ih = h - 2;
  if (!text.includes("\n")) for (let s = 10; s >= 6; s -= 0.5) if (s * 1.15 <= ih && font.widthOfTextAtSize(text, s) <= iw) return { size: s, multi: false };
  for (let s = 10; s >= 5.5; s -= 0.5) { const n = wrapLines(font, text, s, iw - 2).length; if (n > 1 && n * s * 1.18 <= ih) return { size: s, multi: true }; }
  return null;
}
/* values: {fieldName: text}; checks: {fieldName: true}; items: {fieldName: "label for continuation"} */
async function fillPdfForm(key, values, checks, opts = {}) {
  const PDFLib = await libs.pdflib(), pdf = await PDFLib.PDFDocument.load(await formBytes(key)), form = pdf.getForm(), font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
  const problems = [], cont = [], bad = new Set(), written = {};
  for (const [k, raw] of Object.entries(values)) {
    if (raw == null || raw === "") continue;
    let f; try { f = form.getTextField(k); } catch (e) { problems.push(`${k}: field not found`); continue; }
    let text = pdfSafe(font, raw, bad);
    const r = f.acroField.getWidgets()[0].getRectangle(); let fit = fitText(font, text, r.width, r.height);
    if (!fit) { const lab = (opts.items || {})[k] || k; cont.push([lab, text]); text = "See continuation sheet"; fit = fitText(font, text, r.width, r.height) || { size: 6, multi: false }; }
    try { if (fit.multi) f.enableMultiline(); try { f.setFontSize(fit.size); } catch (e) { f.acroField.setDefaultAppearance(`/Helv ${fit.size} Tf 0 g`); } f.setText(text); written[k] = text; } catch (e) { problems.push(`${k}: could not write the value`); }
  }
  for (const [k, on] of Object.entries(checks)) { if (!on) continue; try { form.getCheckBox(k).check(); } catch (e) { problems.push(`${k}: tick box not found`); } }
  for (const [k, v] of Object.entries(opts.radios || {})) { if (!v) continue; try { form.getRadioGroup(k).select(v); } catch (e) { problems.push(`${k}: could not choose '${v}'`); } }
  for (const [k, v] of Object.entries(opts.selects || {})) { if (!v) continue; try { form.getDropdown(k).select(v); } catch (e) { problems.push(`${k}: could not choose '${v}'`); } }
  form.updateFieldAppearances(font);
  const out = await pdf.save();
  const back = (await PDFLib.PDFDocument.load(out)).getForm();
  for (const [k, v] of Object.entries(written)) { try { const got = back.getTextField(k).getText() || ""; if (got !== v) problems.push(`${k}: saved '${got.slice(0, 30)}' but expected '${v.slice(0, 30)}'`); } catch (e) { problems.push(`${k}: not readable after saving`); } }
  for (const [k, on] of Object.entries(checks)) { if (!on) continue; try { if (!back.getCheckBox(k).isChecked()) problems.push(`${k}: tick not kept`); } catch (e) { } }
  for (const [k, v] of Object.entries(opts.radios || {})) { if (!v) continue; try { if (back.getRadioGroup(k).getSelected() !== v) problems.push(`${k}: choice not kept`); } catch (e) { } }
  for (const [k, v] of Object.entries(opts.selects || {})) { if (!v) continue; try { if (back.getDropdown(k).getSelected()[0] !== v) problems.push(`${k}: choice not kept`); } catch (e) { } }
  for (const k of opts.never || []) { try { const f = back.getField(k); if (f instanceof PDFLib.PDFCheckBox && f.isChecked()) problems.push(`${k}: should not be ticked`); if (f instanceof PDFLib.PDFTextField && f.getText()) problems.push(`${k}: should be blank`); } catch (e) { } }
  if (bad.size) problems.push(`Characters the form's font cannot show were replaced with '?': ${[...bad].join(" ")}`);
  return { bytes: out, problems, cont, filled: Object.keys(written).length, ticked: Object.values(checks).filter(Boolean).length, fields: back.getFields().length };
}
/* Continuation sheet for text that does not fit (plain A4 PDF) */
async function continuationPdf(title, who, entries) {
  const J = await libs.jspdf(), doc = new J({ unit: "pt", format: "a4" }), W = 515; let y = 60;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(title, 40, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Applicant: ${who}`, 40, y); y += 14; doc.text("Continuation sheet - text that does not fit in the boxes of the form.", 40, y); y += 22;
  for (const [lab, text] of entries) {
    const lines = doc.splitTextToSize(String(text), W);
    if (y + 30 > 800) { doc.addPage(); y = 50; }
    doc.setFont("helvetica", "bold"); doc.text(String(lab), 40, y); y += 14; doc.setFont("helvetica", "normal");
    for (const l of lines) { if (y > 800) { doc.addPage(); y = 50; } doc.text(l, 40, y); y += 13; }
    y += 10;
  }
  return doc.output("blob");
}
const nums = (pre, a, b, step = 1) => { const o = []; for (let i = a; i <= b; i += step) o.push(pre + i); return o; };
const T = n => "Text" + n, C = n => "Check Box" + n;
function splitLines(s, n) {
  const ls = String(s || "").split(/\n+/).map(x => x.trim()).filter(Boolean); if (ls.length <= n) return ls;
  return [...ls.slice(0, n - 1), ls.slice(n - 1).join(", ")];
}
const markOr = (obj, k, v) => filled(v) ? v : ((obj.marks || {})[k] || null);

/* ---------- Schedule I ---------- */
const S1 = {
  sh: { name: [...nums("Text", 56, 62), T(84), T(85), T(86)], country: [...nums("Text", 63, 69), T(87), T(88), T(89)], id: [...nums("Text", 70, 76), T(90), T(91), T(92)], pct: [...nums("Text", 77, 83), T(93), T(94), T(95)] },
  dir: Array.from({ length: 10 }, (_, i) => [T(96 + i * 4), T(97 + i * 4), T(98 + i * 4), T(99 + i * 4)]),
  p3cap: [[25, 26, 27, 28], [29, 30, 31, 32], [33, 34, 35, 36]], p3perf: [[39, 40, 41, 150], [151, 152, 153, 154], [156, 157, 158, 159]],
  p3hold: Array.from({ length: 13 }, (_, i) => [160 + i * 3, 161 + i * 3, 162 + i * 3]), p3board: [...Array.from({ length: 7 }, (_, i) => [199 + i * 3, 200 + i * 3, 201 + i * 3]), [220, 221, 222], [223, 224, 225], [226, 227, 228]],
  p4bank: [[233, 234, 235, 236], [244, 245, 246, 249], [250, 251, 252, 253]],
  never: [...nums("Check Box", 148, 154), ...nums("Check Box", 325, 333), "Text324"],
};
function s1Base(a, people, o, part) {
  const v = {}, c = {}, items = {}, notes = [], put = (k, val, lab) => { if (filled(val)) { v[k] = String(val); if (lab) items[k] = lab; } };
  const g = k => markOr(a, k, getPath(a, k));
  put("Text1", g("p1.name"), "Part I(a) Name of applicant");
  if (part) return { v, c, items, notes };
  splitLines(g("p1.address"), 3).forEach((l, i) => put(T(2 + i), l, "Part I(b) Address"));
  put("Text5", g("p1.country"), "Part I(c) Country"); put("Text6", g("p1.tel")); put("Text7", g("p1.email"));
  const lp = (a.origin === "Local" ? { "Natural Person": 7, "General Partnership": 8, Company: 9 } : { "Natural Person": 11, "General Partnership": 12, "Limited Partnership": 13, "Limited Liability Partnership": 14, Company: 15, Foundation: 16 })[a.legal];
  if (lp) c[C(lp)] = true; else notes.push("Legal personality not chosen, so Part I(e) is not ticked.");
  (getPath(a, "p2.sectors") || []).forEach(s => { const i = S1_SECTORS.indexOf(s); if (i >= 0) c[C(17 + i)] = true; });
  put("Text37", getPath(a, "p2.sector_other"), "Part II(a) Other sector");
  put("Text38", g("p2.description"), "Part II(b) Description of the business activities");
  if (getPath(a, "p2.loc_within")) { c[C(40)] = true; splitLines(getPath(a, "p2.loc_within_addr"), 3).forEach((l, i) => put(T(42 + i), l, "Part II(c) Address in Port City")); }
  if (getPath(a, "p2.loc_desig")) { c[C(41)] = true; splitLines(getPath(a, "p2.loc_desig_addr"), 3).forEach((l, i) => put(T(45 + i), l, "Part II(c) Designated location address")); }
  const money = x => x == null || x === "" ? x : typeof x === "number" ? fmtNum(x) : x;
  [["fdi", 48], ["lkr", 52]].forEach(([p, n]) => { put(T(n), g(`p2.${p}_currency`)); put(T(n + 1), money(g(`p2.${p}_quantum`))); put(T(n + 2), g(`p2.${p}_mode`)); put(T(n + 3), g(`p2.${p}_source`), `Part II(d) ${p === "fdi" ? "FDI" : "Other investments"} - source`); });
  const sh = people.filter(p => hasRole(p, "sh")).sort((x, y) => (Number(y.shareholding_pct) || 0) - (Number(x.shareholding_pct) || 0));
  sh.slice(0, 10).forEach((p, i) => { put(S1.sh.name[i], p.name, "Part II(e) Shareholder name"); put(S1.sh.country[i], [p.nationality, p.address].filter(Boolean).join(", "), `Part II(e) ${p.name} - country and address`); put(S1.sh.id[i], markOr(p, "id_no", p.id_no)); put(S1.sh.pct[i], p.shareholding_pct != null ? fmtNum(p.shareholding_pct) + "%" : null); });
  if (sh.length > 10) notes.push(`${sh.length - 10} shareholder(s) beyond the ten largest are on the continuation sheet.`);
  const dirs = people.filter(p => hasRole(p, "dir"));
  dirs.slice(0, 10).forEach((p, i) => { const [n, na, id, pos] = S1.dir[i]; put(n, p.name, "Part II(f) Name"); put(na, [p.nationality, p.address].filter(Boolean).join(", "), `Part II(f) ${p.name} - nationality and address`); put(id, markOr(p, "id_no", p.id_no)); put(pos, p.position, `Part II(f) ${p.name} - position`); });
  if (dirs.length > 10) notes.push(`${dirs.length - 10} member(s) of the board / key management beyond ten are on the continuation sheet.`);
  put("Text136", g("p2.signatory")); put("Text137", g("p2.contact"));
  put("Text138", g("p2.sup_name"), "Part II(h) Supervisory authority"); splitLines(g("p2.sup_address"), 3).forEach((l, i) => put(T(139 + i), l, "Part II(h) Address of regulator"));
  put("Text142", g("p2.sup_official")); put("Text143", g("p2.sup_designation")); put("Text145", g("p2.sup_phone")); put("Text146", g("p2.sup_email"));
  const oi = g("p2.other_info"); if (oi) put("Text147", oi, "Part II(i) Other information");
  put("Text334", g("p6.objective"), "Part VI(a) Objective of establishment"); put("Text335", g("p6.products"), "Part VI(b) Products / services"); put("Text336", g("p6.target_market"), "Part VI(c) Target market");
  put("Text337", g("p6.strategy"), "Part VI(d) Business operational and strategic plan"); put("Text338", g("p6.controls"), "Part VI(e) Internal policies and controls");
  const mp = getPath(a, "p6.mp") || {}; let tl = 0, tn = 0;
  [["mp", 339], ["ts", 343], ["sk", 347], ["us", 351], ["cg", 355]].forEach(([k, n]) => { const r = mp[k] || {}; if (filled(r.local) || filled(r.nonlocal)) { put(T(n), r.local ?? 0); put(T(n + 1), r.nonlocal ?? 0); put(T(n + 2), (Number(r.local) || 0) + (Number(r.nonlocal) || 0)); tl += Number(r.local) || 0; tn += Number(r.nonlocal) || 0; } put(T(n + 3), r.remun, "Part VI(f) Expected remuneration"); });
  if (tl || tn) { put("Text359", tl); put("Text360", tn); put("Text361", tl + tn); } put("Text362", getPath(a, "p6.mp_total_remun"));
  if (o.ticks) { // Part VII: tick only documents marked Ready
    const rows = checklistRows(a), ready = (k, f) => { const rs = rows.filter(r => r.it.k === k && (!f || f(r))); return rs.length > 0 && rs.every(r => r.status === "Ready"); };
    const shIds = new Set(sh.filter(p => p.kind !== "Corporate").map(p => p.id)), dirIds = new Set(dirs.filter(p => p.kind !== "Corporate").map(p => p.id));
    Object.assign(c, { [C(343)]: ready("corp_coi"), [C(344)]: ready("passports", r => shIds.has(r.key.split(":")[1])), [C(345)]: ready("passports", r => dirIds.has(r.key.split(":")[1])), [C(346)]: ready("res_signatory") });
    if (isCo(a)) Object.assign(c, { [C(347)]: ready("form_i"), [C(348)]: ready("constitution"), [C(351)]: ready("coi"), [C(352)]: ready("res_impediment") });
  }
  return { v, c, items, notes, sh, dirs };
}
function s1Part3(p, R) {
  const put = (k, val, lab) => { if (filled(val)) { R.v[k] = String(val); if (lab) R.items[k] = lab; } }, m = (k) => markOr(p, k, p[k]);
  put("Text155", p.name, "Part III(a) Name"); splitLines(p.address, 3).forEach((l, i) => put(T(8 + i), l, "Part III(b) Company address"));
  const nat = String(m("c_nature") || ""); if (nat) { const ls = wrapPlain(nat, 2); ls.forEach((l, i) => put(T(11 + i), l, "Part III(c) Nature and type of business")); }
  put("Text13", m("id_no")); put("Text14", ddmmyyyy(p.c_inc_date) || m("c_inc_date")); put("Text15", m("c_inc_place"));
  put("Text16", ddmmyyyy(p.c_lic_date) || m("c_lic_date")); put("Text17", m("c_lic_type")); put("Text18", m("c_lic_no"));
  put("Text19", m("c_sup_name")); splitLines(p.c_sup_address, 3).forEach((l, i) => put(T(20 + i), l)); put("Text23", m("c_sup_tel")); put("Text24", m("c_sup_email"));
  (p.c_capital || []).slice(0, 3).forEach((r, i) => S1.p3cap[i].forEach((n, j) => put(T(n), r[["year", "capital", "retained", "other"][j]])));
  (p.c_perf || []).slice(0, 3).forEach((r, i) => S1.p3perf[i].forEach((n, j) => put(T(n), r[["year", "assets", "liabilities", "pbt"][j]])));
  (p.c_holders || []).slice(0, 13).forEach((r, i) => S1.p3hold[i].forEach((n, j) => put(T(n), r[["name", "country", "pct"][j]])));
  (p.c_board || []).slice(0, 10).forEach((r, i) => S1.p3board[i].forEach((n, j) => put(T(n), r[["name", "nationality", "nature"][j]])));
}
function wrapPlain(s, n) { const w = String(s).split(/\s+/), per = Math.ceil(w.length / n), out = []; for (let i = 0; i < n; i++) { const x = w.slice(i * per, (i + 1) * per).join(" "); if (x) out.push(x); } return out; }
function s1Part45(p, R, part) {
  const put = (k, val, lab) => { if (filled(val)) { R.v[k] = String(val); if (lab) R.items[k] = lab; } }, m = k => markOr(p, k, p[k]);
  const g = { Male: part === "IV" ? 233 : 318, Female: part === "IV" ? 235 : 319, Other: part === "IV" ? 236 : 320 }[p.gender];
  if (part === "IV") {
    put("Text229", m("title")); put("Text230", p.name); put("Text231", ddmmyyyy(p.dob) || m("dob")); put("Text232", m("pob")); put("Text237", p.nationality);
    put("Text238", m("nic")); put("Text239", m("passport_no")); put("Text240", ddmmyyyy(p.passport_expiry) || m("passport_expiry")); put("Text241", m("passport_country")); put("Text242", m("passport_authority")); put("Text243", m("residence_length"));
    if (p.work_permit) R.c[C(p.work_permit === "Yes" ? 244 : 245)] = true;
    put("Text247", m("nw_assets")); put("Text248", m("nw_liabilities"));
    (p.banks || []).slice(0, 3).forEach((r, i) => S1.p4bank[i].forEach((n, j) => put(T(n), r[["bank", "type", "date", "amount"][j]])));
    const e = (p.cv_edu || [])[0] || {}; put("Text254", e.type); put("Text255", e.inst); put("Text256", e.year);
    (p.cv_prof || []).slice(0, 3).forEach((r, i) => { put(T(257 + i), r.type); put(T(260 + i), r.inst); put(T(263 + i), r.year); });
    (p.cv_memb || []).slice(0, 3).forEach((r, i) => { put(T(266 + i * 3), r.type); put(T(267 + i * 3), r.inst); put(T(268 + i * 3), r.year); });
    (p.cv_work || []).slice(0, 3).forEach((r, i) => { put(T(275 + i), r.from); put(T(278 + i), r.to); put(T(281 + i), r.employer); put(T(284 + i), r.designation); put(T(287 + i), r.resp, "Part IV(i) Key responsibilities"); });
    (p.cv_dirs || []).slice(0, 4).forEach((r, i) => { put(T(290 + i), r.company); put(T(294 + i), r.place); put(T(298 + i), r.date); put(T(302 + i), r.nature); });
  } else {
    put("Text306", p.position); put("Text307", m("title")); put("Text308", p.name); put("Text309", ddmmyyyy(p.dob) || m("dob")); put("Text310", m("pob")); put("Text311", p.nationality);
    put("Text312", m("nic")); put("Text313", m("passport_no")); put("Text314", ddmmyyyy(p.passport_expiry) || m("passport_expiry")); put("Text315", m("passport_country")); put("Text316", m("passport_authority")); put("Text317", m("residence_length"));
    if (p.work_permit) R.c[C(p.work_permit === "Yes" ? 321 : 322)] = true;
  }
  if (g) R.c[C(g)] = true;
}
/* Returns [{name, blob, summary}] : the main form, one extra copy per additional Part III/IV/V profile, and a continuation sheet if needed */
async function buildSchedule1(a, o = {}) {
  if (!Store.canSee("personal") || !Store.canSee("id")) throw ["Schedule I needs names, addresses and passport details, which your role cannot see. Ask an administrator or compliance officer to prepare it."];
  const people = appPeople("app_id", a.id), opts = Object.assign({ ticks: true, na: true }, o);
  const R = s1Base(a, people, opts), files = [], allCont = [], who = getPath(a, "p1.name") || Store.company().name;
  const p3 = people.filter(p => personParts(p, a).includes("III")), p4 = people.filter(p => personParts(p, a).includes("IV")), p5 = people.filter(p => personParts(p, a).includes("V"));
  if (p3[0]) s1Part3(p3[0], R); else if (opts.na) R.v.Text155 = isCo(a) ? "Not applicable - the applicant is a company (Part II(e))" : "Not applicable - no corporate members";
  if (p4[0]) s1Part45(p4[0], R, "IV"); else if (opts.na) R.v.Text230 = isCo(a) ? "Not applicable - the applicant is a company (Part II(e))" : "Not applicable - no individual members";
  if (p5[0]) s1Part45(p5[0], R, "V");
  const extra = []; // shareholders/directors beyond 10
  R.sh.slice(10).forEach(p => extra.push(["Part II(e) Shareholder", `${p.name}; ${[p.nationality, p.address].filter(Boolean).join(", ")}; ${p.id_no || ""}; ${p.shareholding_pct ?? ""}%`]));
  R.dirs.slice(10).forEach(p => extra.push(["Part II(f) Board / key management member", `${p.name}; ${[p.nationality, p.address].filter(Boolean).join(", ")}; ${p.id_no || ""}; ${p.position || ""}`]));
  const main = await fillPdfForm("s1", R.v, R.c, { items: R.items, never: S1.never });
  allCont.push(...main.cont, ...extra);
  files.push({ name: `Schedule_I_Application_${fileSafe(who)}.pdf`, blob: new Blob([main.bytes], { type: "application/pdf" }), check: main, notes: R.notes });
  const more = [...p3.slice(1).map(p => ["III", p]), ...p4.slice(1).map(p => ["IV", p]), ...p5.slice(1).map(p => ["V", p])];
  for (const [part, p] of more) {
    const X = s1Base(a, people, opts, true); if (part === "III") s1Part3(p, X); else s1Part45(p, X, part);
    const r = await fillPdfForm("s1", X.v, X.c, { items: X.items, never: S1.never }); allCont.push(...r.cont.map(([l, t]) => [`${p.name}: ${l}`, t]));
    files.push({ name: `Schedule_I_Part_${part}_${fileSafe(p.name)}.pdf`, blob: new Blob([r.bytes], { type: "application/pdf" }), check: r, notes: [`Extra copy of the form with only Part ${part} filled, for ${p.name}.`] });
  }
  if (allCont.length) files.push({ name: `Schedule_I_continuation_sheet_${fileSafe(who)}.pdf`, blob: await continuationPdf("Schedule I - Application for licence", who, allCont), notes: [`${allCont.length} item(s) did not fit in the form's boxes.`] });
  return files;
}

/* ---------- smaller PDF forms, driven by specs shared with the filing screens ---------- */
/* spec entry: [key, label, type, pdf, opts]. pdf is a field name, a list of line fields, {dmy:[d,m,y]}, or {check:name}. */
async function fillSpecForm(key, spec, data, extra = {}) {
  const v = Object.assign({}, extra.v || {}), c = Object.assign({}, extra.c || {}), items = {};
  for (const [k, l, t, pdf, op = {}] of spec) {
    if (!pdf || op.never) continue;
    const val = getPath(data, k);
    if (pdf.check) { if (val) c[pdf.check] = true; continue; }
    if (!filled(val)) continue;
    if (pdf.dmy) { if (/^\d{4}-\d{2}-\d{2}$/.test(val)) { v[pdf.dmy[0]] = val.slice(8, 10); v[pdf.dmy[1]] = val.slice(5, 7); v[pdf.dmy[2]] = op.yy ? val.slice(2, 4) : val.slice(0, 4); } continue; }
    const txt = t === "date" ? ddmmyyyy(val) : t === "num" ? fmtNum(val) : String(val);
    if (Array.isArray(pdf)) splitLines(txt, pdf.length).forEach((x, i) => { v[pdf[i]] = x; items[pdf[i]] = l; });
    else { v[pdf] = txt; items[pdf] = l; }
  }
  return fillPdfForm(key, v, c, { items, never: extra.never || [] });
}

/* ---------- Word forms (edited inside the original file) ---------- */
const WNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
async function docxOpen(key) {
  const JSZip = await libs.jszip(), zip = await JSZip.loadAsync(await formBytes(key));
  const text = new TextDecoder("utf-8").decode(await zip.file("word/document.xml").async("uint8array")).replace(/^\uFEFF/, ""); // drops a byte-order mark
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length || doc.documentElement.localName !== "document") throw new Error(`The ${FORM_SRC[key]} file could not be read, so it was not filled.`);
  return { zip, doc };
}
async function docxSave(d) { d.zip.file("word/document.xml", new XMLSerializer().serializeToString(d.doc)); return d.zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 }, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }); }
const wkids = (el, tag) => [...el.childNodes].filter(n => n.nodeType === 1 && n.localName === tag);
const wtables = doc => [...doc.getElementsByTagNameNS(WNS, "tbl")];
const wrows = tbl => wkids(tbl, "tr"), wcells = tr => wkids(tr, "tc");
function wSetCell(tc, text) {
  const ps = wkids(tc, "p"), p = ps[0]; ps.slice(1).forEach(x => x.remove());
  const runs = wkids(p, "r"), rPr = (runs[0] && wkids(runs[0], "rPr")[0]) || null;
  [...p.childNodes].filter(n => n.nodeType === 1 && n.localName !== "pPr").forEach(n => n.remove());
  const doc = tc.ownerDocument, r = doc.createElementNS(WNS, "w:r");
  if (rPr) { const x = rPr.cloneNode(true); if (!/^[☐☒]$/.test(String(text))) wkids(x, "i").concat(wkids(x, "iCs"), wkids(x, "color")).forEach(n => n.remove()); r.appendChild(x); } // drop the grey italic of "e.g." hint text
  String(text ?? "").split("\n").forEach((line, i) => { if (i) r.appendChild(doc.createElementNS(WNS, "w:br")); const t = doc.createElementNS(WNS, "w:t"); t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve"); t.textContent = line; r.appendChild(t); });
  p.appendChild(r);
}
/* Replace the n-th occurrence of a placeholder inside a paragraph, even when Word split it across runs */
function wReplace(p, find, repl) {
  const ts = [...p.getElementsByTagNameNS(WNS, "t")], full = ts.map(t => t.textContent).join(""), idx = full.indexOf(find);
  if (idx < 0) return false;
  let pos = 0, end = idx + find.length, first = true;
  for (const t of ts) {
    const s = pos, e = pos + t.textContent.length; pos = e;
    if (e <= idx || s >= end) continue;
    const a = Math.max(idx, s) - s, b = Math.min(end, e) - s, txt = t.textContent;
    t.textContent = txt.slice(0, a) + (first ? repl : "") + txt.slice(b); t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve"); first = false;
  }
  return true;
}
const wParas = doc => [...doc.getElementsByTagNameNS(WNS, "p")];
const wParaWith = (doc, s) => wParas(doc).find(p => [...p.getElementsByTagNameNS(WNS, "t")].map(t => t.textContent).join("").includes(s));
const oneLine = s => String(s || "").replace(/\s*\n\s*/g, ", ").trim();

async function buildApDeclaration(a, o = {}) {
  const d = await docxOpen("ap_decl"), name = getPath(a, "p1.name"), addr = oneLine(getPath(a, "p1.address")), D = a.decl || {}, notes = [];
  if (!name) throw ["Enter the applicant's name on the Applicant step first."];
  const p1 = wParaWith(d.doc, "hereinafter referred to as"); if (p1) { wReplace(p1, "[…]", name); if (addr) wReplace(p1, "[…]", addr); else notes.push("Applicant address is blank."); }
  const ps = wParaWith(d.doc, "[AP Name to be inserted]"); if (ps) wReplace(ps, "[AP Name to be inserted]", name);
  for (const dn of [D.director1, D.director2]) { const pd = wParaWith(d.doc, "[Name of Director]"); if (pd && dn) wReplace(pd, "[Name of Director]", dn); }
  if (!D.director1) notes.push("No directors named, so '[Name of Director]' is left for you to complete.");
  if ((a.q || {}).group_sl === "Yes") {
    const pp = wParaWith(d.doc, "being the Parent of the Applicant"); if (pp && D.parent_name) { wReplace(pp, "[...]", D.parent_name) || wReplace(pp, "[…]", D.parent_name); if (D.parent_address) wReplace(pp, "[…]", oneLine(D.parent_address)); }
    const pa = wParaWith(d.doc, "shall mean […] of […]"); if (pa) { wReplace(pa, "[…]", name); if (addr) wReplace(pa, "[…]", addr); }
    if (!D.parent_name) notes.push("Parent company name is blank in Annexure I.");
  } else notes.push("Annexure I (Declaration of Parent) is left as it is, because you said no group company has business in Sri Lanka outside Port City.");
  notes.push("Signatures and dates are left blank.");
  if (o.model) return [{ name: `AP_Declaration_copy_${fileSafe(name)}`, model: docxToModel(d, "Declaration of the Applicant (AP Declaration)", "AP Declaration"), notes }];
  return [{ name: `AP_Declaration_${fileSafe(name)}.docx`, blob: await docxSave(d), notes }];
}
async function buildUboDeclarations(a, o = {}) {
  if (!Store.canSee("ubo")) throw ["Your role cannot see beneficial ownership details."];
  const owners = Store.list("ubo"); if (!owners.length) throw ["Add the beneficial owners in Company Profile first."];
  const pr = (a.decl || {}).presenter || {}, out = [];
  for (const u of owners) {
    const d = await docxOpen("ubo"), [t0, t1, t2] = wtables(d.doc), set = (t, r, val) => { const c = wcells(wrows(t)[r])[1]; if (c && filled(val)) wSetCell(c, val); };
    set(t0, 0, getPath(a, "q.reg_no")); set(t0, 1, getPath(a, "p1.name")); set(t0, 2, getPath(a, "q.co_type"));
    [u.full_name, u.previous_name, ddmmyyyy(u.date_of_birth), u.place_of_birth, u.nationality, u.country_of_residence, u.residential_address, u.business_address, u.last_known_address, u.postal_address, u.email, null, u.nic_number, u.tin, u.passport_number, u.nature_extent].forEach((val, i) => { if (i !== 11) set(t1, i, val); });
    if (u.mobile) set(t1, 11, `Mobile: ${u.mobile}`);
    [pr.name, pr.capacity, pr.email, pr.tel, pr.mobile, pr.address].forEach((val, i) => set(t2, i, val));
    if (o.model) { out.push({ name: `UBO_Declaration_copy_${fileSafe(u.full_name)}`, model: docxToModel(d, `Beneficial Ownership Declaration - ${u.full_name}`, "UBO Declaration") }); continue; }
    out.push({ name: `UBO_Declaration_${fileSafe(u.full_name)}.docx`, blob: await docxSave(d), notes: ["Print on company letterhead. The beneficial owner and the presenter sign and date it."] });
  }
  return out;
}
async function buildDsInfo(a, o = {}) {
  const ps = appPeople("app_id", a.id).filter(p => hasRole(p, "sh") || hasRole(p, "dir")); if (!ps.length) throw ["Add directors and shareholders on the People step first."];
  const d = await docxOpen("ds"), t = wtables(d.doc)[0], rows = wrows(t);
  while (wrows(t).length - 1 < ps.length) t.appendChild(rows[rows.length - 1].cloneNode(true));
  const data = wrows(t).slice(1);
  data.forEach((tr, i) => { const p = ps[i], cs = wcells(tr); if (!p) { cs.slice(1).forEach(c => wSetCell(c, "")); return; }
    const role = hasRole(p, "sh") && hasRole(p, "dir") ? "Director and shareholder" : hasRole(p, "dir") ? "Director" : "Shareholder";
    [String(i + 1), role, p.name, markOr(p, "other_businesses", p.other_businesses) || "", markOr(p, "jurisdictions", p.jurisdictions) || "", markOr(p, "years_operation", p.years_operation) || "", p.other_details || ""].forEach((v, j) => cs[j] && wSetCell(cs[j], v)); });
  if (o.model) return [{ name: `Directors_and_Shareholders_copy_${fileSafe(getPath(a, "p1.name"))}`, model: Object.assign(docxToModel(d, "Information of Directors and Shareholders", "Information of Directors and Shareholders form"), { sheet: "Directors and shareholders" }) }];
  return [{ name: `Directors_and_Shareholders_${fileSafe(getPath(a, "p1.name"))}.docx`, blob: await docxSave(d), notes: [`${ps.length} director(s) and shareholder(s) listed.`] }];
}
async function buildBusinessProfile(a, o = {}) {
  const d = await docxOpen("bprofile"), tb = wtables(d.doc), p = a.prof || {}, par = p.parent || {}, cl = a.checklist || {}, notes = [];
  const set = (t, r, c, v) => { const row = wrows(tb[t])[r], cell = row && wcells(row)[c]; if (cell) wSetCell(cell, v ?? ""); };
  set(0, 1, 1, p.sectors); set(0, 2, 1, p.years_exp);
  const ents = (p.entities || []).filter(e => e.name); const t1 = tb[1]; while (wrows(t1).length - 1 < ents.length) t1.appendChild(wrows(t1)[wrows(t1).length - 1].cloneNode(true));
  ents.forEach((e, i) => { const certOk = e.type === "Applicant" ? ((cl.coi || {}).status === "Ready") : (((cl[`assoc_coi:e${(p.entities || []).indexOf(e)}`] || {}).status) === "Ready"); [e.name, e.country, e.type, e.years, certOk ? "☒" : "☐"].forEach((v, j) => set(1, i + 1, j, v)); });
  set(2, 1, 1, p.countries); set(2, 2, 1, p.segments); set(2, 3, 1, p.client_sectors);
  const kmp = appPeople("app_id", a.id).filter(x => hasRole(x, "kmp")), t3 = tb[3]; while (wrows(t3).length - 1 < kmp.length) t3.appendChild(wrows(t3)[wrows(t3).length - 1].cloneNode(true));
  kmp.forEach((k, i) => [k.name, k.designation_pc, k.years_sector != null ? String(k.years_sector) : "", ((cl["cvs:" + k.id] || {}).status === "Ready") ? "☒" : "☐"].forEach((v, j) => set(3, i + 1, j, v)));
  if (par.sectors || par.years_exp || par.employees) { set(4, 1, 1, par.sectors); set(4, 2, 1, par.years_exp); set(5, 1, 1, par.employees); set(6, 1, 1, par.countries); set(6, 2, 1, par.segments); set(6, 3, 1, par.client_sectors); }
  else notes.push("Part 2 (parent or associated entity) is left blank.");
  notes.push("Boxes for certificates and CVs are ticked only where the Documents list shows them as Ready.");
  if (o.model) return [{ name: `Business_Profile_and_KMP_copy_${fileSafe(getPath(a, "p1.name"))}`, model: docxToModel(d, "Business Profile and Key Management Personnel Information", "Business Profile and KMP form"), notes }];
  return [{ name: `Business_Profile_and_KMP_${fileSafe(getPath(a, "p1.name"))}.docx`, blob: await docxSave(d), notes }];
}

/* ---------- Technical Evaluation Form (Excel) ---------- */
const xesc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function xSetCell(xml, ref, val) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`);
  const m = xml.match(re); if (!m) return { xml, ok: false };
  const attrs = m[1].replace(/\s+t="[^"]*"/, "");
  const body = typeof val === "number" ? `<c r="${ref}"${attrs}><v>${val}</v></c>` : `<c r="${ref}"${attrs} t="inlineStr"><is><t xml:space="preserve">${xesc(val)}</t></is></c>`;
  return { xml: xml.replace(re, body), ok: true };
}
const colL = i => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
async function buildTef(a) {
  const JSZip = await libs.jszip(), zip = await JSZip.loadAsync(await formBytes("tef")), primary = tefSheet(a) === "primary", path = `xl/worksheets/sheet${primary ? 2 : 1}.xml`;
  let xml = await zip.file(path).async("string"); const miss = [], notes = []; let n = 0;
  const set = (ref, val) => { if (val == null || val === "") return; const r = xSetCell(xml, ref, val); if (r.ok) { xml = r.xml; n++; } else miss.push(ref); };
  set("C2", getPath(a, "p1.name") || Store.company().name);
  if (!primary) { const t = { "Authorised Person only": "Authorised Person Only", "Secondary BSI": "Secondary BSI" }[a.app_type]; if (t) set("C3", t); else notes.push("Application type left blank: the form offers only 'Authorised Person Only' and 'Secondary BSI' on this sheet."); }
  const v = (a.tef || {}).v || {}, d = (a.tef || {}).d || {};
  for (const r of TEF_ROWS) {
    const row = primary ? r.s2 : r.s1;
    if (r.det) { set("C" + row, (d[r.k] || {}).provider); set("D" + row, (d[r.k] || {}).docref); }
    for (let y = 0; y < 10; y++) {
      if (primary && r.pair) { const l = (v[r.k + "_ll"] || [])[y], dv = (v[r.k + "_dev"] || [])[y]; if (filled(l)) set(colL(6 + 2 * y) + row, Number(l)); if (filled(dv)) set(colL(7 + 2 * y) + row, Number(dv)); }
      else { const x = (v[r.k] || [])[y]; if (filled(x)) set(colL(primary && r.ccy === "LKR" ? 6 + 2 * y : 6 + y) + row, Number(x)); }
    }
  }
  if (miss.length) throw [`Could not find these cells in the form: ${miss.slice(0, 6).join(", ")}. The form may have changed.`];
  xml = xml.replace(/(<f[^>]*>[^<]*<\/f>|<f [^>]*\/>)<v>[^<]*<\/v>/g, "$1"); // clear stale totals so Excel works them out again
  zip.file(path, xml);
  let wb = await zip.file("xl/workbook.xml").async("string"); wb = wb.replace(/<calcPr([^>]*?)\/>/, (m, at) => `<calcPr${at.replace(/\s*fullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"/>`); zip.file("xl/workbook.xml", wb);
  notes.push(`${n} cells filled on the sheet '${primary ? "Primary BSI-Only" : "AP Only & Secondary BSI"}'. Totals, growth rates and ratios are worked out by the form's own formulas when you open it.`);
  return [{ name: `Technical_Evaluation_Form_${fileSafe(getPath(a, "p1.name"))}.xlsx`, blob: await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 }, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), notes }];
}

/* ---------- drafts written by Quayzen (not Commission forms) ---------- */
async function simpleDocx(title, paras, notes) {
  const D = await libs.docx(), P = (t, o = {}) => new D.Paragraph({ spacing: { after: 160 }, alignment: o.align, children: [new D.TextRun({ text: t, bold: !!o.bold, size: o.size || 22, font: "Calibri" })] });
  const children = paras.map(x => typeof x === "string" ? P(x) : P(x.t, x));
  return new Blob([await D.Packer.toBlob(new D.Document({ creator: "Quayzen", title, sections: [{ properties: { page: { margin: { top: 1200, bottom: 1200, left: 1300, right: 1300 } } }, children }] }))], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
async function buildS64Letter(a) {
  const name = getPath(a, "p1.name") || "[Applicant]", inPC = getPath(a, "p2.loc_within"), addr = oneLine(inPC ? getPath(a, "p2.loc_within_addr") : getPath(a, "p2.loc_desig_addr")) || "[full address]", sqm = getPath(a, "p2.floor_sqm");
  const paras = ["[On the applicant's letterhead]", "Date: ....................", "The Director-General", "Colombo Port City Economic Commission", "Unit 901, 9th Floor, One Galle Face Tower, 1A Centre Road, Colombo 2", "",
    { t: `Request for designation of proposed location under section 64 of the Colombo Port City Economic Commission Act, No. 11 of 2021 - ${name}`, bold: true },
    "Dear Sir / Madam,",
    `In connection with our application for ${a.app_type === "Authorised Person only" ? "a licence as an Authorised Person" : `registration and designation as ${a.app_type}`}, we request the Commission to designate the following premises as the location from which we will carry on business, under section 64 of the Act:`,
    { t: `Address: ${addr}`, bold: true }, { t: `Floor area: ${sqm ? fmtNum(sqm) + " square metres" : "[floor area in sqm]"}`, bold: true },
    (a.q || {}).premises_owned === "No" ? "We do not own the premises. Evidence of our right to occupy them is attached." : (a.q || {}).premises_owned === "Yes" ? "The premises are owned by us." : "[State whether the premises are owned, and attach evidence of occupancy rights if they are not.]",
    "Please let us know if you need anything further.", "Yours faithfully,", "", "....................................", getPath(a, "p2.signatory") || "[Authorised Signatory]", getPath(a, "p2.signatory_designation") || "[Designation]", `For and on behalf of ${name}`];
  return [{ name: `Section_64_designation_request_${fileSafe(name)}`, model: parasModel("Request for designation of proposed location", paras), notes: ["Draft letter written by Quayzen, not a Commission form. Check the wording, print on letterhead and sign."] }];
}
async function buildResolutions(a) {
  const name = getPath(a, "p1.name") || "[Company]", dirs = appPeople("app_id", a.id).filter(p => hasRole(p, "dir")), sig = getPath(a, "p2.signatory") || "[name]", sd = getPath(a, "p2.signatory_designation") || "[designation]", country = getPath(a, "p1.country") || "[country of incorporation]";
  const sign = dirs.length ? dirs.map(d => `.................................... ${d.name}, Director`) : ["....................................  [Director]"];
  const head = t => [{ t: name, bold: true, size: 26 }, { t: `Registration no. ${getPath(a, "q.reg_no") || "[ ]"} - ${country}`, size: 20 }, { t, bold: true }, "Passed by the board of directors on .................... [by written resolution / at a meeting held at ....................]", ""];
  const r1 = [...head("Board resolution: authorised signatory for the Colombo Port City Economic Commission"), `IT IS RESOLVED THAT ${sig}, ${sd}, is appointed as the Authorised Signatory of the Company, authorised to sign and submit, on behalf of the Company, the application to the Colombo Port City Economic Commission for ${a.app_type === "Authorised Person only" ? "a licence as an Authorised Person" : a.app_type} and all related declarations, forms, letters and documents, and to act for the Company before the Commission in that connection.`, "", ...sign, "", "[If the Company has a sole director: certified a true copy by the Company Secretary ....................]"];
  const r2 = [...head("Board resolution: no legal impediment"), `IT IS RESOLVED AND CONFIRMED THAT there are no legal impediments under the laws of ${country}, being the country of incorporation of the Company, for the Company to be registered to carry on business as an offshore company, or to engage in the business of an offshore company, in and from the Area of Authority of the Colombo Port City.`, "", "Signed by each director:", ...sign];
  const out = [{ name: `Board_resolution_authorised_signatory_${fileSafe(name)}`, model: parasModel("Board resolution - authorised signatory", r1), notes: ["Draft written by Quayzen, not a prescribed form. Have it checked by the company secretary or legal adviser. The Commission requires it to be signed by all directors (or certified by the company secretary where there is a sole director)."] }];
  if (isCo(a)) out.push({ name: `Board_resolution_no_legal_impediment_${fileSafe(name)}`, model: parasModel("Board resolution - no legal impediment", r2), notes: ["Draft written by Quayzen, not a prescribed form. Have it checked by your legal adviser in the country of incorporation."] });
  return out;
}
/* A letter or resolution as a model: first bold line is the title */
function parasModel(title, paras) { return { title: "", blocks: paras.map(x => typeof x === "string" ? { p: x || " " } : x.bold ? { h: x.t } : { p: x.t }), footer: title }; }
/* Business plan: maximum four pages, PDF (Required documents list) */
async function buildBusinessPlan(a, fmt = "pdf") {
  const name = getPath(a, "p1.name") || Store.company().name, T = tefTotals(a), yrs = Array.from({ length: 10 }, (_, i) => i);
  const fx = v => v == null || v === 0 ? "" : fmtK(v);
  const ps = appPeople("app_id", a.id), sh = ps.filter(p => hasRole(p, "sh")).map(p => `${p.name}${p.shareholding_pct != null ? ` (${fmtNum(p.shareholding_pct)}%)` : ""}`).join("; ");
  const ents = ((a.prof || {}).entities || []).filter(e => e.name && e.type !== "Applicant").map(e => `${e.name} (${e.type}, ${e.country || ""})`).join("; ");
  const secs = [
    ["1. The applicant", [`${name}, ${(a.legal || "").toLowerCase()} ${getPath(a, "p1.country") ? "incorporated / registered in " + getPath(a, "p1.country") : ""}. Application for ${a.app_type === "Authorised Person only" ? "an Authorised Person licence" : a.app_type}.`, sh ? `Ownership: ${sh}.` : "", ents ? `Group and associated entities: ${ents}.` : ""].filter(Boolean).join(" ")],
    ["2. Objective and business activities", [getPath(a, "p6.objective"), getPath(a, "p2.description"), getPath(a, "p6.products") ? "Products and services: " + getPath(a, "p6.products") : ""].filter(Boolean).join("\n\n")],
    ["3. Operating model", [getPath(a, "bp.operating_model"), getPath(a, "p6.strategy")].filter(Boolean).join("\n\n")],
    ["4. Target markets", [getPath(a, "p6.target_market"), (a.prof || {}).countries ? "Countries served: " + a.prof.countries : "", (a.prof || {}).segments ? "Segments: " + a.prof.segments : ""].filter(Boolean).join("\n\n")],
    ["5. Financial projections", "Ten-year projections from the Technical Evaluation Form (USD unless stated). These are projections, not commitments." + (getPath(a, "bp.assumptions") ? "\n\nMain assumptions: " + getPath(a, "bp.assumptions") : "")],
    ["6. Internal policies and controls", getPath(a, "p6.controls") || ""]];
  const head = ["", ...yrs.map(y => "Y" + (y + 1))];
  const table = [["Revenue", ...yrs.map(y => fx(tefVal(a, "revenue", y)))], ["Expenses", ...yrs.map(y => fx(tefVal(a, "expenses", y)))], ["Net income", ...yrs.map(y => fx(tefVal(a, "net_income", y)))],
    ["FDI", ...yrs.map(y => fx(T[y].fdi))], ["Other USD funding", ...yrs.map(y => fx(T[y].usd_other))], ["LKR investment (LKR)", ...yrs.map(y => fx(T[y].lkr))],
    ["Staff - local", ...yrs.map(y => T[y].local ? String(T[y].local) : "")], ["Staff - foreign", ...yrs.map(y => T[y].foreign ? String(T[y].foreign) : "")], ["Office space (sqm)", ...yrs.map(y => fx(tefVal(a, "floor", y)))]];
  const missing = secs.filter(s => !String(s[1]).trim()).map(s => s[0]);
  if (fmt === "docx") {
    const D = await libs.docx(), P = (t, o = {}) => new D.Paragraph({ spacing: { after: 120 }, children: [new D.TextRun({ text: t, bold: !!o.bold, size: o.size || 21, font: "Calibri" })] });
    const ch = [P(`Business plan - ${name}`, { bold: true, size: 30 }), P(`Application to the Colombo Port City Economic Commission`, { size: 20 })];
    secs.forEach(([h, t], i) => { ch.push(P(h, { bold: true, size: 24 })); String(t).split("\n\n").forEach(x => ch.push(P(x))); if (i === 4) ch.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, columnWidths: [1700, ...Array(10).fill(750)], rows: [head, ...table].map((r, ri) => new D.TableRow({ children: r.map(c => new D.TableCell({ width: { size: c === r[0] ? 1700 : 750, type: D.WidthType.DXA }, children: [new D.Paragraph({ alignment: c === r[0] ? undefined : D.AlignmentType.RIGHT, children: [new D.TextRun({ text: c, size: 15, bold: ri === 0, font: "Calibri" })] })] })) })) })); });
    return [{ name: `Business_plan_${fileSafe(name)}.docx`, blob: await D.Packer.toBlob(new D.Document({ creator: "Quayzen", sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children: ch }] })), notes: ["Editable Word version. Save as PDF when it is final."] }];
  }
  const J = await libs.jspdf(); await libs.autotable();
  const doc = new J({ unit: "pt", format: "a4" }); let y = 56;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(`Business plan - ${name}`, 40, y); y += 18; doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text("Application to the Colombo Port City Economic Commission", 40, y); y += 24;
  const para = t => { for (const l of doc.splitTextToSize(String(t), 515)) { if (y > 790) { doc.addPage(); y = 50; } doc.text(l, 40, y); y += 13; } y += 6; };
  secs.forEach(([h, t], i) => {
    if (y > 760) { doc.addPage(); y = 50; } doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(h, 40, y); y += 16; doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    String(t || "[To be completed]").split("\n\n").forEach(para);
    if (i === 4) { doc.autoTable({ startY: y, head: [head], body: table, styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [14, 90, 107] }, margin: { left: 40, right: 40 }, columnStyles: { 0: { cellWidth: 82 } } }); y = doc.lastAutoTable.finalY + 14; }
  });
  const pages = doc.getNumberOfPages(), notes = [`${pages} page(s).`];
  if (pages > 4) notes.unshift(`The Commission asks for a maximum of four pages. This draft runs to ${pages} pages - shorten the text, or edit the Word version.`);
  if (missing.length) notes.push(`Sections with no text yet: ${missing.join(", ")}.`);
  return [{ name: `Business_plan_${fileSafe(name)}.pdf`, blob: doc.output("blob"), notes, pages }];
}

/* ---------- application outputs: original format plus Word / PDF / Excel copies ---------- */

return { buildSchedule1, buildTef, buildApDeclaration, buildUboDeclarations, buildDsInfo, buildBusinessProfile, fillPdfForm, FORM_SRC, fileSafe, fillSpecForm, S1 };
}
