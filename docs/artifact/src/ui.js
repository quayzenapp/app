/* ===== ui.js ===== */
/* Shared UI: formatting, forms, validation, generic register screens, import/export plumbing. */


const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtMoney = v => v == null || v === "" ? "" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = v => v == null || v === "" ? "" : (Number(v) % 1 === 0 ? Number(v).toLocaleString("en-US") : fmtMoney(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = d => { if (!d) return ""; const [y, m, dd] = String(d).slice(0, 10).split("-"); return y && m && dd ? `${+dd} ${MONTHS[+m - 1]} ${y}` : d; };
const daysUntil = d => Math.round((new Date(d + "T00:00:00") - new Date(today() + "T00:00:00")) / 86400000);
const r2 = v => Math.round(Number(v) * 100) / 100;

const BADGE = { Approved: "ok", "Approved Internally": "ok", Met: "ok", Active: "ok", Confirmed: "ok", Reviewed: "ok", Received: "info",
  Submitted: "info", New: "info", "In Progress": "warn", "In progress": "warn", "Under Review": "warn", "Under review": "warn",
  "Ready for Review": "warn", "Ready for review": "warn", "Preparing Documents": "warn", "Further Information Requested": "bad",
  "Not met": "bad", Overdue: "bad", Expired: "bad", Queried: "bad", "Pending review": "warn", "Due soon": "warn", "Due today": "bad",
  Missing: "bad", "Has value": "ok", Nil: "info", "Not applicable": "info", "Not available": "warn", Locked: "brand", "Ready for check": "warn", Draft: "", Rejected: "bad" };
const badge = s => s ? `<span class="badge ${BADGE[s] || ""}">${esc(s)}</span>` : "";
const srcTag = s => s ? `<span class="src s-${esc(String(s).replace(/\s/g, "-"))}" title="How this got into the system">${esc(s)}</span>` : "";

function choicesFor(f) { return f.choices || (f.lookup ? LOOKUPS[f.lookup] : []); }

function refLabel(f, v) {
  if (!v) return "";
  const r = Store.get(f.ref, v); if (!r) return "(removed)";
  const d = REG[f.ref]; const tf = d.fmap[d.title];
  if (tf && tf.sensitive && !Store.canSee(tf.sensitive)) return "#" + v.slice(0, 5);
  return f.ref === "employees" ? `${r.ref} ${r.job_title || ""}` : (r[d.title] || "");
}
function display(f, v) {
  if (f.sensitive && !Store.canSee(f.sensitive)) return '<span class="restricted">Restricted</span>';
  if (v == null || v === "") return "";
  if (f.type === "ref") return esc(refLabel(f, v));
  if (f.type === "user") return esc(Store.name(v));
  if (f.type === "money" || f.type === "decimal") return fmtMoney(v);
  if (f.type === "rate") return esc(String(v));
  if (f.type === "date") return fmtDate(v);
  if (f.type === "url") return /^https?:\/\//i.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60))}</a>` : esc(v);
  return esc(v);
}
function plain(f, v) { // for Excel export
  if (f.sensitive && !Store.canSee(f.sensitive)) return "Restricted";
  if (v == null) return "";
  if (f.type === "ref") return refLabel(f, v);
  if (f.type === "user") return Store.name(v);
  return v;
}

function members() { const c = Store.company(); return c ? Object.keys(c.members || {}) : []; }

function inputFor(f, v, opts = {}) {
  const id = "f_" + f.name, req = f.required ? " required" : "";
  if (f.sensitive && !Store.canSee(f.sensitive)) return `<input id="${id}" disabled value="Restricted - your role cannot view or change this">`;
  if (f.readonly && !opts.allowReadonly) return `<input id="${id}" disabled value="${esc(v ?? "")}">`;
  if (f.type === "textarea") return `<textarea id="${id}" name="${f.name}" rows="4"${req}>${esc(v ?? "")}</textarea>`;
  if (f.type === "choice") {
    const ch = choicesFor(f);
    return `<select id="${id}" name="${f.name}"${req}><option value="">—</option>${ch.map(o => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}${v && !ch.includes(v) ? `<option selected>${esc(v)}</option>` : ""}</select>`;
  }
  if (f.type === "ref") {
    const d = REG[f.ref];
    return `<select id="${id}" name="${f.name}"><option value="">—</option>${Store.list(f.ref).map(r => `<option value="${r.id}"${r.id === v ? " selected" : ""}>${esc(refLabel(f, r.id))}</option>`).join("")}</select>`;
  }
  if (f.type === "user") return `<select id="${id}" name="${f.name}"><option value="">—</option>${members().map(u => `<option value="${u}"${u === v ? " selected" : ""}>${esc(Store.name(u))}</option>`).join("")}</select>`;
  if (f.type === "date") return `<input type="date" id="${id}" name="${f.name}" value="${esc(v ?? "")}"${req}>`;
  if (["int", "decimal", "money", "rate"].includes(f.type)) return `<input type="text" inputmode="decimal" id="${id}" name="${f.name}" value="${esc(v ?? "")}"${req}>`;
  if (f.type === "url") return `<input type="url" id="${id}" name="${f.name}" value="${esc(v ?? "")}" placeholder="https://"${req}>`;
  if (f.list) return `<input type="text" id="${id}" name="${f.name}" value="${esc(v ?? "")}" list="${f.list}"${req}><datalist id="${f.list}">${(LOOKUPS[f.list] || []).map(o => `<option>${esc(o)}</option>`).join("")}</datalist>`;
  if (f.type === "currency") return `<input type="text" id="${id}" name="${f.name}" value="${esc(v ?? "")}" maxlength="3" list="currencies" style="text-transform:uppercase"${req}>`;
  return `<input type="text" id="${id}" name="${f.name}" value="${esc(v ?? "")}"${req}>`;
}

/* Parse and validate one raw value; throws message string */
function cleanValue(f, raw) {
  if (raw == null) return null;
  if (typeof raw === "string") { raw = raw.trim(); if (raw === "") return null; }
  if (f.type === "int") { const n = Number(String(raw).replace(/,/g, "")); if (!Number.isFinite(n)) throw `${f.label}: please enter a whole number.`; return Math.round(n); }
  if (["decimal", "money", "rate"].includes(f.type)) { const n = Number(String(raw).replace(/,/g, "")); if (!Number.isFinite(n)) throw `${f.label}: please enter a number.`; return n; }
  if (f.type === "date") {
    if (typeof raw === "number") { const d = new Date(Math.round((raw - 25569) * 86400000)); return d.toISOString().slice(0, 10); } // Excel serial
    if (raw instanceof Date) return raw.toISOString().slice(0, 10);
    const s = String(raw).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s))) throw `${f.label}: use the date format YYYY-MM-DD.`; return s;
  }
  if (f.type === "url") { const s = String(raw); if (!/^https?:\/\/\S+$/i.test(s)) throw `${f.label}: enter a full web address starting with https://`; return s; }
  if (f.type === "currency") { const s = String(raw).toUpperCase(); if (!/^[A-Z]{3}$/.test(s)) throw `${f.label}: use a three-letter code such as USD or LKR.`; return s; }
  if (f.type === "choice") { const ch = choicesFor(f); if (!ch.includes(String(raw))) throw `${f.label}: '${raw}' is not one of: ${ch.join(", ")}.`; }
  return String(raw);
}

