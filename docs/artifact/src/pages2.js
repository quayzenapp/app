/* ===== pages2.js ===== */
/* Screens, part 2: Annual Returns, Licences and Obligations, Visas, Documents, Reports, How it works, Setup, demo data. */


/* ======================= ANNUAL RETURNS ======================= */
const STL = { value: "Has value", nil: "Nil", not_applicable: "Not applicable", not_available: "Not available", missing: "Missing" };
PAGES.returns = () => {
  const t = curTab("returns", "overview");
  const tabs = tabsHTML("returns", [["overview", "Overview"], ["returns", "Annual returns"], ["fin", "Financial records"], ["housing", "Staff residential units"]]);
  if (t === "overview") return tabs + returnsOverview();
  if (t === "fin") return tabs + listHTML("fin_entries", { above: '<p class="note">These records feed the annual return. Revenue needs a customer country; staff costs need a staff group (Sri Lankan / Non-Sri Lankan); office rent needs the office. A reviewer marks records reviewed.</p>' });
  if (t === "housing") return tabs + listHTML("housing");
  const rs = Store.list("returns").sort((a, b) => b.period_end.localeCompare(a.period_end)), w = Store.can("returns", "write");
  return tabs + `<div class="head"><div class="t"><h1>Annual returns</h1><p class="muted">Built on the Annual Return Submission Form 2026 (${esc(AR_TEMPLATE.source)}). Figures are worked out from your records, you check each line, a second person approves, and the system fills the Commission's original PDF for you to download, sign and submit yourself.</p></div>
   <div class="acts">${w ? '<button class="btn p" data-act="ar-new">Start an annual return</button>' : ""}</div></div>
   ${(() => { const r = rs[0]; if (!r) return ""; const n = Object.keys(r.lines || {}).length, miss = arMissing(r).length; return hlCards([{ value: r.status, label: "Latest return: " + r.title }, { value: `${n} of ${AR_TEMPLATE.lines.length}`, label: "Lines set" }, { value: miss, label: "Lines not set or missing", kind: miss ? "warn" : "" }, { value: Store.list("fin_entries").filter(x => x.entry_date >= r.period_start && x.entry_date <= r.period_end).length, label: "Financial records in the period" }]); })()}
   <div class="tw"><table class="t"><thead><tr><th>Return</th><th>Period</th><th>Status</th><th>Lines set</th><th>Approved</th><th>Submitted</th></tr></thead><tbody>
   ${rs.map(r => { const n = Object.keys(r.lines || {}).length; return `<tr><td><a href="#" data-act="ar-open" data-id="${r.id}">${esc(r.title)}</a></td><td>${fmtDate(r.period_start)} to ${fmtDate(r.period_end)}</td><td>${badge(r.status)}</td><td>${n} of ${AR_TEMPLATE.lines.length}</td><td>${r.approved_at ? esc(r.approved_at.slice(0, 10)) : ""}</td><td>${fmtDate(r.submitted_at)}</td></tr>`; }).join("") || '<tr><td colspan="6" class="empty">No annual return yet.</td></tr>'}</tbody></table></div>`;
};
ACTIONS["ar-open"] = el => go({ kind: "arview", id: el.dataset.id });
ACTIONS["ar-new"] = () => { const p = AR_TEMPLATE.period;
  openModal(`<h2>Start an annual return</h2><p class="muted">The 2026 form covers 1 April 2025 to 31 March 2026. Change the dates only if the Commission asked for a different period.</p><form class="f" data-form="ar-new"><div class="grid2">
   ${fieldRow("Title", '<input name="title" value="Annual Return 2025/26" required>')}${fieldRow("Currency method", `<select name="currency_method"><option value="split">Split by transaction currency (default)</option><option value="both">Full totals in both USD and LKR</option></select>`, AR_TEMPLATE.note)}
   ${fieldRow("Period start", `<input type="date" name="period_start" value="${p.start}" required>`)}${fieldRow("Period end", `<input type="date" name="period_end" value="${p.end}" required>`)}
   ${fieldRow("Headcount as at", `<input type="date" name="headcount_as_at" value="${p.headcount}" required>`)}${fieldRow("Office space as at", `<input type="date" name="office_as_at" value="${p.end}" required>`)}</div>
   <div class="row"><button class="btn p">Create</button><button type="button" class="btn" data-act="modal-close">Cancel</button></div></form>`); };
FORMS["ar-new"] = async form => { const o = readForm(form); if (o.period_end < o.period_start) throw ["The period end is before the start."];
  const id = await Store.save("returns", Object.assign(o, { template: AR_TEMPLATE.code, status: "Draft", lines: {}, prepared_by: Store.uid }));
  await Store.audit("returns", id, "Created", o.title); closeModal(); go({ kind: "arview", id }); };

function arVal(l, s) {
  if (!s) return "";
  if (s.status !== "value") return STL[s.status] || s.status;
  if (l.kind === "table") return s.text ? JSON.parse(s.text).map(x => `${x.country}: ${x.currency} ${fmtMoney(x.amount)}`).join("; ") : "";
  if (["amount", "area"].includes(l.kind)) return fmtMoney(s.num);
  if (l.kind === "count") return String(s.num);
  return s.text || "";
}
const sameCalc = (s, c) => c && String(s.num ?? "") === String(c.num ?? "") && String(s.text ?? "") === String(c.text ?? "") && s.status === c.status;

