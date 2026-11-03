/* ===== x_docs.js ===== */
/* Supporting documents: upload on every checklist line, and document templates.
   - Every line of the application's supporting documents list can take an uploaded file. The file goes into the Documents register,
     linked to the application, so it keeps its versions and history.
   - Documents that have a format (board resolutions, letter of indemnity, bank reference request, certificate of true copy, covering
     and reply letters) are templates. A template is text with {{markers}}, filled from the application. Where the Commission gives its own
     Word format, the user uploads it as the template, types the {{markers}} into it, and Quayzen fills that file.
   - The Commission's later requests ("please also send ...") are added as extra lines, each with an upload slot and, if there is a format, a template.
   None of the Quayzen wording is a Commission format. It is a starting point to be checked by the company secretary or legal adviser. */

TYPES.push("doc_templates");
const PC_COMMISSION_ADDR = "Unit 901, 9th Floor, One Galle Face Tower, 1A Centre Road, Colombo 2";
const TPL_KINDS = ["Commission format", "Our own format", "Quayzen starter draft"];
const TPL_MAX_DOCX = 400 * 1024;
const TPL_FIELDS = [
  ["company_name", "Company name"], ["registration_no", "Registration number"], ["country_of_incorporation", "Country of incorporation"],
  ["registered_address", "Registered address"], ["licence_applied_for", "Licence applied for"], ["application_type", "Application type"],
  ["signatory", "Authorised signatory"], ["signatory_designation", "Signatory's designation"], ["contact_person", "Contact person"],
  ["contact_email", "Contact email"], ["contact_phone", "Contact telephone"], ["portcity_address", "Proposed office address"],
  ["floor_area_sqm", "Floor area (sqm)"], ["directors", "Directors (list)"], ["director_signature_lines", "A signature line for each director"],
  ["shareholders", "Shareholders (list)"], ["person_name", "Person or entity on this line"], ["document_name", "Document name"],
  ["request_reference", "Commission's request reference"], ["request_date", "Date of the Commission's request"],
  ["requested_documents", "Documents the Commission asked for"], ["enclosures", "Documents marked Ready"], ["today", "Today's date"],
  ["commission_name", "Commission's name"], ["commission_address", "Commission's address"]];
const TPL_LABEL = Object.fromEntries(TPL_FIELDS);

const STARTER = "Quayzen starter draft. The Commission has not given Quayzen a format for this document.";
const BUILTIN_TPL = [
  { id: "res_sig", name: "Board resolution - authorised signatory", kind: "Quayzen starter draft", lines: ["res_signatory"],
    src: "Required documents: board resolution appointing the Authorised Signatory, signed by all directors (or certified by the company secretary where there is a sole director).",
    body: `# {{company_name}}
Registration no. {{registration_no}} - {{country_of_incorporation}}

# Board resolution: authorised signatory for the Colombo Port City Economic Commission
Passed by the board of directors on .................... [by written resolution / at a meeting held at ....................]

IT IS RESOLVED THAT {{signatory}}, {{signatory_designation}}, is appointed as the Authorised Signatory of the Company, authorised to sign and submit, on behalf of the Company, the application to the Colombo Port City Economic Commission for {{licence_applied_for}} and all related declarations, forms, letters and documents, and to act for the Company before the Commission in that connection.

{{director_signature_lines}}

[If the Company has a sole director: certified a true copy by the Company Secretary ....................]` },
  { id: "res_imp", name: "Board resolution - no legal impediment", kind: "Quayzen starter draft", lines: ["res_impediment"],
    src: "Required documents: board resolution confirming no legal impediment in the country of incorporation to carry on business as an offshore company.",
    body: `# {{company_name}}
Registration no. {{registration_no}} - {{country_of_incorporation}}

# Board resolution: no legal impediment
Passed by the board of directors on .................... [by written resolution / at a meeting held at ....................]

IT IS RESOLVED AND CONFIRMED THAT there are no legal impediments under the laws of {{country_of_incorporation}}, being the country of incorporation of the Company, for the Company to be registered to carry on business as an offshore company, or to engage in the business of an offshore company, in and from the Area of Authority of the Colombo Port City.

Signed by each director:
{{director_signature_lines}}` },
  { id: "bank_ref", name: "Request to a bank for a reference letter", kind: "Quayzen starter draft", lines: ["bank_ref"],
    src: "Required documents: bank reference letters for all directors and shareholders confirming good standing, account type and length of the banking relationship. The letter itself comes from the bank; this is the request to the bank.",
    body: `[On the account holder's letterhead, or as a personal letter]
Date: {{today}}

The Manager
{{bank_name}}
{{bank_branch_address}}

# Request for a bank reference letter
Dear Sir / Madam,

Account holder: {{person_name}}
Account number: {{account_number}}

Please issue a bank reference letter, signed and stamped by the bank, confirming:
- that the account is in good standing;
- the type of account; and
- how long the account holder has banked with you.

The letter is needed for an application by {{company_name}} to the {{commission_name}}.

Yours faithfully,

....................................
{{person_name}}` },
  { id: "true_copy", name: "Certificate of true copy (company secretary)", kind: "Quayzen starter draft", lines: ["constitution", "res_signatory"],
    src: "Required documents: constitutional documents certified by the company registry, company secretary or attorney-at-law; the authorised signatory resolution certified by the company secretary where there is a sole director.",
    body: `# Certificate of true copy
{{company_name}} (registration no. {{registration_no}})

I, {{company_secretary}}, the Company Secretary of {{company_name}}, certify that the attached {{document_name}}, consisting of [ ] pages, is a true and complete copy of the original, and that it is in force and has not been amended or revoked as at the date below.

....................................
{{company_secretary}}, Company Secretary
Date: ....................
[Company seal, if any]` },
  { id: "indemnity", name: "Letter of indemnity", kind: "Quayzen starter draft", lines: [],
    src: "Not on the standard list. Use it when the Commission asks for a letter of indemnity, and fill in what the Commission's request says the indemnity must cover.",
    body: `[On the company's letterhead]
Date: {{today}}

The Director-General
{{commission_name}}
{{commission_address}}

# Letter of indemnity - {{company_name}}
Dear Sir / Madam,

We, {{company_name}}, a company incorporated in {{country_of_incorporation}} (registration no. {{registration_no}}), with its registered office at {{registered_address}}, refer to your request {{request_reference}} dated {{request_date}}.

[Describe the matter the indemnity relates to, as stated in the Commission's request.]

In consideration of the Commission [describe what the Commission is doing, as stated in its request], we undertake to indemnify and keep indemnified the Commission against [state the scope of the indemnity, as required by the Commission].

[Add any other terms the Commission has asked for.]

This letter is signed by our Authorised Signatory under the authority of our board of directors.

Yours faithfully,

....................................
{{signatory}}
{{signatory_designation}}
For and on behalf of {{company_name}}` },
  { id: "cover", name: "Covering letter for the application", kind: "Quayzen starter draft", lines: [],
    src: "Optional covering letter listing the documents marked Ready on the supporting documents list.",
    body: `[On the applicant's letterhead]
Date: {{today}}

The Director-General
{{commission_name}}
{{commission_address}}

# Application for {{licence_applied_for}} - {{company_name}}
Dear Sir / Madam,

We submit our application for {{licence_applied_for}}, with the following documents:
{{enclosures}}

Please contact {{contact_person}} ({{contact_email}}, {{contact_phone}}) if you need anything further.

Yours faithfully,

....................................
{{signatory}}
{{signatory_designation}}
For and on behalf of {{company_name}}` },
  { id: "reply", name: "Reply to a Commission request", kind: "Quayzen starter draft", lines: [],
    src: "Covering letter for documents sent in reply to a request from the Commission. Lists the documents added under 'Other documents requested by the Commission'.",
    body: `[On the applicant's letterhead]
Date: {{today}}

The Director-General
{{commission_name}}
{{commission_address}}

# {{company_name}} - further information for our application
Dear Sir / Madam,

We refer to your request {{request_reference}} dated {{request_date}}. Please find enclosed:
{{requested_documents}}

Please contact {{contact_person}} ({{contact_email}}, {{contact_phone}}) if you need anything further.

Yours faithfully,

....................................
{{signatory}}
{{signatory_designation}}
For and on behalf of {{company_name}}` }];