/* Calculated fields kept consistent on every save. Returns notes. */
function derive(type, rec, before) {
  const notes = [], def = REG[type];
  if (def.money) {
    if (before) {
      const meth = before.conversion_method || "";
      const changed = ["original_amount", "original_currency", "usd_rate", "lkr_rate"].some(k => String(before[k]) !== String(rec[k]));
      if (changed) {
        if ((/per USD|USD: same/.test(meth)) && String(rec.usd_amount) === String(before.usd_amount)) rec.usd_amount = null;
        if ((/LKR per|LKR: same/.test(meth)) && String(rec.lkr_amount) === String(before.lkr_amount)) rec.lkr_amount = null;
      }
    }
    const amt = rec.original_amount, cur = (rec.original_currency || "").toUpperCase(), m = [];
    if (amt != null && cur) {
      if (cur === "USD") { rec.usd_amount = r2(amt); rec.usd_rate = 1; m.push("USD: same currency"); }
      else if (rec.usd_amount != null) m.push("USD: entered by user");
      else if (rec.usd_rate) { rec.usd_amount = r2(amt / rec.usd_rate); m.push(`USD: ${cur} amount / ${rec.usd_rate} ${cur} per USD`); }
      else notes.push(`No USD figure: add a USD rate or the USD amount if this ${cur} amount must be reported in USD.`);
      if (cur === "LKR") { rec.lkr_amount = r2(amt); rec.lkr_rate = 1; m.push("LKR: same currency"); }
      else if (rec.lkr_amount != null) m.push("LKR: entered by user");
      else if (rec.lkr_rate) { rec.lkr_amount = r2(amt * rec.lkr_rate); m.push(`LKR: ${cur} amount x ${rec.lkr_rate} LKR per ${cur}`); }
      rec.conversion_method = m.join("; ") || null;
      if (!["USD", "LKR"].includes(cur) && rec.usd_amount != null && !(rec.rate_date && rec.rate_source)) notes.push("Please record the exchange rate date and source.");
    }
  }
  if ((type === "offices" || type === "rent_options") && rec.floor_area != null) {
    const k = 10.7639104;
    if (rec.area_unit === "sqft") { rec.area_sqm = r2(rec.floor_area / k); rec.area_sqft = r2(rec.floor_area); }
    else { rec.area_sqm = r2(rec.floor_area); rec.area_sqft = r2(rec.floor_area * k); }
  }
  if (type === "employees") {
    if (!rec.nationality_group && rec.nationality) rec.nationality_group = ["sri lankan", "sri lanka", "lk"].includes(rec.nationality.trim().toLowerCase()) ? "Sri Lankan" : "Non-Sri Lankan";
    if (rec.position_id) { const p = Store.get("positions", rec.position_id); if (p) { if (!rec.job_title) rec.job_title = p.title; if (!rec.staff_category) rec.staff_category = p.staff_category; } }
    if (rec.end_date && rec.start_date && rec.end_date < rec.start_date) throw ["End date cannot be before the start date."];
  }
  return notes;
}