VIEWS.arview = ({ id }) => {
  const r = Store.get("returns", id); if (!r) return '<p class="empty">Not found.</p>';
  const c = Store.company(), calc = arCompute(Store, r, c); UI.calc = calc;
  const w = Store.can("returns", "write"), ap = Store.can("returns", "approve"), edit = w && r.status === "Draft";
  const L = r.lines || {}, cnt = {}; AR_TEMPLATE.lines.forEach(l => { const k = L[l.key] ? L[l.key].status : "notset"; cnt[k] = (cnt[k] || 0) + 1; });
  const stale = AR_TEMPLATE.lines.filter(l => L[l.key] && L[l.key].source === "Calculated" && calc[l.key] && !sameCalc(L[l.key], calc[l.key])).length;
  const bySec = {}; AR_TEMPLATE.lines.forEach(l => (bySec[l.section] = bySec[l.section] || []).push(l));
  const snap = r.snapshot_id ? Store.get("snapshots", r.snapshot_id) : null;
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Annual returns</button><h1>${esc(r.title)}</h1>
   <p class="muted">Period ${fmtDate(r.period_start)} to ${fmtDate(r.period_end)} · headcount as at ${fmtDate(r.headcount_as_at)} · office space as at ${fmtDate(r.office_as_at)} · ${r.currency_method === "split" ? "currency split by transaction currency" : "full totals in USD and LKR"}</p><div class="row">${badge(r.status)}${snap ? `<span class="mono small">Approved snapshot ${snap.version_no}, fingerprint ${snap.hash.slice(0, 16)}</span>` : ""}</div></div>
   <div class="acts">${edit ? `<button class="btn" data-act="ar-accept-all" data-id="${r.id}">Use calculated values for lines not yet set</button><button class="btn" data-act="ar-ready" data-id="${r.id}">Mark ready for review</button>` : ""}
    ${r.status === "Ready for review" && ap ? `<button class="btn ok" data-act="ar-approve" data-id="${r.id}">Approve and keep a snapshot</button>` : ""}
    ${["Ready for review", "Approved"].includes(r.status) && w ? `<button class="btn" data-act="ar-reopen" data-id="${r.id}">Reopen for changes</button>` : ""}
    ${r.status === "Approved" && w ? `<button class="btn" data-act="ar-sub" data-id="${r.id}">Record submission</button>` : ""}
    <button class="btn p" data-act="ar-pdf" data-id="${r.id}">${["Approved", "Submitted"].includes(r.status) ? "Fill the official PDF" : "Fill a draft of the official PDF"}</button>
    <button class="btn" data-act="ar-report" data-id="${r.id}">Working report</button></div></div>
   <div class="stats">${statCard(cnt.value || 0, "lines with a value")}${statCard((cnt.nil || 0) + (cnt.not_applicable || 0) + (cnt.not_available || 0), "Nil / not applicable / not available")}${statCard((cnt.missing || 0) + (cnt.notset || 0), "not set or missing", null, (cnt.missing || 0) + (cnt.notset || 0) ? "warn" : "")}${stale ? statCard(stale, "calculated lines where records have changed", null, "bad") : ""}</div>
   ${edit ? "" : `<p class="note">${r.status === "Draft" ? "You can view this return but your role cannot change it." : "Lines are locked while the return is " + esc(r.status.toLowerCase()) + ". Reopen it to change a line; the approved snapshot is kept."}</p>`}
   ${Object.entries(bySec).map(([sec, ls]) => `<div class="card"><h3>${esc(sec)}</h3><div class="tw"><table class="t ar"><thead><tr><th>Ref</th><th>Item</th><th>Worked out from records</th><th>Value for the return</th><th>Status</th><th></th></tr></thead><tbody>
    ${ls.map(l => { const s = L[l.key], k = calc[l.key], st = s && s.source === "Calculated" && k && !sameCalc(s, k);
      return `<tr class="${!s || s.status === "missing" ? "miss" : ""}"><td class="small">${esc(l.ref || "")}</td><td>${esc(l.label)}${l.note ? `<div class="help">${esc(l.note)}</div>` : ""}${!l.pdf && !["doc", "confirm", "table"].includes(l.kind) && !l.shared025 ? '<div class="help">No field in the 2026 PDF: enter by hand.</div>' : ""}</td>
       <td class="small">${k ? esc(arVal(l, k)) + (k.detail.warnings.length ? ` <span class="badge warn" title="${esc(k.detail.warnings.join(" "))}">!</span>` : "") : '<span class="muted">entered by you</span>'}</td>
       <td>${esc(arVal(l, s))}${s && s.explanation ? `<div class="help">${esc(s.explanation)}</div>` : ""}${st ? '<div class="help bad">Records changed since this was accepted.</div>' : ""}</td>
       <td>${s ? badge(STL[s.status]) + `<div class="help">${esc(s.source || "")}</div>` : '<span class="badge">Not set</span>'}</td>
       <td><button class="btn sm" data-act="ar-line" data-id="${r.id}" data-k="${l.key}">${edit ? "Check / set" : "Details"}</button></td></tr>`; }).join("")}</tbody></table></div></div>`).join("")}
   <div class="card"><h3>History</h3>${historyHTML(Store.history("returns", r.id))}</div>`;
};

ACTIONS["ar-line"] = el => {
  const r = Store.get("returns", el.dataset.id), l = AR_TEMPLATE.lines.find(x => x.key === el.dataset.k);
  const s = (r.lines || {})[l.key], k = UI.calc[l.key], edit = Store.can("returns", "write") && r.status === "Draft";
  const recName = e => e.source_name || e.description || e.name || e.ref || e.job_title || e.id;
  const det = k ? `<div class="card soft"><h3>How it was worked out</h3><p class="small">${esc(k.detail.explanation)}</p><p><b>Result:</b> ${esc(arVal(l, k)) || "nothing found"}</p>
    ${k.detail.warnings.map(x => `<p class="note small">${esc(x)}</p>`).join("")}
    ${k.detail.used.length ? `<details><summary class="small">${k.detail.used.length} record(s) used</summary><table class="t small"><tbody>${k.detail.used.slice(0, 40).map(u => `<tr><td>${esc(u.e.entry_date || u.e.start_date || "")}</td><td>${esc(recName(u.e))}</td><td>${esc(u.e.original_currency || "")} ${u.e.original_amount != null ? fmtMoney(u.e.original_amount) : ""}</td><td class="num">${typeof u.used === "number" ? fmtMoney(u.used) : ""}</td></tr>`).join("")}</tbody></table></details>` : ""}
    ${k.detail.excluded.length ? `<details open><summary class="small">${k.detail.excluded.length} record(s) left out</summary>${k.detail.excluded.map(x => `<div class="small">${esc(recName(x.e))}: ${esc(x.reason)}</div>`).join("")}</details>` : ""}</div>` : '<p class="muted">This line is not worked out from records. Enter it yourself.</p>';
  let valInput = "";
  const cur = s && s.status === "value" ? s : null;
  if (l.kind === "table") valInput = `<textarea name="value" rows="5" placeholder="One row per line: Country ; Currency ; Amount">${esc(cur && cur.text ? JSON.parse(cur.text).map(x => `${x.country} ; ${x.currency} ; ${x.amount}`).join("\n") : "")}</textarea>`;
  else if (l.kind === "bool") valInput = `<select name="value"><option${cur && cur.text === "Yes" ? " selected" : ""}>Yes</option><option${cur && cur.text === "No" ? " selected" : ""}>No</option></select>`;
  else if (["amount", "area", "count"].includes(l.kind)) valInput = `<input name="value" inputmode="decimal" value="${esc(cur ? cur.num : "")}">`;
  else if (l.kind === "longtext") valInput = `<textarea name="value" rows="3">${esc(cur ? cur.text : "")}</textarea>`;
  else valInput = `<input name="value" value="${esc(cur ? cur.text : "")}">`;
  const opts = l.kind === "doc" ? [["doc_ready", "Ready (copy on file)"], ["doc_missing", "Not ready yet"], ["not_applicable", "Not applicable to us"]]
    : l.kind === "confirm" ? [["conf_yes", "The company has confirmed this"], ["conf_no", "Not confirmed (explain under Decl. 3)"]]
    : [...(k ? [["calc", "Use the worked-out value"]] : []), ["manual", "Enter the value myself"], ["nil", "Nil (there was none)"], ["not_applicable", "Not applicable"], ["not_available", "Not available"]];
  const pre = !s ? (k ? "calc" : "manual") : l.kind === "doc" ? (s.status === "value" ? "doc_ready" : s.status === "not_applicable" ? "not_applicable" : "doc_missing")
    : l.kind === "confirm" ? (s.text === "Confirmed" ? "conf_yes" : "conf_no") : s.source === "Calculated" ? "calc" : s.status === "value" ? "manual" : s.status;
  openModal(`<h2>${esc(l.label)}</h2><p class="muted small">Form reference ${esc(l.ref || "")} · ${l.pdf && typeof l.pdf === "string" ? "PDF field " + esc(l.pdf) : l.kind === "table" ? "12 rows in the PDF" : l.shared025 ? "shared PDF field p3_field_025" : ["doc", "confirm"].includes(l.kind) ? "internal record (not in the PDF)" : "no PDF field: enter by hand"}</p>
   ${l.kind === "doc" || l.kind === "confirm" ? "" : det}
   ${s ? `<p class="small">Current: <b>${esc(arVal(l, s))}</b> (${esc(s.source || "")}${s.set_by ? ", by " + esc(Store.name(s.set_by)) + " on " + esc(s.set_at) : ""})</p>` : ""}
   ${edit ? `<form class="f" data-form="ar-line" data-id="${r.id}" data-k="${l.key}">
    <fieldset><legend>What should the return show?</legend>${opts.map(([v, t]) => `<label class="radio"><input type="radio" name="action" value="${v}"${v === pre ? " checked" : ""}> ${esc(t)}</label>`).join("")}</fieldset>
    ${["doc", "confirm"].includes(l.kind) ? "" : `<div class="fld"><label>Value (for "Enter the value myself")</label>${valInput}${l.kind === "table" ? '<span class="help">Use USD or LKR. Up to 12 rows fit on the form.</span>' : ""}</div>`}
    <div class="fld"><label>Explanation</label><textarea name="explanation" rows="2">${esc(s && s.explanation || (k && k.autoExpl) || "")}</textarea><span class="help">Required when you enter a value yourself or mark Nil, Not applicable, Not available or Not confirmed.</span></div>
    <div class="row"><button class="btn p">Save line</button><button type="button" class="btn" data-act="modal-close">Cancel</button></div></form>` : '<div class="row"><button class="btn" data-act="modal-close">Close</button></div>'}`, "wide");
};
FORMS["ar-line"] = async form => {
  const o = readForm(form), r = Store.get("returns", form.dataset.id), l = AR_TEMPLATE.lines.find(x => x.key === form.dataset.k), k = UI.calc[l.key];
  const ex = (o.explanation || "").trim(); let st;
  const need = () => { if (!ex) throw ["Please add an explanation."]; };
  if (!o.action) throw ["Choose what the return should show."];
  if (o.action === "calc") { if (!k) throw ["There is no worked-out value for this line."]; if (k.status === "missing") throw ["Nothing was worked out from the records. Enter a value or mark the line Nil, Not applicable or Not available."]; st = { status: k.status, num: k.num ?? null, text: k.text ?? null, source: "Calculated", explanation: ex || k.autoExpl || null }; }
  else if (o.action === "manual") {
    need(); const v = (o.value || "").trim(); if (!v) throw ["Enter the value."];
    if (["amount", "area", "count"].includes(l.kind)) { const n = Number(v.replace(/,/g, "")); if (!Number.isFinite(n) || n < 0) throw ["Enter a number of zero or more."]; st = { status: "value", num: l.kind === "count" ? Math.round(n) : n, text: null }; }
    else if (l.kind === "table") { const rows = v.split("\n").map(x => x.trim()).filter(Boolean).map((x, i) => { const [country, currency, amount] = x.split(";").map(y => (y || "").trim()); const n = Number(String(amount).replace(/,/g, ""));
        if (!country || !/^[A-Za-z]{3}$/.test(currency) || !Number.isFinite(n)) throw [`Row ${i + 1}: use Country ; Currency ; Amount.`]; return { country, currency: currency.toUpperCase(), amount: n }; }); st = { status: "value", num: null, text: JSON.stringify(rows) }; }
    else st = { status: "value", num: null, text: v };
    st.source = "Entered manually"; st.explanation = ex;
  } else if (o.action === "doc_ready") st = { status: "value", text: "Ready", source: "Marked by user", explanation: ex || null };
  else if (o.action === "doc_missing") st = { status: "missing", source: "Marked by user", explanation: ex || null };
  else if (o.action === "conf_yes") st = { status: "value", text: "Confirmed", source: "Marked by user", explanation: ex || null };
  else if (o.action === "conf_no") { need(); st = { status: "value", text: "Not confirmed", source: "Marked by user", explanation: ex }; }
  else { need(); st = { status: o.action, num: null, text: null, source: "Marked by user", explanation: ex }; }
  st.set_by = Store.uid; st.set_at = nowIso();
  const old = (r.lines || {})[l.key];
  await Store.save("returns", { lines: Object.assign({}, r.lines || {}, { [l.key]: st }) }, r.id);
  await Store.audit("returns", r.id, "Line set", `${l.ref} ${l.label}: ${arVal(l, st)} (${st.source})`, [{ label: l.label, old: old ? arVal(l, old) : null, new: arVal(l, st) }]);
  closeModal(); toast("Line saved.");
};
ACTIONS["ar-accept-all"] = async el => {
  const r = Store.get("returns", el.dataset.id), calc = UI.calc, lines = Object.assign({}, r.lines || {}); let n = 0;
  for (const l of AR_TEMPLATE.lines) { const k = calc[l.key]; if (lines[l.key] || !k || !["value", "not_applicable"].includes(k.status)) continue;
    lines[l.key] = { status: k.status, num: k.num ?? null, text: k.text ?? null, source: "Calculated", explanation: k.autoExpl || null, set_by: Store.uid, set_at: nowIso() }; n++; }
  await Store.save("returns", { lines }, r.id); await Store.audit("returns", r.id, "Calculated values used", `${n} line(s) set from worked-out values`);
  toast(`${n} line(s) set. Lines with nothing found still need you to enter a value or mark them Nil, Not applicable or Not available.`);
};
function arMissing(r) { return AR_TEMPLATE.lines.filter(l => !(r.lines || {})[l.key] || r.lines[l.key].status === "missing"); }
ACTIONS["ar-ready"] = async el => { const r = Store.get("returns", el.dataset.id), m = arMissing(r);
  if (m.filter(l => l.kind !== "doc").length) throw [`${m.filter(l => l.kind !== "doc").length} line(s) are not set or missing, for example: ${m.filter(l => l.kind !== "doc").slice(0, 3).map(l => l.label).join("; ")}.`];
  await Store.save("returns", { status: "Ready for review", ready_by: Store.uid }, r.id); await Store.audit("returns", r.id, "Ready for review", r.title);
  if (m.length) toast(`${m.length} supporting document(s) are not ready yet.`, "warn"); };
ACTIONS["ar-reopen"] = async el => { const r = Store.get("returns", el.dataset.id); await Store.save("returns", { status: "Draft" }, r.id); await Store.audit("returns", r.id, "Reopened", r.title + (r.snapshot_id ? " (approved snapshot kept)" : "")); };
ACTIONS["ar-approve"] = async el => {
  const r = Store.get("returns", el.dataset.id); needDifferentPerson(r.ready_by, "approve this annual return");
  const lines = clone(r.lines || {}); Object.values(lines).forEach(s => { s.reviewed_by = Store.uid; s.reviewed_at = nowIso(); });
  const vno = Store.list("snapshots").filter(s => s.return_id === r.id).length + 1;
  const body = { return_id: r.id, version_no: vno, template: r.template, period_start: r.period_start, period_end: r.period_end, headcount_as_at: r.headcount_as_at, office_as_at: r.office_as_at, currency_method: r.currency_method, lines };
  body.hash = await sha256(JSON.stringify(Object.keys(lines).sort().map(k => [k, lines[k].status, lines[k].num ?? null, lines[k].text ?? null])) + JSON.stringify([r.period_start, r.period_end, r.currency_method]));
  body.approved_by = Store.uid; body.approved_at = nowIso();
  const sid = await Store.save("snapshots", body);
  await Store.save("returns", { status: "Approved", approved_by: Store.uid, approved_at: body.approved_at, snapshot_id: sid, lines }, r.id);
  await Store.audit("returns", r.id, "Approved", `${r.title}: snapshot ${vno}, fingerprint ${body.hash.slice(0, 16)}`); toast("Approved. A snapshot of the figures has been kept.");
};
ACTIONS["ar-sub"] = el => openModal(submissionModal("ar-sub", el.dataset.id, "Record that the annual return was submitted", "Record what you sent. The system does not submit the form, tick the declarations or sign it."));
FORMS["ar-sub"] = async form => { const o = readForm(form), r = Store.get("returns", form.dataset.id); await Store.save("returns", { status: "Submitted", submitted_at: o.submitted_at, submission_method: o.submission_method, submission_ref: o.submission_ref || null, submitted_by_name: o.submitted_by_name }, r.id); await Store.audit("returns", r.id, "Submission recorded", `${r.title}: ${o.submitted_at} by ${o.submission_method}`); closeModal(); toast("Recorded."); };
ACTIONS["ar-report"] = el => { const r = Store.get("returns", el.dataset.id); navTo("reports", { kind: "report", code: "annual_return" }); UI.params.rep_rid = r.id; render(); };
ACTIONS["ar-pdf"] = async el => {
  const r = Store.get("returns", el.dataset.id), c = Store.company();
  const final = ["Approved", "Submitted"].includes(r.status) && r.snapshot_id, snap = final ? Store.get("snapshots", r.snapshot_id) : null;
  const lines = snap ? snap.lines : (r.lines || {});
  toast("Filling the form…", "info");
  const { blob, check } = await fillAnnualReturnPdf(lines);
  const fname = `${c.is_demo ? "DEMO_" : ""}${final ? "" : "DRAFT_"}Annual_Return_2026_${c.name.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30)}.pdf`;
  UI.pdf = { blob, fname };
  await Store.audit("returns", r.id, "PDF filled", `${fname}: ${check.filled} fields filled, ${check.problems.length} problem(s)`);
  openModal(`<h2>${check.ok ? "The form is filled" : "The form is filled, with problems"}</h2>
   <p>The Commission's original fillable PDF (${check.pages} pages, ${check.fields} fields) was filled from ${final ? `approved snapshot ${snap.version_no}` : "the current working figures (not yet approved)"} and read back to check every value.</p>
   <ul class="small"><li>${check.filled} fields filled, ${check.ticked} designated-location tick box(es) ticked</li><li>Declarations, signature and date of submission are left blank for you to complete</li>${check.manual.length ? `<li>${check.manual.length} item(s) have no field in the PDF and must be entered by hand (see the working report)</li>` : ""}${!final ? "<li><b>Draft:</b> approve the return before using this for submission</li>" : ""}</ul>
   ${check.problems.length ? `<div class="note bad">${check.problems.map(p => esc(p)).join("<br>")}</div>` : ""}
   ${check.manual.length ? `<details><summary class="small">Enter these by hand</summary>${check.manual.map(([a, b]) => `<div class="small">${esc(a)}: <b>${esc(b)}</b></div>`).join("")}</details>` : ""}
   <div class="row"><button class="btn p" data-act="pdf-save">Download ${esc(fname)}</button><button class="btn" data-act="modal-close">Close</button></div>
   <p class="small muted">Check the PDF, complete the declarations, sign it and submit it to the Commission yourself.</p>`);
};
ACTIONS["pdf-save"] = async () => { if (UI.pdf && await saveFile(UI.pdf.fname, UI.pdf.blob)) toast("PDF ready."); };

/* ======================= LICENCES AND OBLIGATIONS ======================= */
PAGES.obligations = () => {
  const t = curTab("obligations", "overview");
  const tabs = tabsHTML("obligations", [["overview", "Overview"], ["obl", "Obligations and conditions"], ["lic", "Licences, designations and agreements"], ["lib", "Add from library"]]);
  if (t === "overview") return tabs + obligationsOverview();
  if (t === "lic") return tabs + listHTML("licences");
  if (t === "lib") return tabs + `<div class="head"><div class="t"><h1>Obligation library</h1><p class="muted">Common items from the supplied Act, Amendment Act, regulations and forms. They do not all apply to every company. Adding one copies it to your list marked "applicability to be confirmed" and "needs adviser review", so you can confirm it first.</p></div></div>
   <div class="tw"><table class="t"><thead><tr><th>Obligation</th><th>Type</th><th>Source</th><th>Usually applies to</th><th>Repeats</th><th>Note</th><th></th></tr></thead><tbody>
   ${OBLIGATION_LIBRARY.map((o, i) => `<tr><td>${esc(o[0])}</td><td class="small">${esc(o[1])}</td><td class="small">${esc(o[2])}</td><td class="small">${esc(o[3])}</td><td>${esc(o[4])}</td><td class="small muted">${esc(o[5])}</td><td>${Store.can("obligations", "write") ? `<button class="btn sm" data-act="lib-add" data-i="${i}">Add</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
   <p class="small muted">Check each source document before relying on it. These documents may have been amended after this system was set up.</p>`;
  return tabs + listHTML("obligations");
};
ACTIONS["lib-add"] = el => { const o = OBLIGATION_LIBRARY[+el.dataset.i];
  go({ kind: "form", type: "obligations", defaults: { title: o[0], obligation_type: o[1], source_document: o[2], recurrence: o[4], description: `Usually applies to: ${o[3]}. ${o[5]}`.trim(), basis: o[1] === "Reporting deadline" ? "Requested by the Commission" : "General law or regulation - applicability to be confirmed", needs_review: "Yes" } }); };

/* ======================= VISAS ======================= */
PAGES.visas = () => {
  const t = curTab("visas", "overview"), tabs = tabsHTML("visas", [["overview", "Overview"], ["list", "All visas and permits"]]);
  if (t === "overview") return tabs + visasOverview();
  return tabs + visasList();
};
function visasList() {
  const soon = Store.list("visas").filter(v => v.expiry_date && daysUntil(v.expiry_date) <= 90 && !["Cancelled", "Rejected"].includes(v.application_status));
  return listHTML("visas", { above: soon.length ? `<p class="note warn">${soon.length} visa(s) or permit(s) expire within 90 days or have expired.</p>` : "", below: '<p><button class="btn" data-act="nav" data-section="reports" data-report="visas">Visa and permit expiry report</button></p>' });
};

/* ======================= DOCUMENTS ======================= */
const DOC_FIELDS = [F("title", "Document title", "text", { required: true }), F("category", "Category", "choice", { lookup: "document_categories", required: true }),
  F("access", "Access", "choice", { choices: ["Normal", "Restricted"], dflt: "Normal", help: "Restricted documents are shown only to roles that can see identity or ownership details. UBO, passport and visa documents are always restricted." }),
  F("expiry_date", "Expiry date (if any)", "date"), F("notes", "Notes", "textarea")];
const DOC_DEF = { label: "Document", fields: DOC_FIELDS, fmap: Object.fromEntries(DOC_FIELDS.map(f => [f.name, f])) };
const DOC_ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.csv,.txt,.json";
const docVisible = d => d.access === "Normal" || canRestrictedDocs();
function linkLabel(d) { if (!d.link_type) return ""; if (d.link_type === "bplans") { const v = Store.get("bplans", d.link_id); return v ? `Business plan v${v.version_no}` : ""; } const def = REG[d.link_type], r = def && Store.get(d.link_type, d.link_id); if (!r) return ""; const tf = def.fmap[def.title]; return `${def.label}: ${tf && tf.sensitive && !Store.canSee(tf.sensitive) ? "record" : r[def.title] || ""}`; }
PAGES.documents = () => {
  const t = curTab("documents", "overview"), tabs = tabsHTML("documents", [["overview", "Overview"], ["list", "All documents"]]);
  return tabs + (t === "overview" ? documentsOverview() : documentsList());
};
function documentsList() {
  const q = (UI.filter.docs || "").toLowerCase(), w = Store.can("documents", "write");
  const rows = Store.list("docs").filter(docVisible).filter(d => !q || [d.title, d.category, d.notes].join(" ").toLowerCase().includes(q)).sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  const hidden = Store.list("docs").length - Store.list("docs").filter(docVisible).length;
  return `<div class="head"><div class="t"><h1>Documents</h1><p class="muted">Keep each document with its versions. Files can be PDF, images, CSV, text or JSON. Word and Excel files can't be stored here, so save them as PDF first.</p></div><div class="acts">${w ? '<button class="btn p" data-act="doc-new">Add document</button>' : ""}</div></div>
   <p class="note small">Uploaded files are stored with this page. Anyone you share the page with can open a file if they have its link, so restricted access here is a screen control, not encryption.${hidden ? ` ${hidden} restricted document(s) are hidden for your role.` : ""}</p>
   ${(() => { const v = Store.list("docs").filter(docVisible); return hlCards([{ value: v.length, label: "Documents" }, { value: v.filter(d => !(d.versions || []).length).length, label: "Without a file", kind: v.some(d => !(d.versions || []).length) ? "warn" : "" }, { value: v.filter(d => d.expiry_date && daysUntil(d.expiry_date) <= 60).length, label: "Expired or expiring within 60 days", kind: "warn" }, { value: v.filter(d => d.access === "Restricted").length, label: "Restricted" }]); })()}
   <div class="row" style="margin-bottom:10px"><input type="search" placeholder="Search…" value="${esc(UI.filter.docs || "")}" data-filter="docs" aria-label="Search" style="max-width:280px"></div>
   <div class="tw"><table class="t"><thead><tr><th>Title</th><th>Category</th><th>Access</th><th>Linked to</th><th>Versions</th><th>Expiry</th></tr></thead><tbody>
   ${rows.map(d => `<tr><td><a href="#" data-act="doc-open" data-id="${d.id}">${esc(d.title)}</a></td><td>${esc(d.category)}</td><td>${d.access === "Restricted" ? '<span class="badge brand">Restricted</span>' : "Normal"}</td><td class="small">${esc(linkLabel(d))}</td><td>${(d.versions || []).length || '<span class="badge warn">no file</span>'}</td><td>${d.expiry_date ? fmtDate(d.expiry_date) + (daysUntil(d.expiry_date) <= 60 ? ` ${badge(daysUntil(d.expiry_date) < 0 ? "Expired" : "Due soon")}` : "") : ""}</td></tr>`).join("") || '<tr><td colspan="6" class="empty">No documents yet.</td></tr>'}</tbody></table></div>`;
};
ACTIONS["doc-new"] = el => go({ kind: "docform", link_type: el.dataset.linkType || null, link_id: el.dataset.linkId || null });
ACTIONS["doc-open"] = el => navTo("documents", { kind: "doc", id: el.dataset.id }, true);
ACTIONS["doc-edit"] = el => go({ kind: "docform", id: el.dataset.id });
VIEWS.docform = v => {
  const d = v.id ? Store.get("docs", v.id) : { access: "Normal" };
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Back</button><h1>${v.id ? "Edit" : "Add"} document</h1>${v.link_type ? `<p class="muted">Linked to ${esc((REG[v.link_type] || { label: { apps: "licence application", filings: "licence filing" }[v.link_type] || "record" }).label)}</p>` : ""}</div></div>
   <form class="f" data-form="doc" data-id="${v.id || ""}" data-link-type="${v.link_type || ""}" data-link-id="${v.link_id || ""}"><div class="grid2">${DOC_FIELDS.map(f => `<div class="fld${f.type === "textarea" ? " wide" : ""}"><label for="f_${f.name}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ""}</label>${inputFor(f, d[f.name])}${f.help ? `<span class="help">${esc(f.help)}</span>` : ""}</div>`).join("")}</div>
   <div class="row"><button class="btn p">Save</button><button type="button" class="btn" data-act="back">Cancel</button></div><p class="small muted">Upload the file after saving.</p></form>`;
};
FORMS.doc = async form => {
  const raw = readForm(form), rec = {}, errs = [], id = form.dataset.id || null;
  for (const f of DOC_FIELDS) try { rec[f.name] = cleanValue(f, raw[f.name]); } catch (e) { errs.push(e); }
  if (!rec.title) errs.push("Document title is required."); if (!rec.category) errs.push("Category is required.");
  if (errs.length) throw errs;
  if (RESTRICTED_DOC_CATS.includes(rec.category)) rec.access = "Restricted";
  if (rec.access === "Restricted" && !canRestrictedDocs()) throw ["Your role cannot add restricted documents."];
  if (!id) { rec.link_type = form.dataset.linkType || null; rec.link_id = form.dataset.linkId || null; rec.versions = []; }
  const before = id ? Store.get("docs", id) : null;
  const nid = await Store.save("docs", rec, id);
  await Store.audit("docs", nid, id ? "Updated" : "Created", `Document: ${rec.title}`, id ? diff(DOC_DEF, before, rec) : null);
  UI.stack.pop(); UI.view = { kind: "doc", id: nid }; render(); toast("Saved.");
};
VIEWS.doc = ({ id }) => {
  const d = Store.get("docs", id); if (!d || !docVisible(d)) return '<p class="empty">Not found, or your role cannot view this document. <button class="link" data-act="back">Back</button></p>';
  const w = Store.can("documents", "write");
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Back</button><h1>${esc(d.title)}</h1><div class="row"><span class="badge">${esc(d.category)}</span>${d.access === "Restricted" ? '<span class="badge brand">Restricted</span>' : ""}</div></div>
   <div class="acts">${w ? `<button class="btn" data-act="doc-edit" data-id="${d.id}">Edit details</button>` : ""}</div></div>
   <div class="card"><dl class="kv"><dt>Linked to</dt><dd>${esc(linkLabel(d)) || "—"}</dd><dt>Expiry</dt><dd>${fmtDate(d.expiry_date) || "—"}</dd><dt>Notes</dt><dd>${esc(d.notes || "—")}</dd></dl></div>
   <div class="card"><h3>Versions</h3>${(d.versions || []).slice().reverse().map((v, i, a) => `<div class="li"><b>v${a.length - i}</b> <a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.name)}</a> <span class="muted small">${Math.round((v.size || 0) / 1024)} KB · ${esc(v.uploaded_at)} · ${esc(Store.name(v.by))}${v.note ? " · " + esc(v.note) : ""}</span></div>`).join("") || '<p class="muted">No file uploaded yet.</p>'}
    ${w ? `<div class="row"><label class="btn">Upload ${(d.versions || []).length ? "a new version" : "the file"}<input type="file" accept="${DOC_ACCEPT}" data-change="doc-upload" data-id="${d.id}" hidden></label><span class="small muted">PDF, image, CSV, text or JSON, up to 20 MB.</span></div>` : ""}</div>
   <div class="card"><h3>History</h3>${historyHTML(Store.history("docs", d.id))}</div>`;
};
CHANGES["doc-upload"] = async el => {
  const file = el.files && el.files[0]; if (!file) return;
  const d = Store.get("docs", el.dataset.id);
  if (!DOC_ACCEPT.split(",").some(x => file.name.toLowerCase().endsWith(x))) throw ["This file type can't be stored here. Save Word or Excel files as PDF first."];
  let assets = null; try { assets = await window.claude?.use?.("assets"); } catch (e) { }
  if (!assets) throw ["File upload isn't available for you in this view. Only people with edit access to this page can upload files. You can still record the document details."];
  toast("Uploading…", "info");
  let up; try { up = await assets.upload(file); } catch (e) { throw [e && e.code === "too_large" ? "The file is too large (20 MB limit)." : e && e.code === "unsupported_type" ? "This file type isn't supported." : "The upload failed. Please try again."]; }
  const versions = (d.versions || []).concat([{ asset_id: up.id, url: up.url, name: file.name, size: up.sizeBytes, type: up.contentType, uploaded_at: nowIso(), by: Store.uid }]);
  await Store.save("docs", { versions }, d.id); await Store.audit("docs", d.id, "File uploaded", `${d.title}: version ${versions.length} (${file.name})`); toast("Uploaded.");
};