/* ---------- template store: built-ins (editable, with reset) plus the company's own ---------- */
const tplBuiltin = id => BUILTIN_TPL.find(t => t.id === id);
function tplGet(id) {
  const b = tplBuiltin(id), o = Store.get("doc_templates", id);
  if (b) return Object.assign({}, b, o && !o.archived ? o : {}, { id, builtin: true, edited: !!(o && !o.archived) });
  return o && !o.archived ? Object.assign({}, o, { builtin: false }) : null;
}
const tplAll = () => [...BUILTIN_TPL.map(b => tplGet(b.id)), ...Store.list("doc_templates").filter(t => !tplBuiltin(t.id)).map(t => tplGet(t.id))].filter(Boolean);
const tplForLine = k => tplAll().filter(t => (t.lines || []).includes(k));
const tplMarkers = s => [...new Set([...String(s || "").matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)].map(m => m[1]))];

/* ---------- values for the markers, from an application (or the company record if there is none) ---------- */
function tplCtx(a, key) {
  const c = Store.company() || {}, g = k => a ? getPath(a, k) : undefined, ps = a ? appPeople("app_id", a.id) : [];
  const dirs = ps.filter(p => hasRole(p, "dir")), shs = ps.filter(p => hasRole(p, "sh"));
  const ents = a ? ((a.prof || {}).entities || []).filter(e => e && e.name && e.type && e.type !== "Applicant") : [];
  const [lk, sub] = String(key || "").split(":"), person = sub && ps.find(p => p.id === sub), ent = sub && /^e\d+$/.test(sub) ? ents[+sub.slice(1)] : null;
  const rows = a ? checklistRows(a) : [], extras = a ? (a.extra_docs || []) : [], ex = lk && lk.startsWith("x_") ? extras.find(x => "x_" + x.id === lk) : null;
  const row = rows.find(r => r.key === key), lastReq = ex || extras.filter(x => x.requested_on).slice(-1)[0] || extras.filter(x => x.ref).slice(-1)[0];
  const list = xs => xs.length ? xs.map(x => "- " + x).join("\n") : "";
  return {
    company_name: g("p1.name") || c.name, registration_no: g("q.reg_no") || c.registration_no, country_of_incorporation: g("p1.country") || c.country_of_incorporation,
    registered_address: oneLine(g("p1.address") || c.register_address), application_type: a ? a.app_type : "",
    licence_applied_for: a ? (a.app_type === "Authorised Person only" ? "a licence as an Authorised Person" : `registration and designation as ${a.app_type}`) : "",
    signatory: g("p2.signatory") || c.signatory_name, signatory_designation: g("p2.signatory_designation") || c.signatory_designation,
    contact_person: g("p2.contact") || c.contact_name, contact_email: g("p1.email") || c.contact_email, contact_phone: g("p1.tel") || c.contact_phone,
    portcity_address: oneLine(g("p2.loc_within") ? g("p2.loc_within_addr") : g("p2.loc_desig_addr")), floor_area_sqm: g("p2.floor_sqm") ? fmtNum(g("p2.floor_sqm")) : "",
    directors: dirs.map(d => d.name).join(", "),
    director_signature_lines: (dirs.length ? dirs.map(d => `.................................... ${d.name}, Director`) : ["....................................  [Director]"]).join("\n"),
    shareholders: shs.map(p => `${p.name}${p.shareholding_pct != null ? ` (${fmtNum(p.shareholding_pct)}%)` : ""}`).join("; "),
    person_name: person ? person.name : ent ? ent.name : "",
    document_name: ex ? ex.name : row ? row.it.t.split(/,|\(/)[0].trim() : "",
    request_reference: lastReq ? lastReq.ref || "" : "", request_date: lastReq && lastReq.requested_on ? fmtDate(lastReq.requested_on) : "",
    requested_documents: list(extras.map(x => x.name)),
    enclosures: list(rows.filter(r => r.status === "Ready").map(r => r.it.t.split(/,|\(/)[0].trim() + (r.who ? " - " + r.who : ""))),
    today: fmtDate(today()), commission_name: "Colombo Port City Economic Commission", commission_address: PC_COMMISSION_ADDR };
}
/* Fill the markers. Anything empty or unknown is left as [label] for the user to complete, and listed. */
function tplFill(text, ctx) {
  const blanks = [];
  const out = String(text || "").replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (m, k) => {
    const v = ctx[k]; if (v != null && String(v).trim()) return String(v);
    const l = TPL_LABEL[k] || k.replace(/_/g, " "); if (!blanks.includes(l)) blanks.push(l); return `[${l}]`;
  });
  return { text: out, blanks };
}
function tplModel(text, footer) {
  const blocks = []; let list = null, gap = false;
  for (const raw of String(text).split("\n")) {
    const l = raw.replace(/\s+$/, "");
    if (/^\s*-\s+/.test(l)) { if (!list) { list = []; blocks.push({ list }); } list.push(l.replace(/^\s*-\s+/, "")); gap = false; continue; }
    list = null;
    if (!l.trim()) { if (!gap && blocks.length) blocks.push({ p: " " }); gap = true; continue; }
    gap = false; blocks.push(/^#\s+/.test(l) ? { h: l.replace(/^#\s+/, "") } : { p: l });
  }
  return { title: "", blocks, footer };
}
function tplNotes(t, blanks) {
  const n = [];
  if (t.kind === "Quayzen starter draft") n.push(`${STARTER} Have the wording checked by the company secretary or legal adviser before anyone signs it.`);
  else if (t.kind === "Commission format") n.push("Made from the Commission's format held as this template. Check it still matches the Commission's current format.");
  if (blanks.length) n.push(`Left for you to complete: ${blanks.join(", ")}.`);
  return n;
}
/* Text version (Word or PDF) as {name, model, notes} */
function tplModels(t, a, key) {
  const ctx = tplCtx(a, key), { text, blanks } = tplFill(t.body, ctx);
  return [{ name: `${fileSafe(t.name)}_${fileSafe(ctx.person_name || ctx.company_name)}`, model: tplModel(text, t.name), notes: tplNotes(t, blanks) }];
}
/* The uploaded Word file itself, with its {{markers}} filled */
async function tplFillDocx(t, a, key) {
  if (!t.docx_b64) throw ["This template has no Word file. Upload one first."];
  const ctx = tplCtx(a, key), blanks = [], JSZip = await libs.jszip(), bin = Uint8Array.from(atob(t.docx_b64), ch => ch.charCodeAt(0)), zip = await JSZip.loadAsync(bin);
  let n = 0;
  const parts = Object.keys(zip.files).filter(p => /^word\/(document|header\d*|footer\d*)\.xml$/.test(p));
  for (const path of parts) {
    const xml = new TextDecoder("utf-8").decode(await zip.file(path).async("uint8array")).replace(/^﻿/, ""), doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw [`The Word file could not be read (${path}).`];
    for (const p of [...doc.getElementsByTagNameNS(WNS, "p")]) {
      for (let guard = 0; guard < 50; guard++) {
        const full = [...p.getElementsByTagNameNS(WNS, "t")].map(x => x.textContent).join(""), m = full.match(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/); if (!m) break;
        const v = ctx[m[1]], has = v != null && String(v).trim(), lbl = TPL_LABEL[m[1]] || m[1].replace(/_/g, " ");
        if (!has && !blanks.includes(lbl)) blanks.push(lbl);
        const val = has ? String(v) : `[${lbl}]`, lines = val.split("\n");
        if (lines.length > 1 && full.trim() === m[0] && p.parentNode) { // a marker alone in its paragraph: one paragraph per line
          for (const line of lines) { const q = p.cloneNode(true); wReplace(q, m[0], line); p.parentNode.insertBefore(q, p); }
          p.parentNode.removeChild(p); n++; break;
        }
        wReplace(p, m[0], lines.join("; ")); n++;
      }
    }
    zip.file(path, new XMLSerializer().serializeToString(doc));
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 }, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const notes = tplNotes(t, blanks); notes.unshift(n ? `${n} marker(s) filled in your Word file.` : "No {{markers}} were found in the Word file, so it is downloaded as it is. Type markers such as {{company_name}} into the file where the details go.");
  return [{ name: `${fileSafe(t.name)}_${fileSafe(ctx.person_name || ctx.company_name)}.docx`, blob, notes }];
}
async function tplFiles(t, a, key, f) { return f === "orig" ? tplFillDocx(t, a, key) : modelsToFiles(tplModels(t, a, key), f); }
function tplButtons(t, key, aid) {
  const at = `data-tid="${esc(t.id)}" data-k="${esc(key || "")}" data-aid="${esc(aid || "")}"`;
  return `<span class="tplbtns">${t.docx_b64 ? `<button class="btn sm p" data-act="tpl-gen" ${at} data-f="orig" title="Your uploaded Word file, filled in">Word file</button>` : ""}<button class="btn sm" data-act="tpl-gen" ${at} data-f="docx">Word</button><button class="btn sm" data-act="tpl-gen" ${at} data-f="pdf">PDF</button></span>`;
}
ACTIONS["tpl-gen"] = el => {
  const t = tplGet(el.dataset.tid); if (!t) return toast("This template is no longer available.", "warn");
  const aid = el.dataset.aid, a = aid ? Store.get("apps", aid) : null;
  return runAndSave(t.name, () => tplFiles(t, a, el.dataset.k, el.dataset.f), async files => { if (a) await Store.audit("apps", a.id, "Draft prepared", `${t.name}: ${files.map(f => f.name).join(", ")}`.slice(0, 280)); });
};

/* Board resolutions in the application pack now come from the templates, so changes to the wording are used everywhere */
buildResolutions = async function (a) {
  const out = []; for (const id of ["res_sig", ...(isCo(a) ? ["res_imp"] : [])]) { const t = tplGet(id); if (t) out.push(...tplModels(t, a, "")); } return out;
};

/* ---------- extra lines: other documents the Commission asks for ---------- */
const _checklistRowsBase = checklistRows;
checklistRows = function (a) {
  const out = _checklistRowsBase(a), st = a.checklist || {};
  for (const x of a.extra_docs || []) {
    const key = "x_" + x.id, e = st[key] || {}, status = e.status || "Not started", warn = [];
    if (status === "Not applicable" && !e.note) warn.push("Give the reason it does not apply.");
    if (x.due && !["Ready", "Not applicable"].includes(status) && daysUntil(x.due) < 0) warn.push(`Was due on ${fmtDate(x.due)}.`);
    out.push({ it: { k: key, t: x.name, src: `Requested by the Commission${x.ref ? ` (${x.ref})` : ""}${x.requested_on ? `, ${fmtDate(x.requested_on)}` : ""}`, help: x.due ? `Due ${fmtDate(x.due)}` : "", extra: x, tpl: x.tpl },
      key, who: "", e, status, warn, done: (status === "Ready" || (status === "Not applicable" && !!e.note)) && !warn.length });
  }
  return out;
};
const clItem = (a, k) => { const b = k.split(":")[0]; if (b.startsWith("x_")) { const x = (a.extra_docs || []).find(y => "x_" + y.id === b); return x ? { t: x.name } : null; } return CHECKLIST.find(x => x.k === b); };
CHANGES["cl-set"] = async el => {
  const a = currentApp(), k = el.dataset.k, f = el.dataset.f, checklist = clone(a.checklist || {}), e = checklist[k] = checklist[k] || {}, old = e[f] ?? null;
  e[f] = el.value || null; e.updated_at = nowIso(); e.updated_by = Store.uid;
  const it = clItem(a, k);
  await saveApp(a, { checklist }, `Documents: ${it ? it.t.slice(0, 50) : k}`, [{ label: `${it ? it.t.slice(0, 60) : k} - ${{ status: "status", cert_date: "certified on", doc_id: "stored document", note: "note" }[f]}`, old, new: e[f] }]);
};
FORMS.clx = async form => {
  const a = appOf(form.dataset.id), o = readForm(form), name = String(o.name || "").trim(); if (!name) throw ["Give the name of the document the Commission asked for."];
  const x = { id: rid(), name, requested_on: o.requested_on || null, ref: String(o.ref || "").trim() || null, due: o.due || null, tpl: o.tpl || null, req_id: o.req_id || null, added_at: nowIso(), added_by: Store.uid };
  const checklist = clone(a.checklist || {}); checklist["x_" + x.id] = { status: "Requested", updated_at: nowIso(), updated_by: Store.uid };
  await saveApp(a, { extra_docs: (a.extra_docs || []).concat([x]), checklist }, `Documents: added '${name}' requested by the Commission`, [{ label: "Document requested by the Commission", old: null, new: name }]);
  form.reset(); toast("Added to the list."); render();
};
ACTIONS["clx-del"] = async el => {
  const a = currentApp(), x = (a.extra_docs || []).find(y => y.id === el.dataset.id); if (!x) return;
  if (!(await confirmAsk(`Remove '${x.name}' from the list? Any uploaded file stays in the Documents register.`))) return;
  await saveApp(a, { extra_docs: (a.extra_docs || []).filter(y => y.id !== x.id) }, `Documents: removed '${x.name}'`, [{ label: "Document requested by the Commission", old: x.name, new: null }]); render();
};
CHANGES["clx-tpl"] = async el => {
  const a = currentApp(), list = clone(a.extra_docs || []), x = list.find(y => y.id === el.dataset.id); if (!x) return; const old = x.tpl || null; x.tpl = el.value || null;
  await saveApp(a, { extra_docs: list }, `Documents: template for '${x.name}'`, [{ label: `${x.name} - template`, old: old && (tplGet(old) || {}).name, new: x.tpl && (tplGet(x.tpl) || {}).name }]); render();
};

/* ---------- upload a file straight onto a checklist line ---------- */
const clCategory = k => ({ passports: "Passports and IDs", ubo_decl: "UBO declarations", work_permit: "Visa and permit documents", constitution: "Constitutional documents", res_signatory: "Board resolutions", res_impediment: "Board resolutions", bplan: "Business plans" })[k.split(":")[0]] || (k.startsWith("x_") ? "Commission requests and responses" : "Application documents");
CHANGES["cl-upload"] = async el => {
  const file = el.files && el.files[0]; if (!file) return;
  const a = currentApp(), k = el.dataset.k, row = checklistRows(a).find(r => r.key === k); el.value = "";
  if (!row) throw ["This line is no longer on the list."];
  if (appLocked(a)) throw ["This application is locked because it has been submitted. Set its status to 'Further information requested' to add files."];
  if (!Store.can("documents", "write")) throw ["Your role cannot add files to the Documents register."];
  if (!DOC_ACCEPT.split(",").some(x => file.name.toLowerCase().endsWith(x))) throw ["This file type can't be stored here. Save Word or Excel files as PDF first (or scan the signed copy to PDF)."];
  const cat = clCategory(k), restricted = RESTRICTED_DOC_CATS.includes(cat);
  if (restricted && !canRestrictedDocs()) throw ["Your role cannot add passport, UBO or visa documents."];
  let assets = null; try { assets = await window.claude?.use?.("assets"); } catch (e) { }
  if (!assets) throw ["File upload isn't available for you in this view. Only people with edit access to this page can upload files."];
  const wait = toast("Uploading…", "info"); let up;
  try { up = await assets.upload(file); } catch (e) { throw [e && e.code === "too_large" ? "The file is too large (20 MB limit)." : e && e.code === "unsupported_type" ? "This file type isn't supported." : "The upload failed. Please try again."]; }
  finally { if (wait) wait.remove(); }
  const ver = { asset_id: up.id, url: up.url, name: file.name, size: up.sizeBytes, type: up.contentType, uploaded_at: nowIso(), by: Store.uid };
  let d = row.e.doc_id ? Store.get("docs", row.e.doc_id) : null, docId;
  if (d) { const versions = (d.versions || []).concat([ver]); await Store.save("docs", { versions }, d.id); docId = d.id; await Store.audit("docs", d.id, "File uploaded", `${d.title}: version ${versions.length} (${file.name})`); }
  else {
    const title = `${row.it.t.split(/,|\(/)[0].trim()}${row.who ? " - " + row.who : ""} (${a.title})`.slice(0, 140);
    docId = await Store.save("docs", { title, category: cat, access: restricted ? "Restricted" : "Normal", expiry_date: null, notes: `Uploaded from the licence application's supporting documents list. Source: ${row.it.src}`, link_type: "apps", link_id: a.id, versions: [ver] });
    await Store.audit("docs", docId, "Created", `Document: ${title} (file ${file.name})`);
  }
  const cur = appOf(a.id), checklist = clone(cur.checklist || {}), e = checklist[k] = checklist[k] || {}, oldStatus = e.status || "Not started";
  e.doc_id = docId; if (["Not started", "Requested"].includes(oldStatus)) e.status = "Received"; e.updated_at = nowIso(); e.updated_by = Store.uid;
  await saveApp(cur, { checklist }, `Documents: file uploaded for ${row.it.t.slice(0, 50)}`, [{ label: `${row.it.t.slice(0, 60)}${row.who ? " - " + row.who : ""} - file`, old: null, new: file.name }, ...(e.status !== oldStatus ? [{ label: `${row.it.t.slice(0, 60)} - status`, old: oldStatus, new: e.status }] : [])]);
  toast(e.status !== oldStatus ? "Uploaded. Status set to Received - change it to Ready once checked." : "Uploaded.");
};

/* ---------- the supporting documents step, with uploads and templates ---------- */
appChecklistStep = function (a) {
  const rows = checklistRows(a), locked = !canLic() || appLocked(a), docs = Store.list("docs").filter(docVisible).sort((x, y) => x.title.localeCompare(y.title));
  const canUp = !locked && Store.can("documents", "write");
  const by = {}; rows.forEach(r => (by[r.it.k] = by[r.it.k] || []).push(r));
  const old = rows.filter(r => r.warn.some(x => /30 days/.test(x))), tpls = tplAll();
  const tplCell = (r, i) => {
    const list = r.it.extra ? (r.it.tpl ? [tplGet(r.it.tpl)].filter(Boolean) : []) : tplForLine(r.it.k);
    const per = list.filter(t => i === 0 || tplMarkers(t.body).includes("person_name"));
    return per.map(t => `<div class="tplrow"><span class="chip tpl">Format</span> <span class="small">${esc(t.name)}</span> ${tplButtons(t, r.key, a.id)}</div>`).join("");
  };
  const fileCell = r => {
    const d = r.e.doc_id ? Store.get("docs", r.e.doc_id) : null, vis = d && docVisible(d), v = vis && (d.versions || []).slice(-1)[0];
    return `${d ? (vis ? `<div class="small"><a href="#" data-act="doc-open" data-id="${d.id}">${esc(v ? v.name : d.title.slice(0, 40))}</a>${(d.versions || []).length > 1 ? ` <span class="muted">v${d.versions.length}</span>` : ""}${!v ? ' <span class="muted">(no file yet)</span>' : ""}</div>` : '<div class="small muted">Restricted document</div>') : ""}
      ${canUp ? `<label class="btn sm">${d ? "Upload new version" : "Upload"}<input type="file" accept="${DOC_ACCEPT}" data-change="cl-upload" data-k="${esc(r.key)}" hidden></label>` : ""}
      ${!locked ? `<details class="small linkdoc"><summary>or choose a stored document</summary><select data-change="cl-set" data-k="${esc(r.key)}" data-f="doc_id" aria-label="Stored document"><option value="">—</option>${docs.map(x => `<option value="${x.id}"${x.id === r.e.doc_id ? " selected" : ""}>${esc(x.title.slice(0, 50))}</option>`).join("")}</select></details>` : ""}`;
  };
  const extras = a.extra_docs || [], reqs = Store.can("requests") ? Store.list("requests") : [];
  return `<div class="card"><h2>Supporting documents</h2><p class="muted small">The Commission's list of required documents, with Schedule I Part VII. Items that don't apply to this applicant (from your answers on the Applicant and Business steps) are left out. Upload each document on its line. Where a document has a format, use the <span class="chip tpl">Format</span> buttons to prepare it, have it signed, then upload the signed copy.</p>
   <p class="small">Certified copies must be certified within 30 days before submission. ${a.planned_date ? `Checked against the planned submission date, ${fmtDate(a.planned_date)}.` : "Set a planned submission date on the Applicant step to check this."}</p>
   ${locked && canLic() && appLocked(a) ? `<p class="small wt">This application has been submitted, so the list is locked. If the Commission asks for more documents, set the status to 'Further information requested' on the Overview step, then add them below.</p>` : ""}</div>
  ${hlCards([{ value: `${rows.filter(r => r.done).length} of ${rows.length}`, label: "Ready or not applicable" }, { value: rows.filter(r => r.status === "Not started").length, label: "Not started", kind: "warn" },
    { value: old.length, label: "Certified more than 30 days before submission", kind: old.length ? "bad" : "" }, { value: rows.filter(r => r.e.doc_id).length, label: "With a file or stored document" }])}
  <div class="tw"><table class="t cl"><thead><tr><th>Document</th><th>Status</th><th>Certified on</th><th>File</th><th>Note</th></tr></thead><tbody>
  ${Object.values(by).map(rs => rs.map((r, i) => `<tr class="${r.done ? "ok" : ""}${r.it.extra ? " xrow" : ""}">
    <td>${i === 0 ? `<b>${esc(r.it.t)}</b><div class="small muted">${esc(r.it.src)}</div>${r.it.help ? `<div class="small">${esc(r.it.help)}</div>` : ""}${r.it.gen ? `<div><span class="chip">Quayzen can prepare</span> <button class="link small" data-act="app-go" data-step="forms">Go to Forms and downloads</button></div>` : ""}` : ""}${r.who ? `<div class="who">${esc(r.who)}</div>` : ""}${tplCell(r, i)}
      ${r.it.extra && !locked ? `<div class="row small">${tpls.length ? `<label>Format <select data-change="clx-tpl" data-id="${r.it.extra.id}"><option value="">None - upload only</option>${tpls.map(t => `<option value="${t.id}"${t.id === r.it.tpl ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>` : ""}<button class="link small" data-act="clx-del" data-id="${r.it.extra.id}">Remove</button></div>` : ""}
      ${r.warn.map(x => `<div class="small wt">${esc(x)}</div>`).join("")}</td>
    <td><select data-change="cl-set" data-k="${esc(r.key)}" data-f="status"${locked ? " disabled" : ""} aria-label="Status">${CL_STATUS.map(s => `<option${s === r.status ? " selected" : ""}>${s}</option>`).join("")}</select></td>
    <td>${r.it.cert30 ? `<input type="date" value="${esc(r.e.cert_date || "")}" data-change="cl-set" data-k="${esc(r.key)}" data-f="cert_date"${locked ? " disabled" : ""} aria-label="Certified on">` : '<span class="muted small">—</span>'}</td>
    <td class="filecell">${fileCell(r)}</td>
    <td><input value="${esc(r.e.note || "")}" data-change="cl-set" data-k="${esc(r.key)}" data-f="note"${locked ? " disabled" : ""} placeholder="${r.status === "Not applicable" ? "Why it doesn't apply" : ""}" aria-label="Note"></td></tr>`).join("")).join("")}</tbody></table></div>
  <p class="small muted">Files are kept in the Documents register, linked to this application, with every version. PDF and image files only: save Word or Excel files as PDF first. Passport, UBO and visa files are stored as restricted documents.</p>
  <div class="card"><h3>Other documents requested by the Commission</h3>
   <p class="small muted">Add anything the Commission asks for that is not on the standard list, for example a letter of indemnity, a bank confirmation letter or a certified copy. If it has a format, choose the format and Quayzen prepares it from this application. Otherwise just upload the document on its line.</p>
   ${!locked ? `<form class="f" data-form="clx" data-id="${a.id}"><div class="grid3">
     <div class="fld"><label for="clx_name">Document asked for <span class="req">*</span></label><input id="clx_name" name="name" placeholder="e.g. Letter of indemnity"></div>
     <div class="fld"><label for="clx_ref">Commission's reference</label><input id="clx_ref" name="ref" placeholder="Letter or email reference"></div>
     <div class="fld"><label for="clx_on">Requested on</label><input id="clx_on" type="date" name="requested_on"></div>
     <div class="fld"><label for="clx_due">Due by</label><input id="clx_due" type="date" name="due"></div>
     <div class="fld"><label for="clx_tpl">Format</label><select id="clx_tpl" name="tpl"><option value="">None - upload only</option>${tpls.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div>
     ${reqs.length ? `<div class="fld"><label for="clx_req">Linked Commission request</label><select id="clx_req" name="req_id"><option value="">—</option>${reqs.map(q => `<option value="${q.id}">${esc(String(q.title).slice(0, 60))}</option>`).join("")}</select></div>` : ""}
   </div><div class="row"><button class="btn p">Add to the list</button></div></form>` : ""}
   ${extras.length ? `<p class="small">${extras.length} document(s) added. They appear at the end of the list above.</p>` : ""}
   <div class="tplrow"><span class="small"><b>Letters:</b></span> <span class="small">Reply to the Commission listing these documents</span> ${tplGet("reply") ? tplButtons(tplGet("reply"), "", a.id) : ""}</div>
   <div class="tplrow"><span class="small">Covering letter listing the documents marked Ready</span> ${tplGet("cover") ? tplButtons(tplGet("cover"), "", a.id) : ""}</div>
   <p class="small muted">Change the wording of any format, or replace it with the Commission's own Word file, in <button class="link small" data-act="tpl-list">Documents › Formats and templates</button>.</p></div>
  ${Store.can("documents", "write") ? `<p class="small"><button class="btn sm" data-act="doc-new" data-link-type="apps" data-link-id="${a.id}">Add a document to the Documents register</button></p>` : ""}`;
};

/* ---------- Documents › Formats and templates ---------- */
PAGES.documents = () => {
  const t = curTab("documents", "overview"), tabs = tabsHTML("documents", [["overview", "Overview"], ["list", "All documents"], ["templates", "Formats and templates"]]);
  return tabs + (t === "templates" ? tplListHTML() : t === "list" ? documentsList() : documentsOverview());
};
ACTIONS["tpl-list"] = () => { UI.tab.documents = "templates"; navTo("documents"); };
ACTIONS["tpl-tab"] = ACTIONS["tpl-list"];
const clLineName = k => { const it = CHECKLIST.find(x => x.k === k); return it ? it.t.split(/,|\(/)[0].trim() : k; };
function tplListHTML() {
  const w = Store.can("documents", "write"), all = tplAll();
  return `<div class="card"><h2>Formats and templates</h2><p class="muted small">Documents that have a set format. Each one is filled from a licence application (or your company details) and downloads as Word or PDF. If the Commission gives you its own format, open the template and upload the Commission's Word file: type markers such as <code>{{company_name}}</code> where the details go and Quayzen fills them in. Nothing is signed or sent by Quayzen.</p>
   ${w ? `<div class="row"><button class="btn" data-act="tpl-new">Add a format</button></div>` : ""}</div>
  <div class="tw"><table class="t"><thead><tr><th>Format</th><th>Type</th><th>Used for</th><th>Word file</th><th></th></tr></thead><tbody>
  ${all.map(t => `<tr><td><b>${esc(t.name)}</b>${t.builtin && t.edited ? ' <span class="small muted">(wording changed)</span>' : ""}<div class="small muted">${esc(String(t.src || "").slice(0, 160))}</div></td>
    <td>${badge(t.kind)}</td><td class="small">${(t.lines || []).map(clLineName).map(esc).join("; ") || '<span class="muted">Other documents requested by the Commission</span>'}</td>
    <td class="small">${t.docx_b64 ? esc(t.docx_name || "Word file") : '<span class="muted">—</span>'}</td><td><button class="btn sm" data-act="tpl-open" data-id="${esc(t.id)}">Open</button></td></tr>`).join("")}</tbody></table></div>`;
}
Object.assign(BADGE, { "Commission format": "ok", "Our own format": "info", "Quayzen starter draft": "warn" });
ACTIONS["tpl-open"] = el => go({ kind: "doctpl", id: el.dataset.id });
ACTIONS["tpl-new"] = async () => {
  const id = await Store.save("doc_templates", { name: "New format", kind: "Commission format", src: "", lines: [], body: "[On the company's letterhead]\nDate: {{today}}\n\n# Title\n{{company_name}}\n", docx_b64: null });
  await Store.audit("doc_templates", id, "Created", "Format: New format"); go({ kind: "doctpl", id });
};
VIEWS.doctpl = ({ id }) => {
  const t = tplGet(id); if (!t) return '<p class="empty">Not found. <button class="link" data-act="back">Back</button></p>';
  const w = Store.can("documents", "write"), apps = Store.can("licensing") ? Store.list("apps") : [];
  const aid = UI.params.tplApp !== undefined ? UI.params.tplApp : (apps[0] || {}).id || "", a = aid ? Store.get("apps", aid) : null;
  const ctx = tplCtx(a, ""), { text, blanks } = tplFill(t.body, ctx), mk = tplMarkers(t.body), unknown = mk.filter(k => !TPL_LABEL[k]);
  const dmk = t.docx_markers || [];
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Back</button><h1>${esc(t.name)}</h1><div class="row">${badge(t.kind)}${t.builtin ? '<span class="badge">Supplied with Quayzen</span>' : ""}</div></div>
   <div class="acts">${w && t.builtin && t.edited ? `<button class="btn" data-act="tpl-reset" data-id="${esc(t.id)}">Go back to the Quayzen wording</button>` : ""}${w && !t.builtin ? `<button class="btn" data-act="tpl-archive" data-id="${esc(t.id)}">Remove</button>` : ""}</div></div>
  ${t.kind === "Quayzen starter draft" ? `<div class="card warnbox small">${esc(STARTER)} Replace it with the Commission's format if you have one. Have the wording checked by the company secretary or legal adviser.</div>` : ""}
  <div class="bpgrid"><div>
  <form class="f card" data-form="tpl" data-id="${esc(t.id)}" novalidate><h3>Details and wording</h3>
   <div class="grid2"><div class="fld"><label for="tp_name">Name</label><input id="tp_name" name="name" value="${esc(t.name)}"${w ? "" : " disabled"}></div>
   <div class="fld"><label for="tp_kind">Type</label><select id="tp_kind" name="kind"${w ? "" : " disabled"}>${TPL_KINDS.map(k => `<option${k === t.kind ? " selected" : ""}>${k}</option>`).join("")}</select><span class="help">'Commission format' only if the Commission gave you this format.</span></div></div>
   <div class="fld"><label for="tp_src">Where the format comes from</label><textarea id="tp_src" name="src" rows="2"${w ? "" : " disabled"}>${esc(t.src || "")}</textarea></div>
   <fieldset><legend>Offer it on these lines of the supporting documents list</legend><div class="checks">${CHECKLIST.map(it => `<label class="small"><input type="checkbox" name="line_${it.k}"${(t.lines || []).includes(it.k) ? " checked" : ""}${w ? "" : " disabled"}> ${esc(clLineName(it.k))}</label>`).join("")}</div><span class="help">It can also be chosen for any document the Commission asks for that is not on the list.</span></fieldset>
   <div class="fld"><label for="tp_body">Wording</label><textarea id="tp_body" name="body" rows="18" class="mono"${w ? "" : " disabled"}>${esc(t.body || "")}</textarea>
    <span class="help">A line starting with "# " is a heading. A line starting with "- " is a bullet. Click a marker to insert it where the cursor is. Any other {{marker}} you invent is left as a blank to fill in by hand.</span></div>
   <div class="chips">${TPL_FIELDS.map(([k, l]) => `<button type="button" class="chip mk" data-act="tpl-ins" data-k="${k}" title="${esc(l)}">{{${k}}}</button>`).join("")}</div>
   ${unknown.length ? `<p class="small">Markers left blank for you to fill by hand: ${unknown.map(k => `<code>{{${esc(k)}}}</code>`).join(" ")}</p>` : ""}
   ${w ? `<div class="row"><button class="btn p">Save</button></div>` : ""}</form>
  <div class="card"><h3>Word file (the Commission's or your own)</h3>
   ${t.docx_b64 ? `<p class="small"><b>${esc(t.docx_name || "Word file")}</b> · ${Math.round((t.docx_size || 0) / 1024)} KB · ${dmk.length ? `markers found: ${dmk.map(k => `<code>{{${esc(k)}}}</code>`).join(" ")}` : '<span class="wt">no {{markers}} found yet</span>'}</p>` : '<p class="small muted">No Word file. The Word and PDF downloads are built from the wording above.</p>'}
   <p class="small">Upload the format as a Word (.docx) file, up to ${TPL_MAX_DOCX / 1024} KB. Before uploading, type markers such as <code>{{company_name}}</code> or <code>{{signatory}}</code> into the file where the details go. Quayzen keeps the file's layout and fills only the markers. The wording above is replaced with the text of the file so the PDF matches.</p>
   ${w ? `<div class="row"><label class="btn">${t.docx_b64 ? "Replace the Word file" : "Upload a Word file"}<input type="file" accept=".docx" data-change="tpl-docx" data-id="${esc(t.id)}" hidden></label>${t.docx_b64 ? `<button class="btn" data-act="tpl-docx-del" data-id="${esc(t.id)}">Remove the Word file</button>` : ""}</div>` : ""}</div>
  </div><div>
  <div class="card"><h3>Prepare</h3>
   <div class="fld"><label for="tp_app">Fill from</label><select id="tp_app" data-change="param" data-k="tplApp"><option value=""${!aid ? " selected" : ""}>Company details only</option>${apps.map(x => `<option value="${x.id}"${x.id === aid ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select></div>
   <div class="row">${tplButtons(t, "", aid)}</div>
   ${blanks.length ? `<p class="small wt">Left for you to complete: ${blanks.map(esc).join(", ")}.</p>` : '<p class="small okt">Every marker has a value.</p>'}
   <h4>Preview</h4><div class="bpprev tplprev">${renderTplPreview(text)}</div></div>
  <div class="card"><h3>History</h3>${historyHTML(Store.history("doc_templates", t.id))}</div></div></div>`;
};
function renderTplPreview(text) {
  return tplModel(text, "").blocks.map(b => b.h ? `<h4>${esc(b.h)}</h4>` : b.list ? `<ul>${b.list.map(x => `<li>${tplHi(x)}</li>`).join("")}</ul>` : `<p>${b.p === " " ? "&nbsp;" : tplHi(b.p)}</p>`).join("");
}
const tplHi = s => esc(s).replace(/\[([^\]]{1,60})\]/g, '<mark>[$1]</mark>');
ACTIONS["tpl-ins"] = el => {
  const ta = document.getElementById("tp_body"); if (!ta || ta.disabled) return; const m = `{{${el.dataset.k}}}`, s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s;
  ta.value = ta.value.slice(0, s) + m + ta.value.slice(e); ta.focus(); ta.selectionStart = ta.selectionEnd = s + m.length; UI.typing = true;
};
async function tplSave(id, patch, what) {
  const t = tplGet(id), before = Store.get("doc_templates", id);
  const base = t.builtin && !(before && !before.archived) ? { name: t.name, kind: t.kind, src: t.src, lines: t.lines, body: t.body } : {};
  await Store.save("doc_templates", Object.assign(base, patch, { archived: false }), id);
  await Store.audit("doc_templates", id, before ? "Updated" : "Created", `Format: ${patch.name || t.name} - ${what}`);
}
FORMS.tpl = async form => {
  if (!Store.can("documents", "write")) throw ["Your role cannot change formats."];
  const o = readForm(form), id = form.dataset.id, t = tplGet(id), name = String(o.name || "").trim();
  if (!name) throw ["Give the format a name."];
  const lines = CHECKLIST.filter(it => o["line_" + it.k]).map(it => it.k), patch = { name, kind: o.kind, src: String(o.src || "").trim(), lines, body: String(o.body || "") };
  if (["name", "kind", "src", "body"].every(k => patch[k] === (t[k] || "")) && JSON.stringify(lines) === JSON.stringify(t.lines || [])) { UI.typing = false; return toast("No changes to save.", "info"); }
  await tplSave(id, patch, "wording or details changed"); UI.typing = false; toast("Saved."); render();
};
ACTIONS["tpl-reset"] = async el => {
  const id = el.dataset.id; if (!(await confirmAsk("Go back to the wording supplied with Quayzen? Your changes and any uploaded Word file for this format are removed."))) return;
  await Store.save("doc_templates", { archived: true, docx_b64: null }, id); await Store.audit("doc_templates", id, "Updated", `Format: back to the Quayzen wording`); render();
};
ACTIONS["tpl-archive"] = async el => {
  const id = el.dataset.id, t = tplGet(id); if (!(await confirmAsk(`Remove the format '${t.name}'? Lines that use it fall back to upload only.`))) return;
  await Store.save("doc_templates", { archived: true }, id); await Store.audit("doc_templates", id, "Archived", `Format: ${t.name}`); back();
};
CHANGES["tpl-docx"] = async el => {
  const file = el.files && el.files[0]; el.value = ""; if (!file) return;
  if (!/\.docx$/i.test(file.name)) throw ["Upload a Word file in .docx format. An older .doc file must be saved as .docx first."];
  if (file.size > TPL_MAX_DOCX) throw [`The file is ${Math.round(file.size / 1024)} KB. Formats can be up to ${TPL_MAX_DOCX / 1024} KB - remove large images or logos from the file and try again.`];
  const buf = new Uint8Array(await file.arrayBuffer()), JSZip = await libs.jszip();
  let zip; try { zip = await JSZip.loadAsync(buf); } catch (e) { throw ["This file could not be opened as a Word file."]; }
  const dx = zip.file("word/document.xml"); if (!dx) throw ["This file could not be opened as a Word file."];
  const xml = new TextDecoder("utf-8").decode(await dx.async("uint8array")).replace(/^﻿/, ""), doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw ["This Word file could not be read."];
  let all = ""; for (const p of Object.keys(zip.files).filter(p => /^word\/(header\d*|footer\d*)\.xml$/.test(p))) all += await zip.file(p).async("string");
  const lines = [];
  for (const p of [...doc.getElementsByTagNameNS(WNS, "p")]) { const tx = [...p.getElementsByTagNameNS(WNS, "t")].map(x => x.textContent).join(""); const bold = tx.trim() && tx.length < 120 && p.getElementsByTagNameNS(WNS, "b").length > 0; lines.push(tx.trim() ? (bold ? "# " : "") + tx.trim() : ""); }
  const body = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), markers = tplMarkers(body + "\n" + [...all.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join(""));
  let b64 = ""; for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); b64 = btoa(b64);
  const t = tplGet(el.dataset.id);
  await tplSave(el.dataset.id, { docx_b64: b64, docx_name: file.name, docx_size: file.size, docx_markers: markers, body: body || t.body, kind: t.kind === "Quayzen starter draft" ? "Commission format" : t.kind }, `Word file uploaded (${file.name})`);
  toast(markers.length ? `Uploaded. ${markers.length} marker(s) found.` : "Uploaded. No {{markers}} found yet - type them into the Word file where the details go, then upload it again.", markers.length ? "ok" : "warn"); render();
};
ACTIONS["tpl-docx-del"] = async el => { if (!(await confirmAsk("Remove the Word file from this format? The wording stays."))) return; await tplSave(el.dataset.id, { docx_b64: null, docx_name: null, docx_size: null, docx_markers: null }, "Word file removed"); render(); };

/* ---------- reminders for documents the Commission asked for ---------- */
const _collectRemindersDocs = collectReminders;
collectReminders = function () {
  const out = _collectRemindersDocs();
  if (!Store.can("licensing")) return out;
  for (const a of Store.list("apps").filter(x => !APP_LOCKED.includes(x.status))) for (const r of checklistRows(a).filter(r => r.it.extra && r.it.extra.due && !["Ready", "Not applicable"].includes(r.status))) {
    const d = daysUntil(r.it.extra.due); if (d > 14) continue;
    out.push({ kind: "Document requested by the Commission", title: `${r.it.t} - ${a.title}`, due: r.it.extra.due, days: d, nav: { kind: "app", id: a.id, step: "checklist" }, detail: `Status: ${r.status}`, state: d < 0 ? "Overdue" : d === 0 ? "Due today" : "Due soon" });
  }
  return out.sort((x, y) => x.days - y.days);
};