function validateRec(def, rec) {
  const errs = [];
  for (const f of def.fields) {
    if (f.readonly) continue;
    if (f.required && (rec[f.name] == null || rec[f.name] === "") && !(f.sensitive && !Store.canSee(f.sensitive))) errs.push(`${f.label} is required.`);
    if (f.type === "ref" && rec[f.name] && !Store.get(f.ref, rec[f.name])) errs.push(`${f.label}: linked record not found.`);
  }
  return errs;
}

function diff(def, a, b) {
  const out = [];
  for (const f of def.fields) {
    const o = (a || {})[f.name], n = (b || {})[f.name];
    if ((o == null || o === "") && (n == null || n === "")) continue;
    if (String(o) === String(n)) continue;
    out.push(f.sensitive ? { label: f.label, old: "[restricted]", new: "[restricted - changed]" } : { label: f.label, old: o ?? null, new: n ?? null });
  }
  return out;
}

/* Save a register record from raw values. Returns {id, notes}. Throws array of errors. */
async function saveRecord(type, raw, id, source) {
  const def = REG[type], before = id ? Store.get(type, id) : null;
  const rec = Object.assign({}, before || {});
  delete rec.id;
  const errs = [];
  for (const f of def.fields) {
    if (f.readonly && !(raw.__allow || []).includes(f.name)) continue;
    if (f.sensitive && !Store.canSee(f.sensitive)) continue;
    if (!(f.name in raw)) { if (!id && f.dflt !== undefined && rec[f.name] == null) rec[f.name] = f.dflt; continue; }
    try { rec[f.name] = cleanValue(f, raw[f.name]); } catch (e) { errs.push(e); }
  }
  for (const k of Object.keys(raw)) if (k.startsWith("x_") || ["status", "review_status", "reviewed_by", "reviewed_at", "data_source", "import_batch"].includes(k) && (raw.__allow || []).includes(k)) rec[k] = raw[k];
  if (errs.length) throw errs;
  let notes;
  try { notes = derive(type, rec, before); } catch (e) { throw e; }
  const v = validateRec(def, rec); if (v.length) throw v;
  if (source && !id) rec.data_source = source;
  const changes = diff(def, before, rec);
  if (def.reviewable && before && ["Reviewed", "Confirmed"].includes(before.review_status) && changes.length) {
    rec.review_status = "Not reviewed"; rec.reviewed_by = null; rec.reviewed_at = null;
    notes.push("This record changed after review, so it needs reviewing again.");
  }
  if (!id && def.reviewable && !rec.review_status) rec.review_status = "Not reviewed";
  const newId = await Store.save(type, rec, id);
  if (!raw.__nolog) await Store.audit(type, newId, id ? "Updated" : (source === "Imported" ? "Created (imported)" : "Created"),
    `${def.label}${def.fmap[def.title] && !def.fmap[def.title].sensitive ? ": " + (rec[def.title] ?? "") : ""}`, changes.length ? changes : null);
  return { id: newId, notes };
}