/* ======================= REPORTS ======================= */
PAGES.reports = () => `<div class="head"><div class="t"><h1>Reports</h1><p class="muted">Each report says the date or period it covers and where its figures come from. Download as Excel, PDF or Word. Reports from demo data are marked DEMO.</p></div></div>
  <div class="grid3">${REPORTS.filter(r => Store.can(r[2])).map(([code, title]) => `<button class="card tile" data-act="rep-open" data-code="${code}"><b>${esc(title)}</b><span class="small muted">${esc(REPORT_DESC[code] || "")}</span><span class="small tilefmt">Excel · PDF · Word</span></button>`).join("")}</div>`;
ACTIONS["rep-open"] = el => go({ kind: "report", code: el.dataset.code });
VIEWS.report = ({ code }) => {
  const p = UI.params, a = {}; let ctl = "";
  const date = (k, lbl, d) => { a[k.split("_").pop()] = p[k] || d; return `<label>${lbl} <input type="date" value="${p[k] || d}" data-change="param" data-k="${k}"></label>`; };
  if (code === "employees") { ctl = date("rep_as_at", "As at", today()) + (Store.canSee("personal") ? `<label><input type="checkbox" data-change="param" data-k="rep_names"${p.rep_names ? " checked" : ""}> include names</label>` : "") + (Store.canSee("pay") ? `<label><input type="checkbox" data-change="param" data-k="rep_pay"${p.rep_pay ? " checked" : ""}> include pay</label>` : ""); a.as_at = p.rep_as_at || today(); a.names = !!p.rep_names; a.pay = !!p.rep_pay; }
  if (code === "office_headcount") { ctl = date("rep_as_at", "As at", today()); a.as_at = p.rep_as_at || today(); }
  if (code === "investment") { ctl = date("rep_start", "From", "2025-04-01") + date("rep_end", "To", today()); a.start = p.rep_start || "2025-04-01"; a.end = p.rep_end || today(); }
  if (code === "visas") { ctl = `<label>Expiring within <input type="number" min="1" value="${p.rep_days || 180}" data-change="param" data-k="rep_days" style="width:80px"> days</label>`; a.days = p.rep_days || 180; }
  if (code === "plan_vs_actual") { const vs = Store.list("bplans").sort((x, y) => y.version_no - x.version_no); ctl = `<label>Plan version <select data-change="param" data-k="rep_vid"><option value="">Latest approved or submitted</option>${vs.map(v => `<option value="${v.id}"${p.rep_vid === v.id ? " selected" : ""}>v${v.version_no} ${esc(v.status)}</option>`).join("")}</select></label>`; a.vid = p.rep_vid || null; }
  if (code === "annual_return") {
    const rs = Store.list("returns").sort((x, y) => y.period_end.localeCompare(x.period_end)); a.rid = p.rep_rid || (rs[0] && rs[0].id);
    const r = a.rid && Store.get("returns", a.rid), snaps = r ? Store.list("snapshots").filter(s => s.return_id === r.id).sort((x, y) => y.version_no - x.version_no) : [];
    ctl = `<label>Return <select data-change="param" data-k="rep_rid">${rs.map(x => `<option value="${x.id}"${x.id === a.rid ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label>${snaps.length ? `<label>Figures <select data-change="param" data-k="rep_snap"><option value="">Current working figures</option>${snaps.map(s => `<option value="${s.id}"${p.rep_snap === s.id ? " selected" : ""}>Approved snapshot ${s.version_no} (${esc(s.approved_at.slice(0, 10))})</option>`).join("")}</select></label>` : ""}`;
    if (r) { const snap = p.rep_snap ? Store.get("snapshots", p.rep_snap) : null; const builder = () => arWorkingReport(r, snap && snap.return_id === r.id ? snap : null);
      return `<div class="head"><div class="t"><button class="link" data-act="back">← Reports</button><h1>${esc(REPORTS.find(x => x[0] === code)[1])}</h1></div></div><div class="row">${ctl}</div>${reportPanel(code, a, builder)}`; }
  }
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Reports</button><h1>${esc(REPORTS.find(x => x[0] === code)[1])}</h1></div></div>${ctl ? `<div class="row">${ctl}</div>` : ""}${reportPanel(code, a)}`;
};

/* ======================= HOW IT WORKS ======================= */
PAGES.howto = () => `<div class="head"><div class="t"><h1>How it works</h1><p class="muted">A short guide in plain English. The system is for companies that already hold an Authorised Person licence or BSI designation.</p></div></div>
 ${flowHTML()}
 <div class="cols"><div class="card"><h3>The usual order</h3><ol>
  <li><b>Company profile</b> - enter the basic details, directors, shareholders and beneficial owners.</li>
  <li><b>Licence and conditions</b> - record your AP licence or BSI designation, then add each condition stated in it as an obligation.</li>
  <li><b>Business plan reference</b> - enter the figures from the plan you submitted. A second person checks them against the plan and locks that version, so actual progress can be compared with it.</li>
  <li><b>Keep the registers up to date</b> - workforce, investment and funding, offices, licences and obligations, visas, documents.</li>
  <li><b>Commission requests</b> - log each request, draft the response, get it approved, then record when you sent it.</li>
  <li><b>Annual return</b> - add the financial records, check each line, get approval, fill the official PDF, then sign and submit it yourself.</li>
  <li><b>Plan ahead</b> - set the budget, investment inflow targets, the office space forecast and compare premises. These are management tools, not Commission requirements.</li>
  <li><b>Quayza</b> - your AI assistant: ask a question about Port City rules and get an answer with the source of each point.</li></ol></div>
  <div class="card"><h3>Five kinds of information, kept apart</h3><ol><li><b>What the Commission asked for</b> in a form or letter (e.g. the Annual Return 2026 fields, an employee information request).</li><li><b>Law and regulation</b> (the Act, the Amendment Act, gazetted regulations).</li><li><b>Your own conditions</b> in your licence, agreement or BSI approval.</li><li><b>Business plan projections</b> - estimates, not commitments, unless an approval or agreement says otherwise.</li><li><b>Good-practice features</b> of this system, such as separate approval. These are not legal requirements.</li></ol></div></div>
 <div class="cols"><div class="card"><h3>What the labels mean</h3><dl class="kv"><dt>${srcTag("Manual")}</dt><dd>Typed in by a person</dd><dt>${srcTag("Imported")}</dt><dd>Brought in from an Excel file</dd><dt>${srcTag("Demo")}</dt><dd>Made-up sample data</dd><dt>Calculated</dt><dd>Worked out by the system from your records, with an explanation</dd><dt>Reviewed / Confirmed</dt><dd>Checked by a second person</dd>
  <dt>Nil</dt><dd>There was none (e.g. no revenue)</dd><dt>Not applicable</dt><dd>The item does not apply to this company</dd><dt>Not available</dt><dd>It applies, but the figure isn't available yet</dd></dl></div>
  <div class="card"><h3>What the system will not do</h3><ul><li>It does not submit anything, sign declarations or send messages. You do that, then record it.</li><li>It does not decide that the company is compliant, or give legal or tax conclusions.</li><li>It does not assume every requirement applies to every company.</li><li>It does not treat foreign receipts as FDI until a reviewer confirms them.</li><li>It does not connect to your ERP. Use manual entry or Excel import.</li></ul></div></div>
 <div class="card"><h3>Documents this version is based on</h3><p class="small muted">These may be amended. Check the current version before relying on any item.</p><div class="tw"><table class="t"><thead><tr><th>Document</th><th>Date</th><th>Used for</th></tr></thead><tbody>${LEGAL_REFS.map(r => `<tr><td>${esc(r[0])}</td><td class="nowrap">${fmtDate(r[1])}</td><td class="small">${esc(r[2])}</td></tr>`).join("")}
  <tr><td>Annual Return Submission Form 2026</td><td></td><td class="small">Annual return lines and the fillable PDF.</td></tr><tr><td>AP Technical Evaluation Form</td><td></td><td class="small">Year-by-year business plan figures recorded for comparison, and the FDI definition.</td></tr><tr><td>Annexure I - AP Declaration</td><td></td><td class="small">Ongoing commitments made in the declaration (obligation library).</td></tr><tr><td>Form_UBO</td><td></td><td class="small">Beneficial owner fields.</td></tr></tbody></table></div>
  <p class="small muted">The licence application forms (Required Documents checklist, declaration forms) are not tracked, because companies start using this system after their licence is issued.</p></div>
 <div class="card"><h3>About this browser version</h3><ul class="small"><li>Data is saved with this page and shared with everyone who can open it. Roles control what each person sees on screen, but anyone with access to the page could technically read all of its data. Share it only with people who may see everything, and keep the most sensitive details (full passport and pay data) to the minimum you need.</li><li>Uploaded files are limited to PDF, images, CSV, text and JSON.</li><li>The full server version (Flask and SQLite) enforces roles on the server and is the right choice for wider use.</li></ul></div>`;

/* ======================= SETUP ======================= */
PAGES.setup = () => {
  const t = curTab("setup", "members"), admin = Store.realRole() === "admin";
  const tabs = tabsHTML("setup", [["members", "People and roles"], ["controls", "Controls and reminders"], ["fx", "Exchange rates"], ...(Store.can("audit") ? [["audit", "Audit log"]] : []), ["companies", "Companies"]]);
  const c = Store.company();
  if (t === "fx") return tabs + listHTML("fx_rates");
  if (t === "audit") { const h = Store.history(); const f = (UI.filter.audit || "").toLowerCase();
    return tabs + `<div class="head"><div class="t"><h1>Audit log</h1><p class="muted">Every important change, approval, submission record and export. Sensitive values are not stored in the log.</p></div></div><input type="search" placeholder="Search…" value="${esc(UI.filter.audit || "")}" data-filter="audit" aria-label="Search" style="max-width:280px">${historyHTML(f ? h.filter(x => [x.action, x.summary, x.entity].join(" ").toLowerCase().includes(f)) : h)}`; }
  if (t === "controls") return tabs + `<div class="card"><h3>Controls</h3><form class="f" data-form="controls">
     <label><input type="checkbox" name="separate_reviewer"${Store.setting("separate_reviewer", true) ? " checked" : ""}${admin ? "" : " disabled"}> A different person must approve work (applications, business plans, responses, annual returns, reviews)</label>
     <p class="help">Recommended practice, not a legal requirement. Turn it off only if one person runs the whole process.</p>
     <div class="grid2">${[["rem_requests", "Remind me about Commission request deadlines (days before)"], ["rem_obligations", "Obligation deadlines (days before)"], ["rem_visas", "Visa and permit expiry (days before)"], ["rem_passports", "Passport expiry (days before)"]].map(([k, l]) => fieldRow(l, `<input name="${k}" type="number" min="0" value="${Store.setting(k, 30)}"${admin ? "" : " disabled"}>`)).join("")}</div>
     ${admin ? '<button class="btn p">Save</button>' : '<p class="muted small">Only an administrator can change these.</p>'}</form></div>
     <div class="card"><h3>Preview as another role</h3><p class="small muted">See what each role can see and do. This only changes your own screen.</p><select data-change="preview-role" aria-label="Preview role"><option value="">My own role (${esc(ROLES[Store.realRole()])})</option>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}"${Store.preview === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></div>`;
  if (t === "companies") return tabs + `<div class="card"><h3>Your companies</h3><p class="small muted">Each company has its own records and its own list of people.</p>${Store.myCompanies().map(x => `<div class="li">${esc(x.name)} ${x.is_demo ? '<span class="badge warn">DEMO</span>' : ""} <span class="muted small">your role: ${esc(ROLES[x.members[Store.uid]])}</span> ${x.id === Store.cid ? '<span class="badge ok">open</span>' : `<button class="btn sm" data-act="switch-co" data-id="${x.id}">Open</button>`}</div>`).join("")}</div>
     <div class="card"><h3>Add a company</h3><form class="inline" data-form="newco"><input name="name" placeholder="Company name" required aria-label="Company name"><button class="btn p">Create</button></form><p><button class="btn" data-act="demo-load">Load the demo company</button> <span class="small muted">Adds a separate company filled with made-up sample data, marked DEMO.</span></p></div>`;
  const ids = Object.keys(c.members || {}); Store.resolveNames(ids);
  const hits = UI.params.hits || [];
  return tabs + `<div class="card"><h3>People with access to ${esc(c.name)}</h3><p class="small muted">Roles decide which menus, records and restricted details each person sees on screen.</p>
   <div class="tw"><table class="t"><thead><tr><th>Name</th><th>Role</th><th>Can see restricted details</th><th></th></tr></thead><tbody>${ids.map(u => `<tr><td>${esc(Store.name(u))}${u === Store.uid ? " (you)" : ""}</td>
    <td>${admin && u !== Store.uid ? `<select data-change="member-role" data-uid="${u}" aria-label="Role">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}"${c.members[u] === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>` : esc(ROLES[c.members[u]])}</td>
    <td class="small">${(SENSITIVE_ACCESS[c.members[u]] || []).map(g => SENSITIVE_LABELS[g]).join(", ") || "None"}</td><td>${admin && u !== Store.uid ? `<button class="btn sm bad" data-act="member-remove" data-uid="${u}">Remove</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
   ${admin ? `<h3>Add a person</h3>${Store.user && Store.mode === "db" ? `<div class="row"><input id="usearch" placeholder="Search by name" aria-label="Search people" value="${esc(UI.params.usearch || "")}"><button class="btn" data-act="member-search">Search</button></div>
    ${hits.map(h => `<div class="li">${esc(h.name || "Someone")}${h.guest ? ' <span class="badge">guest</span>' : ""} <select id="role_${esc(h.id)}" aria-label="Role">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}"${k === "adviser" ? " selected" : ""}>${esc(v)}</option>`).join("")}</select> <button class="btn sm p" data-act="member-add" data-uid="${esc(h.id)}">Add</button></div>`).join("")}
    <p class="small muted">People must already have access to this page (share it with them first). Adding them here gives them a role in this company.</p>` : '<p class="muted small">Adding people needs this page to be open in claude.ai with saving switched on.</p>'}` : ""}</div>
   <div class="card"><h3>Role permissions</h3><div class="tw"><table class="t small"><thead><tr><th>Area</th>${Object.values(ROLES).map(r => `<th>${esc(r)}</th>`).join("")}</tr></thead><tbody>${MODULES.map((m, i) => `<tr><td>${esc(MODULE_LABELS[m])}</td>${Object.keys(ROLES).map(r => `<td>${{ n: "—", r: "view", w: "edit", a: "approve" }[PERM_CODES[r][i]]}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>
   <p class="note small">Important: in this browser version roles are applied on screen. Everyone the page is shared with can technically read the stored data. Share the page only with people who may see all of it.</p>`;
};
const MODULE_LABELS = { dashboard: "Dashboard", company: "Company profile", bplan: "Business plan reference", budget: "Budget", requests: "Commission requests", workforce: "Workforce", investment: "Investment and funding", offices: "Office space", returns: "Annual returns", obligations: "Licences and obligations", visas: "Visas and permits", documents: "Documents", reports: "Reports", settings: "Setup", audit: "Audit log" };
ACTIONS["member-search"] = async () => { const q = document.getElementById("usearch").value; UI.params.usearch = q; try { UI.params.hits = (await Store.user.search(q)).filter(h => !(Store.company().members || {})[h.id]); } catch (e) { UI.params.hits = []; } if (!UI.params.hits.length) toast("No one found who isn't already added.", "info"); render(); };
ACTIONS["member-add"] = async el => { const uid = el.dataset.uid, role = document.getElementById("role_" + uid).value, c = Store.company();
  await Store.saveCompany({ members: Object.assign({}, c.members, { [uid]: role }) }); await Store.audit("companies", c.id, "Person added", `${Store.name(uid)} added as ${ROLES[role]}`); UI.params.hits = []; toast("Added."); };
CHANGES["member-role"] = async el => { const c = Store.company(), uid = el.dataset.uid, old = c.members[uid];
  await Store.saveCompany({ members: Object.assign({}, c.members, { [uid]: el.value }) }); await Store.audit("companies", c.id, "Role changed", `${Store.name(uid)}: ${ROLES[old]} → ${ROLES[el.value]}`); toast("Role changed."); };
ACTIONS["member-remove"] = el => confirmModal(`Remove ${Store.name(el.dataset.uid)} from this company?`, async () => { const c = Store.company(), m = Object.assign({}, c.members); delete m[el.dataset.uid];
  if (!Object.values(m).includes("admin")) throw ["The company must keep at least one administrator."];
  await Store.saveCompany({ members: m }); await Store.audit("companies", c.id, "Person removed", Store.name(el.dataset.uid)); });
CHANGES["preview-role"] = el => { Store.preview = el.value || null; UI.view = null; UI.stack = []; render(); };
FORMS.controls = async form => { const o = readForm(form), c = Store.company(), s = Object.assign({}, c.settings || {}); s.separate_reviewer = !!o.separate_reviewer;
  ["rem_requests", "rem_obligations", "rem_visas", "rem_passports"].forEach(k => s[k] = Math.max(0, parseInt(o[k] || "0", 10) || 0));
  await Store.saveCompany({ settings: s }); await Store.audit("companies", c.id, "Settings changed", `Separate approval ${s.separate_reviewer ? "on" : "off"}; reminders ${s.rem_requests}/${s.rem_obligations}/${s.rem_visas}/${s.rem_passports} days`); toast("Saved."); };
FORMS.newco = async form => { const n = readForm(form).name.trim(); if (!n) throw ["Enter a company name."]; await Store.createCompany(n, false); UI.section = "company"; UI.view = null; location.hash = "company"; toast("Company created. Start with the company profile."); };
ACTIONS["switch-co"] = el => { Store.switchCompany(el.dataset.id); UI.view = null; UI.stack = []; UI.section = "dashboard"; location.hash = "dashboard"; };

/* ======================= DEMO DATA ======================= */
ACTIONS["demo-load"] = async () => {
  if (Store.myCompanies().some(c => c.is_demo)) { if (!(await confirmAsk("You already have a demo company. Add another one?"))) return; }
  toast("Creating the demo company. This takes a few seconds…", "info");
  await Store.createCompany("Demo Company", true);
  await loadDemo();
  UI.section = "dashboard"; UI.view = null; location.hash = "dashboard"; render(); toast("Demo company ready. All of its figures are made up.");
};
async function loadDemo() {
  const S = async (type, raw) => (await saveRecord(type, Object.assign({ __nolog: true }, raw), null, "Demo")).id;
  const T = today(), R = "demo:Ravi Perera (Director)", P = "demo:Priya Fernando (HR)", N = "demo:Nimal Silva (Finance)";
  const lic = await S("licences", { licence_type: "Authorised Person licence", title: "Authorised Person licence", number: "DEMO-AP-0147", issue_date: "2025-02-10", expiry_date: addDays(T, 50), status: "Active", approved_activities: "Software development and IT-enabled services for overseas clients (demo wording).", conditions: "Condition 3 (demo): maintain an office within Colombo Port City.", renewal_notice_days: 60, renewal_fee_usd: 2500 });
  await Store.saveCompany({ licence_number: "DEMO-AP-0147", legal_form: "Private Company with Limited Liability", register_address: "Level 12, Demo Tower, Colombo Port City, Colombo 01", register_checked: addDays(today(), -20), registration_no: "DEMO-PV-000147", country_of_incorporation: "Sri Lanka", incorporation_date: "2024-11-01", designation_type: "Authorised Person only", business_sector: "Information technology and software services",
    operations_commenced: "Yes", operations_commenced_date: "2025-04-01", registered_address: "Level 12, Demo Tower, Colombo Port City, Colombo 01", tin: "DEMO-TIN-000000", roc_filing_info: "Form 1 and Form 20 filed at incorporation (demo).", main_licence_id: lic,
    financial_year_end: "31 March", contact_name: "Ravi Perera", contact_email: "compliance@demo.invalid", contact_phone: "+94 11 000 0000", signatory_name: "Ravi Perera", signatory_designation: "Director" });
  for (const p of [["Ravi Perera", "Individual", "Director", "Sri Lankan", null], ["Helen Clarke", "Individual", "Director", "British", null], ["Demo Holdings Ltd (demo)", "Corporate", "Shareholder", "United Kingdom", 100]])
    await S("people", { full_name: p[0], person_type: p[1], role: p[2], nationality: p[3], shareholding_pct: p[4], appointed_date: "2024-11-01" });
  await S("ubo", { full_name: "Helen Clarke", nationality: "British", country_of_residence: "United Kingdom", ownership_pct: 60, nature_extent: "Holds 60% of Demo Holdings Ltd (demo).", declaration_status: "Signed copy on file" });
  await S("ubo", { full_name: "Daniel Clarke", nationality: "British", country_of_residence: "United Kingdom", ownership_pct: 40, nature_extent: "Holds 40% of Demo Holdings Ltd (demo).", declaration_status: "Draft prepared - awaiting signature" });
  const pos = {};
  for (const p of [["P01", "Engineering Manager", "Management", "Degree in computer science or engineering", 8, "English"], ["P02", "Senior Software Engineer", "Professional", "Degree in computer science", 5, "English"], ["P03", "Software Engineer", "Professional", "Degree or diploma in IT", 2, "English"], ["P04", "Office Administrator", "Administrative", "Diploma in business administration", 2, "English, Sinhala"]])
    pos[p[0]] = await S("positions", { ref: p[0], title: p[1], staff_category: p[2], min_qualifications: p[3], min_experience_years: p[4], languages: p[5], planned_headcount: { P01: 2, P02: 6, P03: 8, P04: 2 }[p[0]], status: p[0] === "P03" ? "Open - recruiting" : "Active" });
  const offIn = await S("offices", { name: "Port City office (demo)", address: "Level 12, Demo Tower, Colombo Port City", location: "Inside Colombo Port City", designated_status: "Not applicable", floor_area: 320, area_unit: "sqm", seats: 40, status: "In use", in_use_from: "2025-04-01", rent_amount: 8000, rent_currency: "USD", rent_frequency: "Month" });
  const offOut = await S("offices", { name: "Interim office, Colombo 03 (demo)", address: "No. 10, Demo Road, Colombo 03", location: "Outside Colombo Port City", designated_status: "Designated location (approved)", designation_ref: "DEMO-DL-012", floor_area: 1615, area_unit: "sqft", measurement_basis: "Approximate", seats: 18, status: "Vacated", in_use_from: "2024-12-01", in_use_to: "2026-05-26", rent_amount: 600000, rent_currency: "LKR", rent_frequency: "Month" });
  const staff = [["E001", "Ravi Kumarasinghe", "P01", "Sri Lankan", "2025-04-01"], ["E002", "Ishara Jayawardena", "P02", "Sri Lankan", "2025-04-15"], ["E003", "Tharindu Silva", "P03", "Sri Lankan", "2025-05-02"], ["E004", "Dilani Perera", "P03", "Sri Lankan", "2025-06-01"],
    ["E005", "Kasun Bandara", "P04", "Sri Lankan", "2025-04-01"], ["E006", "James Whitfield", "P01", "British", "2025-04-01"], ["E007", "Mei Lin Tan", "P02", "Singaporean", "2025-07-01"], ["E008", "Arjun Mehta", "P02", "Indian", "2026-11-15", "Offer accepted - not started"]];
  for (const e of staff) await S("employees", { ref: e[0], full_name: e[1], position_id: pos[e[2]], nationality: e[3], worker_type: "Employee", employment_type: "Full-time permanent", status: e[5] || "Active", start_date: e[4], office_id: offIn, residency: e[3] === "Sri Lankan" ? "Resident" : "To be confirmed" });
  await S("employees", { ref: "C001", full_name: "Sam Wickrama", job_title: "UX design consultant", nationality: "Sri Lankan", worker_type: "Independent contractor", start_date: "2025-08-01", end_date: "2026-01-31", status: "Left" });
  for (const p of [["Accommodation", "Housing for overseas staff", "Leased apartment for non-Sri Lankan staff on assignment", "Non-Sri Lankan staff on assignment", "One unit per employee", "Non-Sri Lankan staff only"], ["Health insurance", "Group medical cover", "Inpatient and outpatient cover", "All permanent staff", "LKR 1,000,000 per year", "All staff"], ["Travel and relocation", "Relocation support", "Flights and two weeks' hotel on joining", "Overseas hires", "Economy class", "Non-Sri Lankan staff only"]])
    await S("policies", { policy_type: p[0], title: p[1], description: p[2], eligibility: p[3], coverage_limit: p[4], applies_to: p[5], effective_from: "2025-04-01" });
  await S("office_plans", { effective_date: "2028-01-01", location: "Inside Colombo Port City", required_sqm: 600, required_seats: 80, basis: "Business plan v1, Year 3 headcount (demo)", annual_rent_usd: 180000 });
  await S("fx_rates", { rate_date: "2025-09-30", currency: "GBP", per_usd: 0.79, lkr_per_unit: 380, source: "Demo rate - not a published rate" });
  await S("fx_rates", { rate_date: "2026-03-31", currency: "USD", per_usd: 1, lkr_per_unit: 300, source: "Demo rate - not a published rate" });
  await S("investments", { entry_date: "2025-05-15", source_name: "Demo Holdings Ltd (demo)", source_country: "United Kingdom", relationship: "Parent company", description: "Share capital", original_amount: 1500000, original_currency: "USD", lkr_rate: 300, rate_date: "2025-05-15", rate_source: "Demo rate", from_outside_sl: "Yes", classification: "Equity investment", review_status: "Confirmed", reviewed_by: N, reviewed_at: "2025-05-20", __allow: ["review_status", "reviewed_by", "reviewed_at"] });
  await S("investments", { entry_date: "2025-11-10", source_name: "Demo Holdings Ltd (demo) - loan", source_country: "United Kingdom", relationship: "Parent company", description: "Intercompany loan drawdown", original_amount: 400000, original_currency: "GBP", usd_rate: 0.79, lkr_rate: 380, rate_date: "2025-09-30", rate_source: "Demo rate", from_outside_sl: "Yes", classification: "Intra-company debt" });
  await S("investments", { entry_date: "2026-01-20", source_name: "Overseas customer (demo)", source_country: "Singapore", relationship: "Customer", description: "Advance payment for services", original_amount: 50000, original_currency: "USD", lkr_rate: 300, rate_date: "2026-01-20", rate_source: "Demo rate", from_outside_sl: "Yes", classification: "Service revenue or customer receipt", review_status: "Confirmed", reviewed_by: N, reviewed_at: "2026-01-25", __allow: ["review_status", "reviewed_by", "reviewed_at"] });
  const fin = [["2025-09-30", "Revenue", "United Kingdom", null, null, "Software services H1", 180000, "GBP", 0.79, 380], ["2026-03-31", "Revenue", "Singapore", null, null, "Software services FY", 220000, "USD", null, 300], ["2026-03-31", "Revenue", "Sri Lanka", null, null, "Services to Port City entities", 15000000, "LKR", 300, null],
    ["2025-06-30", "Capital expenditure", null, null, null, "Laptops and office fit-out", 85000, "USD", null, 300], ["2026-03-31", "Basic remuneration", null, "Sri Lankan", null, "Salaries FY", 42000000, "LKR", 300, null], ["2026-03-31", "Basic remuneration", null, "Non-Sri Lankan", null, "Salaries FY", 260000, "USD", null, 300],
    ["2026-03-31", "Allowance payments", null, "Sri Lankan", null, "Allowances FY", 6000000, "LKR", 300, null], ["2026-03-31", "Bonus payments", null, "Sri Lankan", null, "Annual bonus", 3500000, "LKR", 300, null], ["2026-03-31", "Staff accommodation", null, "Non-Sri Lankan", null, "Apartment leases", 48000, "USD", null, 300],
    ["2026-03-31", "Health insurance", null, "Sri Lankan", null, "Group medical", 2400000, "LKR", 300, null], ["2026-03-31", "Health insurance", null, "Non-Sri Lankan", null, "International medical cover", 9000, "USD", null, 300], ["2026-03-31", "Transportation", null, "Sri Lankan", null, "Staff transport", 1200000, "LKR", 300, null],
    ["2026-03-31", "Office rent", null, null, offIn, "Port City office rent", 96000, "USD", null, 300], ["2026-03-31", "Office rent", null, null, offOut, "Interim office rent", 7200000, "LKR", 300, null], ["2026-03-31", "Other operational expenditure", null, null, null, "Utilities, software, professional fees", 3000000, "LKR", 300, null],
    ["2026-03-31", "EPF payment", null, "Sri Lankan", null, "EPF employer contribution", 5040000, "LKR", 300, null], ["2026-03-31", "ETF payment", null, "Sri Lankan", null, "ETF contribution", 1260000, "LKR", 300, null]];
  for (const f of fin) await S("fin_entries", { entry_date: f[0], category: f[1], country_region: f[2], staff_group: f[3] || "Not applicable", office_id: f[4], description: f[5], original_amount: f[6], original_currency: f[7], usd_rate: f[8], lkr_rate: f[9], rate_date: f[7] === "GBP" ? "2025-09-30" : f[0], rate_source: "Demo rate", pre_operating: "No" });
  for (const u of [["Apartment A (demo)", "2025-05-01"], ["Apartment B (demo)", "2025-07-01"]]) await S("housing", { description: u[0], staff_group: "Non-Sri Lankan", tenure: "Leased", from_date: u[1] });
  await S("obligations", { title: "Submit the Annual Return when requested by the Commission", obligation_type: "Reporting deadline", basis: "Requested by the Commission", source_document: "Annual Return Submission Form 2026", deadline: addDays(T, 20), recurrence: "Annually", responsible: N, status: "In progress", needs_review: "No" });
  await S("obligations", { title: "Pay the annual licence renewal fee two months before expiry", obligation_type: "Law or regulation", basis: "General law or regulation - applicability confirmed", source_document: "Fees Regulations No. 2 of 2024 (Gazette 2387/38)", deadline: addDays(T, -10), recurrence: "Annually", responsible: N, status: "Not started", needs_review: "No" });
  await S("obligations", { title: "File tax returns under the Inland Revenue Act", obligation_type: "Law or regulation", basis: "General law or regulation - applicability to be confirmed", source_document: "Section 52C, inserted by Amendment Act No. 1 of 2026", recurrence: "Annually", status: "Under review", needs_review: "Yes", description: "Confirm filing dates with the tax adviser." });
  await S("obligations", { title: "Maintain an office within Colombo Port City (demo condition)", obligation_type: "Licence condition", basis: "Stated in our licence, approval or agreement", source_document: "AP licence DEMO-AP-0147, condition 3 (demo)", target: "At least 300 sqm", recurrence: "Annually", status: "Met", needs_review: "No" });
  for (const v of [["James Whitfield", "British", "Engineering Manager", "Residence visa - Employee", "Approved", addDays(T, 30), addDays(T, 150)], ["Mei Lin Tan", "Singaporean", "Senior Software Engineer", "Residence visa - Employee", "Approved", addDays(T, 200), "2031-05-01"], ["Arjun Mehta", "Indian", "Senior Software Engineer (joining)", "Residence visa - Employee", "Documents being prepared", null, "2030-02-01"]])
    await S("visas", { person_name: v[0], person_type: "Employee", nationality: v[1], role: v[2], visa_category: v[3], application_status: v[4], expiry_date: v[5], passport_expiry: v[6], responsible: P });
  await S("requests", { title: "Employee information as at 30 September 2026 (demo)", category: "Employee information", received_date: addDays(T, -5), deadline: addDays(T, 4), period_or_date: "30 September 2026", responsible: P, contact_name: "Commission officer (demo)",
    required_info: "1. Job titles and nationalities\n2. Minimum qualifications and experience for each position\n3. Language requirements\n4. Accommodation\n5. Health insurance\n6. Travel and relocation\n7. Other benefits", status: "In Progress", __allow: ["status"] });
  await S("requests", { title: "Annual Return 2025/26 (demo)", category: "Annual return", received_date: addDays(T, -40), deadline: addDays(T, 20), period_or_date: "1 April 2025 to 31 March 2026", responsible: N });
  const years = [{ revenue_usd: 900000, expenses_usd: 820000, net_income_usd: 80000, local_employees: 6, foreign_employees: 2, office_sqm: 300, fdi_usd: 1500000, funding_source: "Equity", funding_details: "Share capital from the parent company." },
    { revenue_usd: 1600000, expenses_usd: 1350000, net_income_usd: 250000, local_employees: 15, foreign_employees: 4, office_sqm: 400, fdi_usd: 500000, funding_source: "Equity and Debt", funding_details: "Parent loan and retained profit." },
    { revenue_usd: 2500000, expenses_usd: 2000000, net_income_usd: 500000, local_employees: 30, foreign_employees: 6, office_sqm: 600, fdi_usd: 500000, funding_source: "Equity" }, {}, {}];
  const bp = { title: "Business plan (demo)", version_no: 1, status: "Locked", is_reference: true, commission_status: "Submitted with the licence application", commission_date: "2025-01-15", commission_ref: "DEMO application ref 0147", year1_start: "2025-04-01", years, milestones: [{ milestone: "Open Port City office", target_date: "2025-04-01", actual_status: "Achieved", actual_date: "2025-04-01" }, { milestone: "Reach 20 staff", target_date: "2026-09-30", actual_status: "Delayed" }],
    sections: { background: "Demo Company is a sample company owned by a UK group.", activities: "Software development and IT services for overseas clients.", customers: "Clients in the UK, Singapore and the region.", employment: "Mostly local hiring, with a few overseas specialists.", office: "Start with about 300 sqm in Port City, growing to 600 sqm by 2028." }, notes: {}, prepared_by: P, ready_by: P, locked_by: R, locked_at: "2025-03-15 10:00:00" };
  bp.hash = await sha256(bpHashBody(bp)); await Store.save("bplans", Object.assign(bp, { data_source: "Demo" }));
  await Store.save("returns", { title: "Annual Return 2025/26 (demo)", template: AR_TEMPLATE.code, period_start: AR_TEMPLATE.period.start, period_end: AR_TEMPLATE.period.end, headcount_as_at: AR_TEMPLATE.period.headcount, office_as_at: AR_TEMPLATE.period.end, currency_method: "split", status: "Draft", lines: {}, prepared_by: Store.uid, data_source: "Demo" });
  for (const d of [["AP licence certificate", "AP and BSI approvals", "Normal"], ["UBO declaration - Helen Clarke", "UBO declarations", "Restricted"], ["Audited financial statements FY 2025/26", "Audited financial statements", "Normal"]])
    await Store.save("docs", { title: d[0] + " (demo)", category: d[1], access: d[2], versions: [], data_source: "Demo" });
  // budget year 2026/27: monthly records so the budget has actuals to compare
  for (let i = 0; i < 6; i++) { const m = addDays(addMonths("2026-04-01", i + 1), -1);
    for (const f of [["Revenue", "Singapore", null, null, "Monthly services", [52000, 48000, 61000, 39000, 57000, 66000][i], "USD", null, 300], ["Basic remuneration", null, "Sri Lankan", null, "Salaries", 3600000, "LKR", 300, null], ["Basic remuneration", null, "Non-Sri Lankan", null, "Salaries", 22000, "USD", null, 300],
      ["Office rent", null, null, offIn, "Port City office rent", 8000, "USD", null, 300], ["Other operational expenditure", null, null, null, "Utilities and software", [250000, 240000, 410000, 260000, 255000, 330000][i], "LKR", 300, null], ["Staff accommodation", null, "Non-Sri Lankan", null, "Apartment leases", 4000, "USD", null, 300]])
      await S("fin_entries", { entry_date: m, category: f[0], country_region: f[1], staff_group: f[2] || "Not applicable", office_id: f[3], description: f[4], original_amount: f[5], original_currency: f[6], usd_rate: f[7], lkr_rate: f[8], rate_date: m, rate_source: "Demo rate", pre_operating: "No" }); }
  await S("fin_entries", { entry_date: "2026-07-15", category: "Capital expenditure", description: "Meeting room equipment", original_amount: 14500, original_currency: "USD", lkr_rate: 300, rate_date: "2026-07-15", rate_source: "Demo rate", staff_group: "Not applicable", pre_operating: "No" });
  const mon = v => Array(12).fill(v);
  await Store.save("budgets", { title: "Budget 2026/27 (demo)", fy_start: "2026-04-01", currency: "USD", status: "Approved", approved_by: R, approved_at: "2026-03-20 09:00:00", prepared_by: N, data_source: "Demo",
    lines: { "Revenue": { months: mon(50000) }, "Basic remuneration": { months: mon(34000) }, "Office rent": { months: mon(8000) }, "Staff accommodation": { months: mon(4000) }, "Health insurance": { months: mon(1000) },
      "Other operational expenditure": { months: mon(900) }, "Capital expenditure": { months: [0, 0, 0, 10000, 0, 0, 0, 0, 0, 5000, 0, 0] } } });
  await Store.save("inflows", { title: "Initial investment (demo)", target_usd: 2500000, start: "2025-04-01", end: "2027-03-31", counts: "Confirmed FDI only", basis: "Business plan projection (not a commitment)", source_ref: "Business plan v1, years 1 and 2", data_source: "Demo",
    expected: { "2025-05": 1500000, "2025-11": 500000, "2026-06": 250000, "2026-12": 250000 } });
  for (const r of [["Port City Tower, Level 18 (demo)", "Inside Colombo Port City", 450, "sqm", 60, "USD", "Per sqm per month", 28, 2500, 5, 5, 3, null, 3, 45000, "2027-01-01"],
    ["Port City Commercial Block B (demo)", "Inside Colombo Port City", 600, "sqm", 80, "USD", "Per sqm per month", 24, 3000, 4, 3, 6, null, 0, 60000, "2027-04-01"],
    ["Colombo 03 office building (demo)", "Designated location outside Port City", 5400, "sqft", 70, "LKR", "Per sqft per month", 450, 250000, 10, 3, 6, null, 6, 9000000, "2026-12-01"]])
    await S("rent_options", { name: r[0], location: r[1], floor_area: r[2], area_unit: r[3], seats: r[4], currency: r[5], rent_basis: r[6], rent_rate: r[7], service_charge: r[8], escalation_pct: r[9], lease_years: r[10], deposit_months: r[11], deposit_amount: r[12], advance_months: r[13], fitout_cost: r[14], available_from: r[15],
      designation_note: r[1].startsWith("Designated") ? "Interim designation ended 26 May 2026 under Reg. 15. Not confirmed with the Commission (demo)." : null });
  await Store.save("space", { start: "2026-10-01", quarters: 12, sqm_per_seat: 8, seat_ratio: 1, buffer_pct: 20, include_contractors: "No", hires: { "2026-10": 2, "2027-01": 4, "2027-04": 4, "2027-07": 5, "2027-10": 4, "2028-01": 5, "2028-04": 4, "2028-07": 3 }, leavers: { "2027-07": 1, "2028-01": 1 }, data_source: "Demo" }, "forecast");
  await Store.audit("companies", Store.cid, "Demo data loaded", "Made-up sample records added for trying the system");
}