/* ---------------- toast and confirm ---------------- */
function toast(msg, kind = "ok") {
  const t = document.createElement("div"); t.className = "toast " + kind; t.textContent = msg; t.setAttribute("role", "status");
  document.getElementById("toasts").appendChild(t); setTimeout(() => t.remove(), kind === "bad" ? 7000 : 4000); return t;
}
function showErrors(list) { (Array.isArray(list) ? list : [String(list)]).slice(0, 6).forEach(m => toast(typeof m === "string" ? m : (m.message || String(m)), "bad")); }

/* ---------------- generic register screens ---------------- */
function listHTML(type, opts = {}) {
  const def = REG[type], cols = def.list.map(n => def.fmap[n]);
  const q = (UI.filter[type] || "").toLowerCase();
  let rows = Store.list(type, { archived: UI.showArchived[type] });
  if (opts.where) rows = rows.filter(opts.where);
  if (q) rows = rows.filter(r => def.fields.some(f => !f.sensitive || Store.canSee(f.sensitive) ? String(plain(f, r[f.name]) ?? "").toLowerCase().includes(q) : false));
  rows.sort(opts.sort || ((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))));
  const w = Store.can(def.module, "write"), linkCol = def.list.includes(def.title) ? def.title : def.list[0];
  return `<div class="head"><div class="t"><h1>${esc(opts.title || def.plural)}</h1>${def.intro ? `<p class="muted">${esc(def.intro)}</p>` : ""}</div>
   <div class="acts">${w && !opts.noAdd ? `<button class="btn p" data-act="new" data-type="${type}">Add ${esc(def.label.toLowerCase())}</button>` : ""}
   ${w && def.importable ? `<button class="btn" data-act="import" data-type="${type}">Import from Excel</button>` : ""}
   <button class="btn" data-act="export-list" data-type="${type}">Export to Excel</button></div></div>
   ${opts.noHL ? "" : hlFor(type)}${opts.above || ""}
   <div class="row" style="margin-bottom:10px"><input type="search" placeholder="Search…" value="${esc(UI.filter[type] || "")}" data-filter="${type}" aria-label="Search" style="max-width:280px">
   <label class="muted small"><input type="checkbox" data-act="toggle-archived" data-type="${type}"${UI.showArchived[type] ? " checked" : ""}> include archived</label></div>
   <div class="tw"><table class="t"><thead><tr>${cols.map(c => `<th class="${["money", "decimal", "int"].includes(c.type) ? "num" : ""}">${esc(c.label)}</th>`).join("")}<th>Source</th>${def.reviewable ? "<th>Review</th>" : ""}</tr></thead><tbody>
   ${rows.map(r => `<tr>${cols.map(c => `<td class="${["money", "decimal", "int"].includes(c.type) ? "num" : ""}">${c.name === linkCol ? `<a href="#" data-act="open" data-type="${type}" data-id="${r.id}">${display(c, r[c.name]) || "(open)"}</a>${r.archived ? ' <span class="badge">archived</span>' : ""}` : (["status", "application_status"].includes(c.name) ? badge(r[c.name]) : display(c, r[c.name]))}</td>`).join("")}<td>${srcTag(r.data_source)}</td>${def.reviewable ? `<td>${badge(r.review_status)}</td>` : ""}</tr>`).join("") || `<tr><td colspan="${cols.length + 2}" class="empty">Nothing recorded yet.</td></tr>`}
   </tbody></table></div><p class="muted small">${rows.length} record(s).</p>${opts.below || ""}`;
}

function groupsOf(def) {
  const g = [];
  def.fields.forEach(f => { const n = f.group || "Details"; let x = g.find(y => y[0] === n); if (!x) { x = [n, []]; g.push(x); } x[1].push(f); });
  return g;
}

function formHTML(type, id, defaults = {}) {
  const def = REG[type], rec = id ? Store.get(type, id) : Object.assign({}, ...def.fields.filter(f => f.dflt !== undefined).map(f => ({ [f.name]: f.dflt })), defaults);
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Back</button><h1>${id ? "Edit" : "Add"} ${esc(def.label.toLowerCase())}</h1>${def.intro ? `<p class="muted">${esc(def.intro)}</p>` : ""}</div></div>
  <form class="f" data-form="record" data-type="${type}" data-id="${id || ""}" novalidate>
  ${groupsOf(def).map(([g, fs]) => `<fieldset><legend>${esc(g)}</legend>${g === "Amount and currency" ? `<p class="help">Enter the original amount and currency exactly as on the bank record or invoice. <button type="button" class="btn sm" data-act="fill-rate">Fill rates from exchange rate table</button></p><div class="note" id="conv-hint"></div>` : ""}
  <div class="grid2">${fs.map(f => `<div class="fld${f.type === "textarea" ? " wide" : ""}"><label for="f_${f.name}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ""}${f.sensitive ? ' <span class="badge brand">restricted</span>' : ""}</label>${inputFor(f, rec ? rec[f.name] : null)}${f.help ? `<span class="help">${esc(f.help)}</span>` : ""}</div>`).join("")}</div></fieldset>`).join("")}
  <div class="row"><button class="btn p" type="submit">Save</button><button class="btn" type="button" data-act="back">Cancel</button></div></form>
  <datalist id="currencies">${["USD", "LKR", "GBP", "EUR", "SGD", "INR", "AED", "CNY", "JPY", "AUD", "HKD"].map(c => `<option>${c}</option>`).join("")}</datalist>`;
}

function readForm(form) {
  const o = {}; new FormData(form).forEach((v, k) => o[k] = v); return o;
}

function viewHTML(type, id, extra = "") {
  const def = REG[type], r = Store.get(type, id);
  if (!r) return `<div class="card empty">This record no longer exists. <button class="link" data-act="back">Back</button></div>`;
  const w = Store.can(def.module, "write"), ap = Store.can(def.module, "approve");
  const hist = Store.history(type, id);
  const docs = Store.list("docs").filter(d => d.link_type === type && d.link_id === id && (d.access === "Normal" || canRestrictedDocs()));
  return `<div class="head"><div class="t"><button class="link" data-act="back">← ${esc(def.plural)}</button>
   <h1>${def.fmap[def.title].sensitive && !Store.canSee(def.fmap[def.title].sensitive) ? esc(def.label) : esc(r[def.title] || def.label)}</h1>
   <div class="row">${srcTag(r.data_source)}${def.reviewable ? badge(r.review_status) : ""}${r.archived ? '<span class="badge">archived</span>' : ""}</div></div>
   <div class="acts">${w ? `<button class="btn p" data-act="edit" data-type="${type}" data-id="${id}">Edit</button>` : ""}
   ${Store.can("documents", "write") ? `<button class="btn" data-act="doc-new" data-link-type="${type}" data-link-id="${id}">Attach document</button>` : ""}
   ${w && !r.archived ? `<button class="btn bad" data-act="archive" data-type="${type}" data-id="${id}">Archive</button>` : ""}</div></div>
   ${extra}
   ${def.reviewable ? `<div class="card"><h3>${type === "investments" ? "Classification review" : "Review"}</h3><p>Status: ${badge(r.review_status)} ${r.reviewed_by ? `by ${esc(Store.name(r.reviewed_by))} on ${fmtDate(r.reviewed_at)}` : ""}</p>
     ${ap ? `<div class="row"><button class="btn ok" data-act="review" data-type="${type}" data-id="${id}" data-status="${type === "investments" ? "Confirmed" : "Reviewed"}">${type === "investments" ? "Confirm classification" : "Mark reviewed"}</button><button class="btn bad" data-act="review" data-type="${type}" data-id="${id}" data-status="Queried">Query</button></div>` : '<p class="muted small">A reviewer with approval rights confirms this.</p>'}</div>` : ""}
   ${groupsOf(def).map(([g, fs]) => `<div class="card"><h3>${esc(g)}</h3><dl class="kv">${fs.map(f => `<dt>${esc(f.label)}</dt><dd>${["status", "application_status"].includes(f.name) ? badge(r[f.name]) : (display(f, r[f.name]) || "—")}</dd>`).join("")}</dl></div>`).join("")}
   <div class="card"><h3>Linked documents</h3>${docs.map(d => `<div><a href="#" data-act="doc-open" data-id="${d.id}">${esc(d.title)}</a> <span class="muted small">v${(d.versions || []).length}</span></div>`).join("") || '<p class="muted">None.</p>'}</div>
   <div class="card"><h3>Change history</h3><p class="muted small">Created ${esc(r.created_at || "")} by ${esc(Store.name(r.created_by))} · updated ${esc(r.updated_at || "")} by ${esc(Store.name(r.updated_by))}</p>${historyHTML(hist)}</div>`;
}

function historyHTML(hist) {
  if (!hist.length) return '<p class="muted">No history yet.</p>';
  return `<div class="tw"><table class="t"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead><tbody>${hist.slice(0, 200).map(h => `<tr><td class="nowrap">${esc(h.at)}</td><td>${esc(Store.name(h.by))}</td><td>${esc(h.action)}</td><td>${esc(h.summary)}${h.changes && h.changes.length ? `<details><summary class="small">${h.changes.length} change(s)</summary>${h.changes.map(c => `<div class="small"><b>${esc(c.label)}</b>: ${esc(c.old ?? "—")} → ${esc(c.new ?? "—")}</div>`).join("")}</details>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
}
function canRestrictedDocs() { return Store.canSee("id") || Store.canSee("ubo"); }

/* ---------------- Excel import ---------------- */
function importableFields(def) { return def.fields.filter(f => !f.readonly && (!f.sensitive || Store.canSee(f.sensitive))); }

async function importTemplate(type) {
  const def = REG[type]; const X = await libs.xlsx();
  const fs = importableFields(def);
  const ws = X.utils.aoa_to_sheet([fs.map(f => f.label + (f.required ? " *" : ""))]);
  ws["!cols"] = fs.map(f => ({ wch: Math.min(40, Math.max(14, f.label.length + 3)) }));
  const help = [["Import template: " + def.plural], [], ["Fill one row per record on the Data sheet. Keep the headings."], ["Columns marked * are required."],
    ["Dates: YYYY-MM-DD or an Excel date. Currency: three letters, e.g. USD."], ["Linked records (Position, Office): type the name exactly as in the system."],
    ["Nothing is saved until you check the preview and confirm."], [], ["Column", "Allowed values / help"],
    ...fs.map(f => [f.label, (choicesFor(f).join("; ") || f.type) + (f.help ? " — " + f.help : "")])];
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, "Data"); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(help), "How to fill this in");
  await saveFile(`import_template_${type}.xlsx`, new Blob([X.write(wb, { type: "array", bookType: "xlsx" })]));
}

async function parseImport(type, file) {
  const def = REG[type]; const X = await libs.xlsx();
  const wb = X.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const ws = wb.Sheets["Data"] || wb.Sheets[wb.SheetNames[0]];
  const rows = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const heads = (rows[0] || []).map(h => String(h || "").replace(" *", "").trim().toLowerCase());
  const fs = importableFields(def), map = {}, unknown = [];
  heads.forEach((h, i) => { if (!h) return; const f = fs.find(x => x.label.toLowerCase() === h || x.name === h); if (f) map[i] = f; else unknown.push(h); });
  const out = [];
  rows.slice(1).forEach((row, n) => {
    if (!row || row.every(v => v == null || v === "")) return;
    const data = {}, errors = [];
    for (const [i, f] of Object.entries(map)) {
      let v = row[i];
      if (v instanceof Date) v = new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      if (f.type === "ref" && v != null && v !== "") {
        const s = String(v).trim().toLowerCase();
        const hit = Store.list(f.ref).find(r => ["title", "name", "ref", "number"].some(k => r[k] && String(r[k]).toLowerCase() === s));
        if (!hit) { errors.push(`${f.label}: '${v}' not found`); continue; } v = hit.id;
      }
      if (f.type === "user" && v) { errors.push(`${f.label}: assign people after importing`); continue; }
      try { data[f.name] = cleanValue(f, v); } catch (e) { errors.push(e); }
    }
    if (!errors.length) { const rec = Object.assign({}, ...def.fields.filter(f => f.dflt !== undefined).map(f => ({ [f.name]: f.dflt })), data);
      try { derive(type, rec); errors.push(...validateRec(def, rec)); } catch (e) { errors.push(...[].concat(e)); } }
    out.push({ row: n + 2, data, errors });
  });
  return { rows: out, unknown, mapped: Object.values(map).map(f => f.label) };
}

/* ---------------- lazy libraries and file saving ---------------- */
/* Helper libraries load only when needed. Each has a second source in case the first is unavailable. */
const LIB_URLS = {
  xlsx: ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"],
  jspdf: ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"],
  autotable: ["https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js", "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"],
  exceljs: ["https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js", "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"],
  pdflib: ["https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js", "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js"],
  docx: ["https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js", "https://unpkg.com/docx@8.5.0/build/index.umd.js"],
};
const _libP = {};
function loadScript(url) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = url; s.onload = res; s.onerror = () => { s.remove(); rej(new Error("Could not load a helper library. Check your connection and try again.")); }; document.head.appendChild(s); }); }
async function loadAny(urls, ready) { let err; for (const u of [].concat(urls)) { try { await loadScript(u); const g = ready(); if (g) return g; } catch (e) { err = e; } } throw err || new Error("Could not load a helper library."); }
const lib = (k, ready) => () => (_libP[k] = _libP[k] || loadAny(LIB_URLS[k], ready).catch(e => { delete _libP[k]; throw e; }));
const libs = {
  xlsx: lib("xlsx", () => window.XLSX),
  jspdf: lib("jspdf", () => window.jspdf && window.jspdf.jsPDF),
  autotable: lib("autotable", () => window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable),
  exceljs: lib("exceljs", () => window.ExcelJS),
  pdflib: lib("pdflib", () => window.PDFLib),
  docx: lib("docx", () => window.docx),
};
async function saveFile(filename, blob) {
  let dl = null; try { dl = await window.claude?.use?.("downloads"); } catch (e) { }
  if (!dl) { toast("Downloads are not available in this view. Open the page in claude.ai to download files.", "bad"); return false; }
  try { await dl.save({ filename, data: blob }); return true; }
  catch (e) { if (e && e.code === "declined") return false; toast(e && e.code === "rate_limited" ? "A download prompt is already open." : "The file could not be saved here.", "bad"); return false; }
}

