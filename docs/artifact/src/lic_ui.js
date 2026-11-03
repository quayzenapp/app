/* ===== lic_ui.js ===== */
/* Screens for the licence application workspace. One application per company is usual; more are allowed
   (for example a later BSI application). Every screen says which form and section each item comes from. */

const refChip = r => r ? `<span class="refc" title="Where this is asked">${esc(r)}</span>` : "";
const canLic = (lvl = "write") => Store.can("licensing", lvl);
const appLocked = a => APP_LOCKED.includes(a.status);
function currentApp() {
  const apps = Store.list("apps").sort((x, y) => (y.created_at || "").localeCompare(x.created_at || ""));
  if (UI.appId && apps.find(x => x.id === UI.appId)) return apps.find(x => x.id === UI.appId);
  return apps.find(x => !["Withdrawn", "Rejected"].includes(x.status)) || apps[0] || null;
}

/* ======================= PAGE ======================= */
PAGES.apply = () => {
  const apps = Store.list("apps"), a = currentApp();
  if (!a) return applyStart();
  return appWorkspace(a, apps.length > 1);
};
function processStrip(cur) {
  const idx = cur ? APP_STAGES.findIndex(([, ss]) => ss.includes(cur)) : -1;
  return `<ol class="stepper">${APP_STAGES.map(([l], i) => `<li class="${i < idx || cur === "Licence issued" ? "done" : i === idx ? "cur" : ""}"><span>${i < idx || cur === "Licence issued" ? "✓" : i + 1}</span>${esc(l)}</li>`).join("")}</ol>`;
}
function applyStart() {
  const c = Store.company(), w = canLic();
  return ovHead("Licence application", "Prepare your application to the Colombo Port City Economic Commission for an Authorised Person licence or BSI designation: the Schedule I form, the prescribed Commission forms and the supporting documents.")
  + `<div class="card"><h3>How the Commission's process works</h3>${processStrip(null)}
   <ul class="small" style="margin-top:12px"><li><b>Apply online</b> - submit the application and supporting documents for preliminary review, with the processing fee.</li>
   <li><b>Approval in Principle</b> - the Commission may issue a letter of Approval in Principle, at its discretion.</li>
   <li><b>Regulatory clearances</b> - the Commission, as single window, obtains clearances from other regulators.</li>
   <li><b>Licence issued</b> - with an Investor Agreement and, for offshore companies, a Certificate of Registration. The licence is valid for 12 months.</li></ul>
   <p class="help">From the Commission's application process page. BSI-specific steps are not described there; check them with the Commission.</p></div>
  ${w ? `<div class="card hl"><h3>Start an application</h3><form class="f" data-form="app-new" novalidate><div class="grid3f">
    <div class="fld"><label for="an_t">Application type</label><select id="an_t" name="app_type" required>${APP_TYPES.map(t => `<option>${esc(t)}</option>`).join("")}</select></div>
    <div class="fld"><label for="an_o">Local or foreign applicant</label><select id="an_o" name="origin"><option>Foreign</option><option>Local</option></select></div>
    <div class="fld"><label for="an_l">Legal personality</label><select id="an_l" name="legal">${LEGAL_FOREIGN.map(t => `<option${t === "Company" ? " selected" : ""}>${esc(t)}</option>`).join("")}</select><span class="help">Schedule I, Part I(e). You can change these later.</span></div>
    <div class="fld"><label for="an_d">Planned submission date</label><input type="date" id="an_d" name="planned_date"></div></div>
    <div class="row"><button class="btn p">Start the application</button></div><p class="small muted">Details already in the company profile (name, address, contact, signatory) are offered as suggestions on each screen.</p></form></div>` : '<p class="muted">Your role can view applications but not start one.</p>'}
  ${!c.is_demo && Store.can("settings", "write") ? `<p class="small muted">Want to see a filled example first? <button class="link" data-act="app-demo">Load the demo applicant company</button> (made-up data, marked DEMO).</p>` : ""}`;
}
FORMS["app-new"] = async form => {
  const o = readForm(form);
  const id = await Store.save("apps", { title: `${o.app_type} application`, app_type: o.app_type, origin: o.origin, legal: o.legal, planned_date: o.planned_date || null,
    status: APP_STATUS.prep, p1: {}, p2: { lkr_currency: "LKR" }, p6: {}, q: {}, marks: {}, tef: { v: {}, d: {} }, prof: {}, decl: {}, checklist: {}, events: [{ at: nowIso(), by: Store.uid, status: APP_STATUS.prep, note: "Application started" }] });
  await Store.audit("apps", id, "Created", `Application started: ${o.app_type}`);
  const c = Store.company(); if (!c.stage) await Store.saveCompany({ stage: "applicant" });
  UI.appId = id; UI.tab.apply = "applicant"; render(); toast("Application started. Work through the steps in any order.");
};

/* ======================= WORKSPACE ======================= */
function appWorkspace(a, many) {
  const step = curTab("apply", "overview"), R = appReadiness(a), w = canLic() && !appLocked(a);
  const count = k => { if (k === "checklist") return R.docs.total - R.docs.ok; const s = R.steps.find(x => x.k === k); return s ? s.missing.length : 0; };
  const nav = `<div class="appnav" role="tablist">${APP_STEPS.map(([k, l]) => { const n = count(k); return `<button role="tab" class="tab${k === step ? " on" : ""}" aria-selected="${k === step}" data-act="app-go" data-step="${k}">${esc(l)}${["overview", "forms", "history"].includes(k) ? "" : n ? ` <span class="cnt">${n}</span>` : ' <span class="cnt ok">✓</span>'}</button>`; }).join("")}</div>`;
  const others = many ? `<select data-change="app-switch" aria-label="Choose application">${Store.list("apps").map(x => `<option value="${x.id}"${x.id === a.id ? " selected" : ""}>${esc(x.title)} (${esc(x.status)})</option>`).join("")}</select>` : "";
  const body = { overview: appOverview, applicant: x => appFieldsStep(x, "applicant"), business: x => appFieldsStep(x, "business"), people: appPeopleStep, proposal: appProposalStep,
    projections: appTefStep, bplan: a => bpbStep(a), profile: appProfileStep, declarations: appDeclStep, checklist: appChecklistStep, forms: appFormsStep, history: appHistoryStep }[step] || appOverview;
  return `<div class="head"><div class="t"><h1>${esc(a.title)}</h1><div class="row">${badge(a.status)}<span class="small muted">${esc(a.app_type)} · ${esc(a.origin || "")} ${esc((a.legal || "").toLowerCase())}${a.planned_date ? " · planned submission " + fmtDate(a.planned_date) : ""}</span></div></div>
    <div class="acts">${others}${canLic() && Store.list("apps").length < 5 && ["Licence issued", "Withdrawn", "Rejected"].includes(a.status) ? '<button class="btn" data-act="app-another">Start another application</button>' : ""}</div></div>
   ${appLocked(a) ? `<div class="banner info">This application is <b>${esc(a.status.toLowerCase())}</b>, so it is locked. ${a.status !== "Licence issued" && canLic() ? '<button class="link" data-act="app-status" data-to="Further information requested">The Commission asked for more information - reopen it</button>' : ""}</div>` : ""}
   ${nav}${body(a, w)}`;
}
ACTIONS["app-go"] = async el => {
  const f = document.querySelector('main form[data-autosave="1"]');
  if (f && UI.typing) { try { await FORMS[f.dataset.form](f, { silent: true }); } catch (e) { showErrors(e); return; } }
  UI.typing = false; UI.tab.apply = el.dataset.step; UI.view = null; render(); window.scrollTo(0, 0);
};
CHANGES["app-switch"] = el => { UI.appId = el.value; UI.tab.apply = "overview"; render(); };
ACTIONS["app-another"] = () => { UI.appId = "__new"; render(); };
const _pa = PAGES.apply; PAGES.apply = () => UI.appId === "__new" ? applyStart() : _pa();

/* ---------- overview ---------- */
function appOverview(a) {
  const R = appReadiness(a), ps = appPeople("app_id", a.id), done = R.steps.filter(s => !s.missing.length).length, cl = checklistRows(a);
  const old = cl.filter(r => r.warn.some(x => /30 days/.test(x))).length;
  const next = []; R.steps.forEach(s => s.missing.slice(0, 2).forEach(m => next.push([s.k, s.l, m])));
  const acts = statusActions(a);
  const sh = ps.filter(p => hasRole(p, "sh") && p.shareholding_pct).map(p => ({ label: p.name, value: Number(p.shareholding_pct) }));
  return `<div class="card">${processStrip(a.status)}${acts ? `<div class="row" style="margin-top:12px">${acts}</div>` : ""}</div>`
  + routeCard(a)
  + hlCards([{ value: `${done} of ${R.steps.length}`, label: "Steps complete", kind: done < R.steps.length ? "warn" : "" },
    { value: `${R.docs.ok} of ${R.docs.total}`, label: "Supporting documents ready", kind: R.docs.ok < R.docs.total ? "warn" : "" },
    { value: ps.length, label: "People and companies", sub: `${ps.filter(p => hasRole(p, "dir")).length} director(s) · ${ps.filter(p => hasRole(p, "sh")).length} shareholder(s)` },
    { value: old, label: "Certified copies older than 30 days", kind: old ? "bad" : "" },
    { value: a.planned_date ? (daysUntil(a.planned_date) >= 0 ? daysUntil(a.planned_date) + " days" : "Passed") : "Not set", label: "To planned submission", kind: a.planned_date && daysUntil(a.planned_date) < 0 && !appLocked(a) ? "warn" : "" }])
  + `<div class="vgrid">${vizCard("Readiness by step", hbars(R.steps.map(s => ({ label: s.l, value: Math.max(0, 100 - s.missing.length * 10), tip: s.missing.length ? s.missing.length + " to do" : "complete" })), v => v >= 100 ? "done" : "", "", { keepZero: true, max: 100 }), "A rough guide: each missing item takes 10 points off its step.")}
    ${vizCard("Ownership in the application", sh.length ? donutMany(sh, [fmtNum(r2(sh.reduce((t, x) => t + x.value, 0))) + "%", "recorded"], v => fmtNum(r2(v)) + "%") : '<p class="muted small">Add shareholders under People.</p>')}
    ${vizCard("Next things to do", next.length ? `<ul class="small tl">${next.slice(0, 8).map(([k, l, m]) => `<li><a href="#" data-act="app-go" data-step="${k}">${esc(l)}</a>: ${esc(m)}</li>`).join("")}</ul>${next.length > 8 ? `<p class="small muted">and ${next.length - 8} more.</p>` : ""}` : '<p class="small">All steps are complete. Check the documents list, then ask a second person to approve the application.</p>')}</div>
   <div class="cols"><div class="card"><h3>Key dates and references</h3><dl class="kv">
    <dt>Started</dt><dd>${fmtDate((a.created_at || "").slice(0, 10))}</dd><dt>Planned submission</dt><dd>${fmtDate(a.planned_date) || "—"}</dd>
    <dt>Submitted</dt><dd>${fmtDate(a.submitted_date) || "—"} ${esc(a.submission_ref || "")}</dd><dt>Approval in Principle</dt><dd>${fmtDate(a.aip_date) || "—"} ${esc(a.aip_ref || "")}</dd>
    <dt>Licence</dt><dd>${esc(a.licence_number || "—")} ${a.licence_issue_date ? `issued ${fmtDate(a.licence_issue_date)}, expires ${fmtDate(a.licence_expiry_date)}` : ""}</dd>
    <dt>Approved for submission</dt><dd>${a.approved_by ? `${esc(Store.name(a.approved_by))} on ${fmtDate(a.approved_at)} (version ${a.approved_version || 1})` : "—"}</dd></dl></div>
   <div class="card"><h3>What the system does and doesn't do</h3><ul class="small"><li>It fills the Commission's own forms with what you enter, and lists anything left blank.</li><li>It never ticks the past-records statements, signs a declaration or submits anything. You do that, then record it here.</li><li>Business plan figures are projections, not commitments.</li><li>It does not decide whether the application meets the Commission's requirements.</li></ul></div></div>`;
}
function statusActions(a) {
  if (!canLic()) return "";
  const b = (to, label, cls = "") => `<button class="btn ${cls}" data-act="app-status" data-to="${esc(to)}">${esc(label)}</button>`;
  switch (a.status) {
    case APP_STATUS.prep: case APP_STATUS.info: return b(APP_STATUS.ready, "Mark ready for review", "p") + b(APP_STATUS.withdrawn, "Withdraw");
    case APP_STATUS.ready: return (canLic("approve") ? '<button class="btn ok" data-act="app-approve">Approve for submission</button>' : '<span class="small muted">Waiting for a reviewer with approval rights.</span>') + b(APP_STATUS.prep, "Back to preparing");
    case APP_STATUS.approved: return b(APP_STATUS.submitted, "Record submission", "p") + b(APP_STATUS.prep, "Back to preparing");
    case APP_STATUS.submitted: return b(APP_STATUS.aip, "Record Approval in Principle", "p") + b(APP_STATUS.info, "Commission asked for more information") + b(APP_STATUS.rejected, "Record rejection") + b(APP_STATUS.withdrawn, "Withdraw");
    case APP_STATUS.aip: return b(APP_STATUS.clear, "Regulatory clearances in progress") + b(APP_STATUS.issued, "Record licence issued", "p");
    case APP_STATUS.clear: return b(APP_STATUS.issued, "Record licence issued", "p") + b(APP_STATUS.info, "Commission asked for more information");
    case APP_STATUS.issued: return '<button class="btn p" data-act="app-setup">Set up compliance records from this application</button>';
    default: return "";
  }
}

/* ---------- generic field step ---------- */
function appFieldHTML(a, f, locked) {
  const v = getPath(a, f.k), mark = (a.marks || {})[f.k], id = "af_" + f.k.replace(/\W/g, "_"), c = Store.company() || {};
  const ch = typeof f.ch === "function" ? f.ch(a) : f.ch || [];
  const dis = locked || mark ? " disabled" : "";
  let inp;
  if (mark) inp = `<input id="${id}" disabled value="${esc(mark)}">`;
  else if (f.t === "area") inp = `<textarea id="${id}" name="${f.k}" rows="3"${dis}>${esc(v ?? "")}</textarea>`;
  else if (f.t === "choice") inp = `<select id="${id}" name="${f.k}"${dis}${f.k === "origin" ? ' data-change="app-origin"' : ""}><option value="">—</option>${ch.map(o => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}${v && !ch.includes(v) ? `<option selected>${esc(v)}</option>` : ""}</select>`;
  else if (f.t === "yn") inp = `<select id="${id}" name="${f.k}"${dis}><option value="">—</option>${YES_NO.map(o => `<option${o === v ? " selected" : ""}>${o}</option>`).join("")}</select>`;
  else if (f.t === "multi") inp = `<div class="mchk" id="${id}">${ch.map(o => `<label><input type="checkbox" name="${f.k}" value="${esc(o)}"${(v || []).includes(o) ? " checked" : ""}${dis}> ${esc(o)}</label>`).join("")}</div>`;
  else if (f.t === "check") inp = `<label class="radio"><input type="checkbox" id="${id}" name="${f.k}" value="1"${v ? " checked" : ""}${dis} data-change="app-dep"> Yes</label>`;
  else if (f.t === "date") inp = `<input type="date" id="${id}" name="${f.k}" value="${esc(v ?? "")}"${dis}>`;
  else if (f.t === "num") inp = `<input type="text" inputmode="decimal" id="${id}" name="${f.k}" value="${esc(v ?? "")}"${dis}>`;
  else inp = `<input type="text" id="${id}" name="${f.k}" value="${esc(v ?? f.dflt ?? "")}"${dis}>`;
  const sug = !locked && !mark && f.sug ? f.sug(c) : null;
  const sugBtn = sug && String(sug) !== String(v ?? "") ? `<button type="button" class="link small" data-act="app-sug" data-for="${id}" data-v="${esc(sug)}">Use from company profile: ${esc(String(sug).slice(0, 60))}</button>` : "";
  const markBtn = !locked && f.t !== "check" && f.t !== "multi" ? `<button type="button" class="mk" data-act="app-mark" data-k="${esc(f.k)}" title="Mark as Not applicable, Nil or Not available">${mark ? "Clear mark" : "N/A…"}</button>` : "";
  const dep = f.k.endsWith("_addr") ? ` data-dep="${f.k.replace("_addr", "")}"` : "";
  const hidden = f.when && !f.when(a) && f.k.endsWith("_addr") ? " hidden" : f.when && !f.when(a) ? " hidden" : "";
  const missing = f.need !== false && (!f.when || f.when(a)) && !filled(v) && !mark;
  return `<div class="fld afld${f.t === "area" || f.t === "multi" ? " wide" : ""}${missing ? " miss" : ""}"${dep}${hidden}><label for="${id}">${esc(f.l)} ${refChip(f.ref)}</label>${inp}<div class="fx">${f.help ? `<span class="help">${esc(f.help)}</span>` : "<span></span>"}<span>${sugBtn}${markBtn}</span></div></div>`;
}
const STEP_INTRO = {
  applicant: ["Applicant", "Schedule I, Part I, plus a few questions that decide which supporting documents apply. Schedule I says every field is mandatory: if something does not apply, mark it 'Not applicable' rather than leaving it blank."],
  business: ["Business", "Schedule I, Part II(a) to (i): sector, activities, proposed office, investment, signatory and supervisory authority. People (Part II(e) and (f)) are on the People step."],
};
function appFieldsStep(a, step, locked) {
  locked = locked ?? (!canLic() || appLocked(a));
  const fs = APP_SPEC.filter(f => f.step === step), miss = stepMissing(a, step);
  const sug = step === "business" ? fdiSuggestion(a) : null;
  return `<div class="card"><h2>${esc(STEP_INTRO[step][0])}</h2><p class="muted small">${esc(STEP_INTRO[step][1])}</p>${miss.length ? `<p class="small"><span class="badge warn">${miss.length} to do</span> ${esc(miss.slice(0, 4).join("; "))}${miss.length > 4 ? "…" : ""}</p>` : '<p class="small"><span class="badge ok">complete</span></p>'}
   ${sug && !locked ? `<p class="note small">From your projections: total FDI over 10 years USD ${fmtMoney(sug.quantum)}, mode ${esc(sug.mode)}. <button type="button" class="link" data-act="app-fdi-sug">Use these for Part II(d)</button> The form asks for the proposed investment; decide which figure to show.</p>` : ""}</div>
   <form class="f" data-form="app-fields" data-step="${step}" data-id="${a.id}" data-autosave="1" novalidate><fieldset><div class="grid2">${fs.map(f => appFieldHTML(a, f, locked)).join("")}</div></fieldset>
   ${locked ? "" : '<div class="row sticky-save"><button class="btn p">Save</button><span class="small muted">Saved changes are kept in the history.</span></div>'}</form>`;
}
ACTIONS["app-sug"] = el => { const i = document.getElementById(el.dataset.for); if (i) { i.value = el.dataset.v; UI.typing = true; i.focus(); } };
CHANGES["app-dep"] = el => { document.querySelectorAll(`[data-dep="${el.name}"]`).forEach(d => d.hidden = !el.checked); };
CHANGES["app-origin"] = el => {
  const s = document.querySelector('select[name="legal"]'); if (!s) return; const cur = s.value, ch = el.value === "Local" ? LEGAL_LOCAL : LEGAL_FOREIGN;
  s.innerHTML = '<option value="">—</option>' + ch.map(o => `<option${o === cur ? " selected" : ""}>${esc(o)}</option>`).join("");
};
ACTIONS["app-fdi-sug"] = () => { const a = currentApp(), s = fdiSuggestion(a); if (!s) return; const set = (n, v) => { const i = document.querySelector(`[name="${n}"]`); if (i && !i.disabled) i.value = v; };
  set("p2.fdi_currency", s.currency); set("p2.fdi_quantum", s.quantum); set("p2.fdi_mode", s.mode); if (s.source) set("p2.fdi_source", s.source); UI.typing = true; toast("Filled from the projections. Check, then save.", "info"); };

function cleanNum(v, label) { if (v == null || String(v).trim() === "") return null; const n = Number(String(v).replace(/,/g, "")); if (!Number.isFinite(n)) throw `${label}: please enter a number.`; return n; }
function readAppFields(form, a, fs) {
  const out = clone(a), errs = [], changes = [];
  for (const f of fs) {
    if ((a.marks || {})[f.k]) continue;
    let v;
    if (f.t === "multi") v = [...form.querySelectorAll(`[name="${CSS.escape(f.k)}"]:checked`)].map(x => x.value);
    else if (f.t === "check") { const i = form.querySelector(`[name="${CSS.escape(f.k)}"]`); if (!i) continue; v = i.checked; }
    else { const i = form.querySelector(`[name="${CSS.escape(f.k)}"]`); if (!i || i.disabled) continue; v = i.value.trim() || null; if (f.t === "num" && v != null) { try { v = cleanNum(v, f.l); } catch (e) { errs.push(e); continue; } } }
    const old = getPath(a, f.k);
    if (JSON.stringify(old ?? null) !== JSON.stringify(v ?? null) && !(old == null && (v === false || (Array.isArray(v) && !v.length)))) changes.push({ label: f.l, old: Array.isArray(old) ? old.join(", ") : old ?? null, new: Array.isArray(v) ? v.join(", ") : v ?? null });
    setPath(out, f.k, v);
  }
  if (errs.length) throw errs;
  return { out, changes };
}
/* Save part of the application. Changing an application that is ready or approved sends it back to Preparing. */
async function saveApp(a, patch, what, changes) {
  if (appLocked(a)) throw ["This application is locked because it has been submitted. Reopen it if the Commission asked for more information."];
  const back = [APP_STATUS.ready, APP_STATUS.approved].includes(a.status) && (changes == null || changes.length);
  if (back) { patch.status = APP_STATUS.prep; patch.events = (a.events || []).concat([{ at: nowIso(), by: Store.uid, status: APP_STATUS.prep, note: `Changed after ${a.status.toLowerCase()}: ${what}` }]); }
  await Store.save("apps", patch, a.id);
  if (changes == null || changes.length) await Store.audit("apps", a.id, "Updated", `${a.title}: ${what}`, changes && changes.length ? changes : null);
  if (back) toast("The application changed after review, so it is back to Preparing and needs approving again.", "warn");
}
FORMS["app-fields"] = async (form, o = {}) => {
  const a = appOf(form.dataset.id), fs = APP_SPEC.filter(f => f.step === form.dataset.step);
  const { out, changes } = readAppFields(form, a, fs);
  const patch = {}; ["app_type", "origin", "legal", "planned_date", "p1", "p2", "p6", "q", "bp"].forEach(k => { if (JSON.stringify(out[k]) !== JSON.stringify(a[k])) patch[k] = out[k]; });
  if (patch.app_type) patch.title = `${patch.app_type} application`;
  if (!Object.keys(patch).length) { if (!o.silent) toast("No changes to save.", "info"); UI.typing = false; return; }
  await saveApp(a, patch, STEP_INTRO[form.dataset.step] ? STEP_INTRO[form.dataset.step][0] : form.dataset.step, changes);
  UI.typing = false; if (!o.silent) { toast("Saved."); render(); }
};
/* Not applicable / Nil / Not available */
ACTIONS["app-mark"] = el => {
  const a = currentApp(), k = el.dataset.k, cur = (a.marks || {})[k], f = APP_FMAP[k];
  if (cur) return setMark(a, k, null, f ? f.l : k);
  UI.markFor = { owner: "app", k };
  openModal(`<h2>Mark this item</h2><p class="muted">${esc(f ? f.l : k)}</p><p class="small">The form will show your choice instead of leaving the box blank.</p><div class="row">${MARKS.map(m => `<button class="btn" data-act="app-mark-set" data-m="${esc(m)}">${esc(m)}</button>`).join("")}</div>
   <dl class="kv small"><dt>Not applicable</dt><dd>It does not apply to this applicant</dd><dt>Nil</dt><dd>There is none</dd><dt>Not available</dt><dd>It applies, but the information isn't available yet</dd></dl>`);
};
ACTIONS["app-mark-set"] = async el => { const m = UI.markFor; closeModal(); if (!m) return; if (m.owner === "app") { const a = currentApp(); await setMark(a, m.k, el.dataset.m, (APP_FMAP[m.k] || {}).l || m.k); } else await setPersonMark(m, el.dataset.m); };
async function setMark(a, k, m, label) {
  const marks = Object.assign({}, a.marks || {}); if (m) marks[k] = m; else delete marks[k];
  await saveApp(a, { marks }, `${label} marked ${m || "(mark cleared)"}`, [{ label, old: (a.marks || {})[k] || null, new: m }]); UI.typing = false; render();
}

/* ---------- people ---------- */
function appPeopleStep(a) {
  const ps = appPeople("app_id", a.id), w = canLic() && !appLocked(a), co = Store.list("people").filter(p => !p.ceased_date);
  const shTot = r2(ps.filter(p => hasRole(p, "sh")).reduce((t, p) => t + (Number(p.shareholding_pct) || 0), 0));
  return `<div class="card"><h2>People and companies</h2><p class="muted small">Shareholders, members, partners or founders (Schedule I, Part II(e)), directors and the key management body (Part II(f)), the authorised signatory and contact person (Part II(g)), and the key management personnel for the Port City operation (Business Profile form). Each person is entered once and used in every form.</p>
   ${a.legal === "Company" ? '<p class="note small">The applicant is a company, so Parts III and IV (profiles of members) are not required (Schedule I, Part II(e)). Part V is still completed for each director and member of the key management body.</p>' : '<p class="note small">The applicant is not a company, so each member, partner or founder completes Part III (companies) or Part IV (individuals).</p>'}
   ${w ? `<div class="row"><button class="btn p" data-act="ap-person" data-id="">Add a person or company</button>${co.length ? `<button class="btn" data-act="ap-import-people">Copy from the company register (${co.length})</button>` : ""}</div>` : ""}</div>
  ${hlCards([{ value: ps.filter(p => hasRole(p, "sh")).length, label: "Shareholders / members" }, { value: shTot + "%", label: "Ownership recorded", kind: shTot && Math.abs(shTot - 100) > 0.01 ? "warn" : "", sub: shTot && Math.abs(shTot - 100) > 0.01 ? "does not add up to 100%" : "" },
    { value: ps.filter(p => hasRole(p, "dir")).length, label: "Directors / key management body", sub: "Schedule I has room for 10" }, { value: ps.filter(p => hasRole(p, "kmp")).length, label: "Key management personnel" },
    { value: ps.filter(p => personMissing(p, a).length).length, label: "With details missing", kind: ps.some(p => personMissing(p, a).length) ? "warn" : "" }])}
  <div class="tw"><table class="t"><thead><tr><th>Name</th><th>Type</th><th>Roles</th><th class="num">Ownership</th><th>Schedule I parts</th><th>Details</th></tr></thead><tbody>
  ${ps.map(p => { const m = personMissing(p, a), parts = personParts(p, a); return `<tr><td><a href="#" data-act="ap-person" data-id="${p.id}">${esc(p.name || "(no name)")}</a></td><td>${esc(p.kind || "")}</td><td class="small">${(p.roles || []).map(r => `<span class="chip">${esc(r.split(" (")[0].split(" / ")[0])}</span>`).join(" ")}</td><td class="num">${p.shareholding_pct != null ? fmtNum(p.shareholding_pct) + "%" : ""}</td><td>${["II", ...parts].join(", ")}</td><td>${m.length ? `<span class="badge warn" title="${esc(m.join("; "))}">${m.length} missing</span>` : '<span class="badge ok">complete</span>'}</td></tr>`; }).join("") || '<tr><td colspan="6" class="empty">No one added yet.</td></tr>'}</tbody></table></div>
  ${ps.filter(p => hasRole(p, "sh")).length > 10 ? '<p class="note small">Schedule I has room for the ten largest shareholders. The others are listed in the continuation sheet.</p>' : ""}`;
}
ACTIONS["ap-person"] = el => go({ kind: "appperson", app_id: currentApp().id, id: el.dataset.id || null });
VIEWS.appperson = v => personForm(v.app_id ? appOf(v.app_id) : null, v.id ? Store.get("app_people", v.id) : null, v);
function personForm(a, p, v) {
  p = p || { kind: "Individual", roles: [], marks: {} };
  const owner = v.filing_id ? Store.get("filings", v.filing_id) : a, locked = !canLic() || (a && appLocked(a)) || (owner && v.filing_id && ["Submitted", "Acknowledged", "Closed"].includes(owner.status));
  const ctx = a || { legal: "" }; // for a change notice, new members always complete Part III / IV (Schedule III, item F)
  const gs = personGroups(p, ctx), id = k => "pp_" + k;
  const field = f => {
    if (f.g === "hidden") return "";
    const val = p[f.k], mark = (p.marks || {})[f.k], restricted = f.sens && !Store.canSee(f.sens), dis = locked || mark || restricted ? " disabled" : "";
    if (f.t === "rows") {
      const rows = Array.from({ length: f.rows }, (_, i) => (val || [])[i] || {});
      return `<div class="fld wide"><label>${esc(f.l)}${f.sens ? ' <span class="badge brand">restricted</span>' : ""}</label>${restricted ? '<input disabled value="Restricted - your role cannot view or change this">' : `<div class="tw"><table class="t small rowsin"><thead><tr>${f.cols.map(c => `<th>${esc(c[1])}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr>${f.cols.map(c => `<td><input name="${f.k}.${i}.${c[0]}" value="${esc(r[c[0]] ?? "")}"${dis} aria-label="${esc(c[1])} row ${i + 1}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>`}${f.help ? `<span class="help">${esc(f.help)}</span>` : ""}</div>`;
    }
    let inp;
    if (restricted) inp = `<input id="${id(f.k)}" disabled value="Restricted - your role cannot view or change this">`;
    else if (mark) inp = `<input id="${id(f.k)}" disabled value="${esc(mark)}">`;
    else if (f.t === "area") inp = `<textarea id="${id(f.k)}" name="${f.k}" rows="2"${dis}>${esc(val ?? "")}</textarea>`;
    else if (f.t === "choice" || f.t === "yn") { const ch = f.t === "yn" ? YES_NO : f.ch; inp = `<select id="${id(f.k)}" name="${f.k}"${dis}${f.k === "kind" ? ' data-change="pp-dep"' : ""}><option value="">—</option>${ch.map(o => `<option${o === val ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`; }
    else if (f.t === "multi") inp = `<div class="mchk">${f.ch.map(o => `<label><input type="checkbox" name="${f.k}" value="${esc(o)}"${(val || []).includes(o) ? " checked" : ""}${dis} data-change="pp-dep"> ${esc(o)}</label>`).join("")}</div>`;
    else if (f.t === "date") inp = `<input type="date" id="${id(f.k)}" name="${f.k}" value="${esc(val ?? "")}"${dis}>`;
    else inp = `<input type="text" id="${id(f.k)}" name="${f.k}" value="${esc(val ?? "")}"${dis}${f.t === "num" ? ' inputmode="decimal"' : ""}>`;
    const markBtn = !locked && !restricted && !["multi", "choice"].includes(f.t) && p.id ? `<button type="button" class="mk" data-act="pp-mark" data-id="${p.id}" data-k="${f.k}">${mark ? "Clear mark" : "N/A…"}</button>` : "";
    const show = !f.when || f.when(p);
    return `<div class="fld${f.t === "area" || f.t === "multi" ? " wide" : ""}" data-when="${f.when ? f.k : ""}"${show ? "" : " hidden"}><label for="${id(f.k)}">${esc(f.l)}${f.sens ? ' <span class="badge brand">restricted</span>' : ""}</label>${inp}<div class="fx">${f.help ? `<span class="help">${esc(f.help)}</span>` : "<span></span>"}${markBtn}</div></div>`;
  };
  const groups = Object.keys(PERSON_GROUP_LABELS).map(g => `<fieldset data-pg="${g}"${gs.includes(g) ? "" : " hidden"}><legend>${esc(PERSON_GROUP_LABELS[g][0])}</legend><p class="help">${esc(PERSON_GROUP_LABELS[g][1])}</p><div class="grid2">${PERSON_SPEC.filter(f => f.g === g).map(field).join("")}</div></fieldset>`).join("");
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Back</button><h1>${p.id ? esc(p.name || "Person") : "Add a person or company"}</h1><p class="muted">Enter each person once. The same details fill Schedule I, the Information of Directors and Shareholders form and the Business Profile form.</p></div>
   <div class="acts">${p.id && !locked ? `<button class="btn bad" data-act="ap-person-del" data-id="${p.id}">Remove</button>` : ""}</div></div>
   <form class="f" data-form="ap-person" data-id="${p.id || ""}" data-app="${a ? a.id : ""}" data-filing="${v.filing_id || ""}" data-legal="${esc(ctx.legal || "")}" novalidate>${groups}
   ${locked ? "" : '<div class="row sticky-save"><button class="btn p">Save</button><button type="button" class="btn" data-act="back">Cancel</button></div>'}</form>`;
}
/* Show the right sections as the type and roles change */
CHANGES["pp-dep"] = el => {
  const f = el.closest("form"), kind = (f.querySelector('[name="kind"]') || {}).value, roles = [...f.querySelectorAll('[name="roles"]:checked')].map(x => x.value);
  const p = { kind, roles }, gs = personGroups(p, { legal: f.dataset.legal });
  f.querySelectorAll("[data-pg]").forEach(fs => fs.hidden = !gs.includes(fs.dataset.pg));
  f.querySelectorAll("[data-when]").forEach(d => { const fd = PERSON_FMAP[d.dataset.when]; if (fd && fd.when) d.hidden = !fd.when(p); });
};
function readPerson(form, before) {
  const p = clone(before || {}), changes = [], errs = [];
  for (const f of PERSON_SPEC) {
    if (f.g === "hidden" || (f.sens && !Store.canSee(f.sens)) || (p.marks || {})[f.k]) continue;
    let v;
    if (f.t === "rows") {
      const rows = []; for (let i = 0; i < f.rows; i++) { const r = {}; f.cols.forEach(c => { const x = form.querySelector(`[name="${CSS.escape(`${f.k}.${i}.${c[0]}`)}"]`); if (x && x.value.trim()) r[c[0]] = x.value.trim(); }); if (Object.keys(r).length) rows.push(r); }
      v = rows;
    } else if (f.t === "multi") v = [...form.querySelectorAll(`[name="${f.k}"]:checked`)].map(x => x.value);
    else { const x = form.querySelector(`[name="${f.k}"]`); if (!x || x.disabled) continue; v = x.value.trim() || null; if (f.t === "num" && v != null) { try { v = cleanNum(v, f.l); } catch (e) { errs.push(e); continue; } } }
    const o = p[f.k];
    if (JSON.stringify(o ?? null) !== JSON.stringify(v ?? null) && !(o == null && Array.isArray(v) && !v.length)) changes.push(f.sens ? { label: f.l, old: "[restricted]", new: "[restricted - changed]" } : { label: f.l, old: Array.isArray(o) ? `${o.length} item(s)` : o ?? null, new: Array.isArray(v) ? `${v.length} item(s)` : v ?? null });
    p[f.k] = v;
  }
  if (!p.name) errs.push("Enter the full name."); if (!p.kind) errs.push("Choose individual or company."); if (!(p.roles || []).length) errs.push("Choose at least one role.");
  if (p.shareholding_pct != null && (p.shareholding_pct < 0 || p.shareholding_pct > 100)) errs.push("Ownership must be between 0 and 100%.");
  if (errs.length) throw errs;
  return { p, changes };
}
FORMS["ap-person"] = async form => {
  const id = form.dataset.id || null, before = id ? Store.get("app_people", id) : null, a = form.dataset.app ? appOf(form.dataset.app) : null, fil = form.dataset.filing ? Store.get("filings", form.dataset.filing) : null;
  const { p, changes } = readPerson(form, before);
  delete p.id; if (!id) { if (a) p.app_id = a.id; if (fil) p.filing_id = fil.id; p.marks = p.marks || {}; }
  if (a) { if (appLocked(a)) throw ["This application is locked."]; if ([APP_STATUS.ready, APP_STATUS.approved].includes(a.status) && (changes.length || !id)) await saveApp(a, {}, `People: ${p.name}`, null); }
  const nid = await Store.save("app_people", p, id);
  await Store.audit("app_people", nid, id ? "Updated" : "Created", `${a ? "Application" : "Filing"} person: ${p.name}`, changes.length ? changes : null);
  UI.typing = false; toast("Saved."); back();
};
ACTIONS["ap-person-del"] = el => confirmModal("Remove this person from the application? Their details are deleted from the application (the company register is not changed).", async () => {
  const p = Store.get("app_people", el.dataset.id); await Store.save("app_people", { archived: true }, p.id); await Store.audit("app_people", p.id, "Removed", `Application person removed: ${p.name}`); back(); });
ACTIONS["pp-mark"] = el => { const p = Store.get("app_people", el.dataset.id), k = el.dataset.k; if ((p.marks || {})[k]) return setPersonMark({ id: p.id, k }, null);
  UI.markFor = { owner: "person", id: p.id, k }; openModal(`<h2>Mark this item</h2><p class="muted">${esc(PERSON_FMAP[k].l)}</p><div class="row">${MARKS.map(m => `<button class="btn" data-act="app-mark-set" data-m="${esc(m)}">${esc(m)}</button>`).join("")}</div>`); };
async function setPersonMark(m, val) {
  const p = Store.get("app_people", m.id), marks = Object.assign({}, p.marks || {}); if (val) marks[m.k] = val; else delete marks[m.k];
  await Store.save("app_people", { marks }, p.id); await Store.audit("app_people", p.id, "Updated", `${p.name}: ${PERSON_FMAP[m.k].l} ${val ? "marked " + val : "mark cleared"}`); render();
}
ACTIONS["ap-import-people"] = async () => {
  const a = currentApp(), have = new Set(appPeople("app_id", a.id).map(p => (p.name || "").trim().toLowerCase())); let n = 0;
  for (const c of Store.list("people").filter(p => !p.ceased_date)) {
    if (have.has((c.full_name || "").trim().toLowerCase())) continue;
    const roles = []; if (/hareholder/.test(c.role)) roles.push(ROLE.sh); if (/Director/.test(c.role)) roles.push(ROLE.dir); if (/signatory/i.test(c.role)) roles.push(ROLE.sig);
    if (!roles.length) continue;
    await Store.save("app_people", { app_id: a.id, kind: c.person_type === "Corporate" ? "Corporate" : "Individual", name: c.full_name, roles, nationality: c.nationality || null, shareholding_pct: c.shareholding_pct ?? null, source_person_id: c.id, marks: {}, data_source: "Copied from company register" }); n++;
  }
  await Store.audit("apps", a.id, "Updated", `${n} people copied from the company register`); toast(n ? `${n} copied. Open each one to add the details the forms need.` : "Everyone in the register is already in the application.", n ? "ok" : "info");
};

/* ---------- proposed business (Part VI) ---------- */
function appProposalStep(a) {
  const locked = !canLic() || appLocked(a), fs = APP_SPEC.filter(f => f.step === "proposal"), miss = stepMissing(a, "proposal"), m = getPath(a, "p6.mp") || {};
  const t1 = tefTotals(a)[0];
  const num = (k, c) => `<input class="num sm" name="p6.mp.${k}.${c}" value="${esc(((m[k] || {})[c]) ?? "")}" inputmode="decimal"${locked ? " disabled" : ""} aria-label="${k} ${c}">`;
  const tot = c => MP_ROWS.reduce((t, [k]) => t + (Number((m[k] || {})[c]) || 0), 0);
  return `<div class="card"><h2>Proposed business</h2><p class="muted small">Schedule I, Part VI asks for a business plan statement covering (a) to (f). The same text feeds the four-page business plan listed in the required documents. ${miss.length ? `<span class="badge warn">${miss.length} to do</span>` : '<span class="badge ok">complete</span>'}</p></div>
  <form class="f" data-form="app-proposal" data-id="${a.id}" data-autosave="1" novalidate><fieldset><div class="grid2">${fs.map(f => appFieldHTML(a, f, locked)).join("")}</div></fieldset>
   <fieldset><legend>Manpower planning ${refChip("Schedule I, Part VI(f)")}</legend><p class="help">Number of people by category, and the expected remuneration (state the currency and period, e.g. USD per year). Totals are worked out for you.${t1.staff ? ` Your projections show ${t1.local} local and ${t1.foreign} foreign staff in year 1.` : ""}</p>
   <div class="tw"><table class="t bgrid"><thead><tr><th>Category</th><th class="num">Local</th><th class="num">Non-local</th><th class="num">Total</th><th>Expected remuneration</th></tr></thead><tbody>
   ${MP_ROWS.map(([k, l]) => `<tr><td>${esc(l)}</td><td>${num(k, "local")}</td><td>${num(k, "nonlocal")}</td><td class="num">${fmtNum((Number((m[k] || {}).local) || 0) + (Number((m[k] || {}).nonlocal) || 0))}</td><td><input name="p6.mp.${k}.remun" value="${esc(((m[k] || {}).remun) ?? "")}"${locked ? " disabled" : ""} aria-label="${k} remuneration"></td></tr>`).join("")}
   <tr class="tot"><td>Total (a)+(b)+(c)+(d)</td><td class="num">${fmtNum(tot("local"))}</td><td class="num">${fmtNum(tot("nonlocal"))}</td><td class="num">${fmtNum(tot("local") + tot("nonlocal"))}</td><td><input name="p6.mp_total_remun" value="${esc(getPath(a, "p6.mp_total_remun") ?? "")}"${locked ? " disabled" : ""} aria-label="Total remuneration"></td></tr></tbody></table></div></fieldset>
   ${locked ? "" : '<div class="row sticky-save"><button class="btn p">Save</button></div>'}</form>`;
}
FORMS["app-proposal"] = async (form, o = {}) => {
  const a = appOf(form.dataset.id), fs = APP_SPEC.filter(f => f.step === "proposal");
  const { out, changes } = readAppFields(form, a, fs), errs = [], mp = {};
  for (const [k, l] of MP_ROWS) { mp[k] = {}; for (const c of ["local", "nonlocal"]) { const x = form.querySelector(`[name="p6.mp.${k}.${c}"]`); try { const n = cleanNum(x && x.value, l); if (n != null) mp[k][c] = n; } catch (e) { errs.push(e); } } const r = form.querySelector(`[name="p6.mp.${k}.remun"]`); if (r && r.value.trim()) mp[k].remun = r.value.trim(); }
  if (errs.length) throw errs;
  out.p6 = Object.assign({}, out.p6, { mp, mp_total_remun: (form.querySelector('[name="p6.mp_total_remun"]') || {}).value || null });
  if (JSON.stringify(mp) !== JSON.stringify(getPath(a, "p6.mp") || {})) changes.push({ label: "Manpower planning table", old: null, new: "updated" });
  if (!changes.length && JSON.stringify(out.p6) === JSON.stringify(a.p6) && JSON.stringify(out.bp) === JSON.stringify(a.bp)) { if (!o.silent) toast("No changes to save.", "info"); UI.typing = false; return; }
  await saveApp(a, { p6: out.p6, bp: out.bp || {} }, "Proposed business", changes); UI.typing = false; if (!o.silent) { toast("Saved."); render(); }
};

/* ---------- projections (Technical Evaluation Form) ---------- */
function appTefStep(a) {
  const locked = !canLic() || appLocked(a), sheet = tefSheet(a), t = a.tef || {}, v = t.v || {}, d = t.d || {}, T = tefTotals(a);
  const yrs = Array.from({ length: 10 }, (_, i) => i);
  const yl = i => t.year1 ? `Y${i + 1} <span class="muted small">${String(+t.year1.slice(0, 4) + i)}</span>` : `Year ${i + 1}`;
  const cell = (key, y) => `<td><input class="num sm" name="v.${key}.${y}" value="${esc((v[key] || [])[y] ?? "")}" inputmode="decimal"${locked ? " disabled" : ""} aria-label="${key} year ${y + 1}"></td>`;
  let g0 = ""; const rows = [];
  for (const r of TEF_ROWS) {
    if (r.g !== g0) { rows.push(`<tr class="grp"><td colspan="13"><b>${esc(r.g)}</b></td></tr>`); g0 = r.g; }
    const keys = r.pair && sheet === "primary" ? [[r.k + "_ll", r.l + " - " + TEF_PAIR_LABELS.ll], [r.k + "_dev", r.l + " - " + TEF_PAIR_LABELS.dev]] : [[r.k, r.l]];
    keys.forEach(([key, lab], i) => rows.push(`<tr><td title="${esc(r.help || "")}">${esc(lab)}${r.det && i === 0 ? `<div class="det"><input name="d.${r.k}.provider" placeholder="Funding provider and details" value="${esc((d[r.k] || {}).provider || "")}"${locked ? " disabled" : ""} aria-label="${esc(r.l)} provider"><input name="d.${r.k}.docref" placeholder="Supporting document and reference" value="${esc((d[r.k] || {}).docref || "")}"${locked ? " disabled" : ""} aria-label="${esc(r.l)} document"></div>` : ""}</td>${yrs.map(y => cell(key, y)).join("")}<td class="num">${fmtNum(r2((v[key] || []).reduce((s, x) => s + (Number(x) || 0), 0)))}</td></tr>`));
  }
  const rev = yrs.map(y => ({ label: "Y" + (y + 1), value: tefVal(a, "revenue", y) || 0 })), staff = yrs.map(y => ({ label: "Y" + (y + 1), value: T[y].staff }));
  const inv = [{ label: "FDI equity", value: tefSum(a, "fdi_equity") }, { label: "FDI loans", value: tefSum(a, "fdi_loans") }, { label: "Reinvested earnings", value: tefSum(a, "fdi_reinvested") }, { label: "Customer advances (USD)", value: tefSum(a, "usd_adv") }, { label: "Other USD", value: tefSum(a, "usd_other") }];
  const warn = [];
  yrs.forEach(y => { const r = tefVal(a, "revenue", y), e = tefVal(a, "expenses", y), n = tefVal(a, "net_income", y); if (r != null && e != null && n != null && Math.abs(r - e - n) > 1) warn.push(`Year ${y + 1}: revenue less expenses (${fmtNum(r2(r - e))}) is not the same as net income (${fmtNum(n)}). This may be right (for example tax), but check it.`); });
  return `<div class="card"><h2>Projections</h2><p class="muted small">Ten-year figures for the Commission's Technical Evaluation Form (${sheet === "primary" ? "sheet 'Primary BSI-Only': FDI is split between land lease and development" : "sheet 'AP Only & Secondary BSI'"}). Totals and ratios are worked out by the form itself. These are projections, not commitments.</p>
   ${a.app_type === "Duty Free BSI" ? '<p class="banner warn">The Technical Evaluation Form has no Duty Free BSI sheet. The AP sheet is used, with the application type left blank. Ask the Commission which sheet to use.</p>' : ""}
   ${warn.length ? `<ul class="small rnotes">${warn.slice(0, 4).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>
  <div class="vgrid">${vizCard("Projected revenue (USD millions)", cols(rev, v => (v / 1e6).toFixed(1)))}${vizCard("Staff at year end", cols(staff))}${vizCard("Investment over ten years by source (USD)", hbars(inv, fmtK, "No investment entered."))}</div>
  <form class="f" data-form="app-tef" data-id="${a.id}" data-autosave="1" novalidate><fieldset><div class="row"><div class="fld" style="max-width:260px"><label for="tef_y1">Year 1 starts (optional)</label><input type="date" id="tef_y1" name="year1" value="${esc(t.year1 || "")}"${locked ? " disabled" : ""}><span class="help">Only used to label the years on screen.</span></div></div>
   <div class="tw"><table class="t bgrid tef"><thead><tr><th>Item</th>${yrs.map(y => `<th class="num">${yl(y)}</th>`).join("")}<th class="num">Total</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
   <p class="help">Employee numbers are the people expected to be employed at the end of each year. Remuneration is USD a year.</p></fieldset>
   ${locked ? "" : '<div class="row sticky-save"><button class="btn p">Save</button><button type="button" class="btn" data-act="tef-import">Import from the filled Excel form</button></div>'}</form>`;
}
FORMS["app-tef"] = async (form, o = {}) => {
  const a = appOf(form.dataset.id), sheet = tefSheet(a), v = clone((a.tef || {}).v || {}), d = {}, errs = [];
  for (const r of TEF_ROWS) {
    const keys = r.pair && sheet === "primary" ? [r.k + "_ll", r.k + "_dev"] : [r.k];
    for (const key of keys) { const arr = []; for (let y = 0; y < 10; y++) { const x = form.querySelector(`[name="v.${key}.${y}"]`); try { arr[y] = cleanNum(x && x.value, `${r.l}, year ${y + 1}`); } catch (e) { errs.push(e); } if (r.int && arr[y] != null && arr[y] % 1) errs.push(`${r.l}, year ${y + 1}: use a whole number.`); } v[key] = arr; }
    if (r.det) { const pv = form.querySelector(`[name="d.${r.k}.provider"]`), dr = form.querySelector(`[name="d.${r.k}.docref"]`); d[r.k] = { provider: pv ? pv.value.trim() || null : null, docref: dr ? dr.value.trim() || null : null }; }
  }
  if (errs.length) throw errs.slice(0, 6);
  const tef = Object.assign({}, a.tef || {}, { v, d, year1: (form.querySelector('[name="year1"]') || {}).value || null });
  if (JSON.stringify(tef) === JSON.stringify(a.tef || {})) { if (!o.silent) toast("No changes to save.", "info"); UI.typing = false; return; }
  await saveApp(a, { tef }, "Projections (Technical Evaluation Form)", [{ label: "Projections", old: null, new: "updated" }]); UI.typing = false; if (!o.silent) { toast("Saved."); render(); }
};
/* Read a Technical Evaluation Form that was filled in Excel */
ACTIONS["tef-import"] = () => openModal(`<h2>Import the Technical Evaluation Form</h2><p>Choose the Commission's Excel form after filling it in. The figures replace what is on this screen; nothing is saved until you press Save.</p><label class="btn p">Choose file<input type="file" accept=".xlsx" data-change="tef-file" hidden></label>`);
CHANGES["tef-file"] = async el => {
  const file = el.files && el.files[0]; if (!file) return; const a = currentApp(), sheet = tefSheet(a), X = await libs.xlsx();
  const wb = X.read(await file.arrayBuffer(), { type: "array" }), ws = wb.Sheets[sheet === "primary" ? "Primary BSI-Only" : "AP Only & Secondary BSI"];
  if (!ws) throw ["This file doesn't have the expected sheet. Use the Commission's Technical Evaluation Form."];
  closeModal(); let n = 0;
  const col = i => X.utils.encode_col(i);
  for (const r of TEF_ROWS) {
    const row = sheet === "primary" ? r.s2 : r.s1;
    const put = (key, c0, step) => { for (let y = 0; y < 10; y++) { const cell = ws[col(c0 + y * step) + row], i = document.querySelector(`[name="v.${key}.${y}"]`); if (i) { i.value = cell && cell.v !== "" && typeof cell.v === "number" ? cell.v : ""; if (cell && typeof cell.v === "number") n++; } } };
    if (r.pair && sheet === "primary") { put(r.k + "_ll", 6, 2); put(r.k + "_dev", 7, 2); }
    else if (sheet === "primary" && r.ccy === "LKR") put(r.k, 6, 2); else put(r.k, 6, 1);
    if (r.det) { const pv = document.querySelector(`[name="d.${r.k}.provider"]`), dr = document.querySelector(`[name="d.${r.k}.docref"]`); if (pv && ws["C" + row]) pv.value = ws["C" + row].v; if (dr && ws["D" + row]) dr.value = ws["D" + row].v; }
  }
  UI.typing = true; toast(`${n} figures read. Check them, then press Save.`, "info");
};

/* ---------- business profile form ---------- */
const ENTITY_TYPES = ["Applicant", "Parent", "Subsidiary", "Branch", "Affiliate"];
function appProfileStep(a) {
  const locked = !canLic() || appLocked(a), p = a.prof || {}, ents = p.entities || [], n = Math.max(3, ents.length + 1), par = p.parent || {};
  const kmp = appPeople("app_id", a.id).filter(x => hasRole(x, "kmp")), miss = stepMissing(a, "profile");
  const inp = (name, val, lab, area) => area ? `<textarea name="${name}" rows="2"${locked ? " disabled" : ""} aria-label="${esc(lab)}">${esc(val ?? "")}</textarea>` : `<input name="${name}" value="${esc(val ?? "")}"${locked ? " disabled" : ""} aria-label="${esc(lab)}">`;
  const fl = (k, lab, help, area) => `<div class="fld${area ? " wide" : ""}"><label>${esc(lab)}</label>${inp("prof." + k, p[k], lab, area)}${help ? `<span class="help">${esc(help)}</span>` : ""}</div>`;
  return `<div class="card"><h2>Business profile</h2><p class="muted small">The Commission's 'Business Profile and Key Management Personnel Information' form. Part 1 is about the applicant; Part 2 about the parent or another associated entity. ${miss.length ? `<span class="badge warn">${miss.length} to do</span>` : '<span class="badge ok">complete</span>'}</p></div>
  <form class="f" data-form="app-prof" data-id="${a.id}" data-autosave="1" novalidate>
   <fieldset><legend>Part 1: the applicant</legend><div class="grid2">${fl("sectors", "Business sectors", "e.g. Information Technology / Business Process Outsourcing")}${fl("years_exp", "Years of experience in the relevant business sectors", "e.g. Information Technology - 2 years / Business Process Outsourcing - 3 years")}</div>
    <h4>Global presence: jurisdictions of operation and corporate structure</h4><div class="tw"><table class="t small rowsin"><thead><tr><th>Entity name</th><th>Country</th><th>Type</th><th>Years of operation</th></tr></thead><tbody>
    ${Array.from({ length: n }, (_, i) => { const e = ents[i] || {}; return `<tr><td>${inp(`prof.entities.${i}.name`, e.name, "Entity name")}</td><td>${inp(`prof.entities.${i}.country`, e.country, "Country")}</td><td><select name="prof.entities.${i}.type"${locked ? " disabled" : ""} aria-label="Type"><option value="">—</option>${ENTITY_TYPES.map(t => `<option${t === e.type ? " selected" : ""}>${t}</option>`).join("")}</select></td><td>${inp(`prof.entities.${i}.years`, e.years, "Years")}</td></tr>`; }).join("")}</tbody></table></div>
    <p class="help">The 'certificate of incorporation attached' box is ticked from the Documents list. Save to get another empty row.</p>
    <h4>Clientele profile</h4><div class="grid2">${fl("countries", "Countries served (main countries of clients)", "", true)}${fl("segments", "Target segments (corporate, SME, individual etc.)", "", true)}${fl("client_sectors", "Industry / business sectors of clients", "", true)}</div>
    <h4>Key management personnel of the Port City operation</h4>${kmp.length ? `<div class="tw"><table class="t small"><thead><tr><th>Name</th><th>Designation</th><th class="num">Years in the sector</th><th>CV</th></tr></thead><tbody>${kmp.map(k => { const cv = ((a.checklist || {})["cvs:" + k.id] || {}).status; return `<tr><td>${esc(k.name)}</td><td>${esc(k.designation_pc || "")}</td><td class="num">${k.years_sector ?? ""}</td><td>${badge(cv || "Not started")}</td></tr>`; }).join("")}</tbody></table></div>` : ""}<p class="help">Taken from People (role: key management personnel). The form has five rows.</p></fieldset>
   <fieldset><legend>Part 2: parent company or other associated entity</legend><div class="grid2">
    <div class="fld"><label>Business sectors</label>${inp("prof.parent.sectors", par.sectors, "Parent business sectors")}</div><div class="fld"><label>Years of experience in the relevant sectors</label>${inp("prof.parent.years_exp", par.years_exp, "Parent years of experience")}</div>
    <div class="fld"><label>Total employees (global headcount)</label>${inp("prof.parent.employees", par.employees, "Parent employees")}</div>
    <div class="fld wide"><label>Countries served</label>${inp("prof.parent.countries", par.countries, "Parent countries", true)}</div><div class="fld wide"><label>Target segments</label>${inp("prof.parent.segments", par.segments, "Parent segments", true)}</div>
    <div class="fld wide"><label>Industry / business sectors of clients</label>${inp("prof.parent.client_sectors", par.client_sectors, "Parent client sectors", true)}</div></div><p class="help">Leave Part 2 blank if there is no parent or associated entity, and say so in the cover note.</p></fieldset>
   ${locked ? "" : '<div class="row sticky-save"><button class="btn p">Save</button></div>'}</form>`;
}
FORMS["app-prof"] = async (form, o = {}) => {
  const a = appOf(form.dataset.id), prof = clone(a.prof || {});
  form.querySelectorAll('[name^="prof."]').forEach(i => { if (!i.disabled) setPath({ prof }, i.name, i.value.trim() || null); });
  prof.entities = (prof.entities || []).filter(e => e && (e.name || e.country || e.type || e.years));
  if (JSON.stringify(prof) === JSON.stringify(a.prof || {})) { if (!o.silent) toast("No changes to save.", "info"); UI.typing = false; return; }
  await saveApp(a, { prof }, "Business profile", [{ label: "Business profile", old: null, new: "updated" }]); UI.typing = false; if (!o.silent) { toast("Saved."); render(); }
};

/* ---------- declarations ---------- */
function appDeclStep(a) {
  const locked = !canLic() || appLocked(a), d = a.decl || {}, pr = d.presenter || {}, dirs = appPeople("app_id", a.id).filter(p => hasRole(p, "dir")), ubo = Store.list("ubo"), miss = stepMissing(a, "declarations");
  const inp = (name, val, lab, list) => `<input name="${name}" value="${esc(val ?? "")}"${locked ? " disabled" : ""} aria-label="${esc(lab)}"${list ? ` list="${list}"` : ""}>`;
  return `<div class="card"><h2>Declarations</h2><p class="muted small">Details for the AP Declaration and the UBO Declaration. The system fills in names and addresses only; the people concerned read, sign and date the declarations themselves. ${miss.length ? `<span class="badge warn">${miss.length} to do</span>` : '<span class="badge ok">complete</span>'}</p></div>
  <form class="f" data-form="app-decl" data-id="${a.id}" data-autosave="1" novalidate>
   <fieldset><legend>AP Declaration ${refChip("AP Declaration (prescribed format)")}</legend>
    <p class="small">Applicant: <b>${esc(getPath(a, "p1.name") || "—")}</b> of ${esc((getPath(a, "p1.address") || "—").replace(/\n/g, ", "))} <span class="muted">(from the Applicant step)</span></p>
    <div class="grid2"><div class="fld"><label>Director signing (1)</label>${inp("decl.director1", d.director1, "Director 1", "dirlist")}</div><div class="fld"><label>Director signing (2)</label>${inp("decl.director2", d.director2, "Director 2", "dirlist")}<span class="help">The form has space for two directors. Leave blank if only one signs.</span></div></div>
    <datalist id="dirlist">${dirs.map(p => `<option>${esc(p.name)}</option>`).join("")}</datalist>
    ${(a.q || {}).group_sl === "Yes" ? `<h4>Annexure I - Declaration of Parent</h4><p class="help">Needed because you said a group company has business in Sri Lanka outside Port City (clause (d)).</p><div class="grid2"><div class="fld"><label>Parent company name</label>${inp("decl.parent_name", d.parent_name, "Parent name")}</div><div class="fld wide"><label>Parent company address</label><textarea name="decl.parent_address" rows="2"${locked ? " disabled" : ""}>${esc(d.parent_address || "")}</textarea></div></div>` : `<p class="help">Annexure I (Declaration of Parent) is needed only if a group company has business in Sri Lanka outside Port City. You answered '${esc((a.q || {}).group_sl || "not yet")}' on the Applicant step.</p>`}
    <p class="note small">The declaration includes undertakings (for example, not to relocate Sri Lankan business into Port City without approval and not to carry on gambling). Breach leads to cancellation. Have it reviewed before signing.</p></fieldset>
   <fieldset><legend>UBO Declaration ${refChip("UBO Declaration (prescribed format)")}</legend>
    <p class="small">One declaration is prepared for each beneficial owner recorded in Company Profile. ${ubo.length ? `${ubo.length} recorded: ${ubo.map(u => esc(Store.canSee("ubo") ? u.full_name : "Restricted")).join(", ")}.` : '<span class="badge warn">None recorded</span>'} <a href="#" data-act="nav" data-section="company">Open Company Profile</a></p>
    <h4>Presented by</h4><div class="grid2"><div class="fld"><label>Full name</label>${inp("decl.presenter.name", pr.name, "Presenter name")}</div><div class="fld"><label>Designation / capacity (director or secretary)</label>${inp("decl.presenter.capacity", pr.capacity, "Presenter capacity")}</div>
     <div class="fld"><label>Email address</label>${inp("decl.presenter.email", pr.email, "Presenter email")}</div><div class="fld"><label>Telephone no.</label>${inp("decl.presenter.tel", pr.tel, "Presenter telephone")}</div><div class="fld"><label>Mobile no.</label>${inp("decl.presenter.mobile", pr.mobile, "Presenter mobile")}</div>
     <div class="fld wide"><label>Address</label><textarea name="decl.presenter.address" rows="2"${locked ? " disabled" : ""}>${esc(pr.address || "")}</textarea></div></div></fieldset>
   ${locked ? "" : '<div class="row sticky-save"><button class="btn p">Save</button></div>'}</form>`;
}
FORMS["app-decl"] = async (form, o = {}) => {
  const a = appOf(form.dataset.id), decl = clone(a.decl || {});
  form.querySelectorAll('[name^="decl."]').forEach(i => { if (!i.disabled) setPath({ decl }, i.name, i.value.trim() || null); });
  if (JSON.stringify(decl) === JSON.stringify(a.decl || {})) { if (!o.silent) toast("No changes to save.", "info"); UI.typing = false; return; }
  await saveApp(a, { decl }, "Declarations", [{ label: "Declaration details", old: null, new: "updated" }]); UI.typing = false; if (!o.silent) { toast("Saved."); render(); }
};

/* ---------- supporting documents ---------- */
function appChecklistStep(a) {
  const rows = checklistRows(a), locked = !canLic() || appLocked(a), docs = Store.list("docs").filter(docVisible).sort((x, y) => x.title.localeCompare(y.title));
  const by = {}; rows.forEach(r => (by[r.it.k] = by[r.it.k] || []).push(r));
  const old = rows.filter(r => r.warn.some(x => /30 days/.test(x)));
  return `<div class="card"><h2>Supporting documents</h2><p class="muted small">The Commission's list of required documents, with Schedule I Part VII. Items that don't apply to this applicant (from your answers on the Applicant and Business steps) are left out. Lines marked <span class="chip">Quayzen can prepare</span> can be filled or drafted from what you entered.</p>
   <p class="small">Certified copies must be certified within 30 days before submission. ${a.planned_date ? `Checked against the planned submission date, ${fmtDate(a.planned_date)}.` : "Set a planned submission date on the Applicant step to check this."}</p></div>
  ${hlCards([{ value: `${rows.filter(r => r.done).length} of ${rows.length}`, label: "Ready or not applicable" }, { value: rows.filter(r => r.status === "Not started").length, label: "Not started", kind: "warn" },
    { value: old.length, label: "Certified more than 30 days before submission", kind: old.length ? "bad" : "" }, { value: rows.filter(r => r.e.doc_id).length, label: "Linked to a stored document" }])}
  <div class="tw"><table class="t cl"><thead><tr><th>Document</th><th>Status</th><th>Certified on</th><th>Stored document</th><th>Note</th></tr></thead><tbody>
  ${Object.values(by).map(rs => rs.map((r, i) => `<tr class="${r.done ? "ok" : ""}">
    <td>${i === 0 ? `<b>${esc(r.it.t)}</b><div class="small muted">${esc(r.it.src)}</div>${r.it.help ? `<div class="small">${esc(r.it.help)}</div>` : ""}${r.it.gen ? `<div><span class="chip">Quayzen can prepare</span> <button class="link small" data-act="app-go" data-step="forms">Go to Forms and downloads</button></div>` : ""}` : ""}${r.who ? `<div class="who">${esc(r.who)}</div>` : ""}${r.warn.map(x => `<div class="small wt">${esc(x)}</div>`).join("")}</td>
    <td><select data-change="cl-set" data-k="${esc(r.key)}" data-f="status"${locked ? " disabled" : ""} aria-label="Status">${CL_STATUS.map(s => `<option${s === r.status ? " selected" : ""}>${s}</option>`).join("")}</select></td>
    <td>${r.it.cert30 ? `<input type="date" value="${esc(r.e.cert_date || "")}" data-change="cl-set" data-k="${esc(r.key)}" data-f="cert_date"${locked ? " disabled" : ""} aria-label="Certified on">` : '<span class="muted small">—</span>'}</td>
    <td><select data-change="cl-set" data-k="${esc(r.key)}" data-f="doc_id"${locked ? " disabled" : ""} aria-label="Stored document"><option value="">—</option>${docs.map(d => `<option value="${d.id}"${d.id === r.e.doc_id ? " selected" : ""}>${esc(d.title.slice(0, 50))}</option>`).join("")}</select>${r.e.doc_id ? ` <a href="#" class="small" data-act="doc-open" data-id="${r.e.doc_id}">open</a>` : ""}</td>
    <td><input value="${esc(r.e.note || "")}" data-change="cl-set" data-k="${esc(r.key)}" data-f="note"${locked ? " disabled" : ""} placeholder="${r.status === "Not applicable" ? "Why it doesn't apply" : ""}" aria-label="Note"></td></tr>`).join("")).join("")}</tbody></table></div>
  ${Store.can("documents", "write") ? `<p class="small"><button class="btn sm" data-act="doc-new" data-link-type="apps" data-link-id="${a.id}">Add a document to the Documents register</button> <span class="muted">Then choose it in the 'Stored document' column. Word and Excel files must be saved as PDF first.</span></p>` : ""}`;
}
CHANGES["cl-set"] = async el => {
  const a = currentApp(), k = el.dataset.k, f = el.dataset.f, checklist = clone(a.checklist || {}), e = checklist[k] = checklist[k] || {}, old = e[f] ?? null;
  e[f] = el.value || null; e.updated_at = nowIso(); e.updated_by = Store.uid;
  const it = CHECKLIST.find(x => x.k === k.split(":")[0]);
  await saveApp(a, { checklist }, `Documents: ${it ? it.t.slice(0, 50) : k}`, [{ label: `${it ? it.t.slice(0, 60) : k} - ${{ status: "status", cert_date: "certified on", doc_id: "stored document", note: "note" }[f]}`, old, new: e[f] }]);
};

/* ---------- history ---------- */
function appHistoryStep(a) {
  const ids = new Set(appPeople("app_id", a.id).map(p => p.id).concat(Store.list("app_people", { archived: true }).filter(p => p.app_id === a.id).map(p => p.id)));
  const hist = Store.history().filter(h => (h.entity === "apps" && h.rec === a.id) || (h.entity === "app_people" && ids.has(h.rec)) || (h.entity === "snapshots" && h.summary && h.summary.includes(a.title)));
  const snaps = Store.list("snapshots").filter(s => s.app_id === a.id).sort((x, y) => y.version_no - x.version_no);
  return `<div class="cols"><div class="card"><h3>Status</h3><ul class="tl">${(a.events || []).slice().reverse().map(e => `<li><b>${esc(e.status)}</b> <span class="muted small">${esc(e.at)} · ${esc(Store.name(e.by))}</span>${e.date ? `<div class="small">Date: ${fmtDate(e.date)}${e.ref ? " · ref " + esc(e.ref) : ""}</div>` : ""}${e.note ? `<div class="small">${esc(e.note)}</div>` : ""}</li>`).join("")}</ul></div>
   <div class="card"><h3>Approved versions</h3>${snaps.map(s => `<div class="li"><b>Version ${s.version_no}</b> approved by ${esc(Store.name(s.approved_by))} on ${fmtDate(s.approved_at)}<div class="small muted mono">SHA-256 ${esc((s.hash || "").slice(0, 24))}…</div></div>`).join("") || '<p class="muted">None yet. A version is kept each time a second person approves the application.</p>'}</div></div>
   <div class="card"><h3>Change history</h3>${historyHTML(hist)}</div>`;
}

/* ---------- workflow ---------- */
const STATUS_FIELDS = {
  [APP_STATUS.submitted]: [["date", "Date submitted", "date", true], ["method", "How it was submitted", ["Commission portal", "Email to applications@portcity.gov.lk", "By hand to the Commission", "Other"], true], ["ref", "Reference or application number"], ["note", "Notes", "area"]],
  [APP_STATUS.info]: [["date", "Date of the Commission's request", "date", true], ["note", "What the Commission asked for", "area", true], ["log", "Also log it under Commission Requests", "check"]],
  [APP_STATUS.aip]: [["date", "Date of the Approval in Principle letter", "date", true], ["ref", "Letter reference"], ["conditions", "Conditions stated in the letter (one per line)", "area"]],
  [APP_STATUS.clear]: [["date", "Date", "date"], ["note", "Notes", "area"]],
  [APP_STATUS.issued]: [["licence_number", "Licence number", "text", true], ["date", "Licence issue date", "date", true], ["expiry", "Licence expiry date", "date", false, "Usually 12 months. Left blank, it is set to one day short of 12 months after the issue date."], ["agreement", "Investor Agreement signed on", "date"], ["cert_reg", "Certificate of Registration number (offshore companies)"], ["conditions", "Conditions stated in the licence or agreement (one per line)", "area"]],
  [APP_STATUS.ready]: [["note", "Note for the reviewer", "area"]],
  [APP_STATUS.prep]: [["note", "Reason", "area"]],
  [APP_STATUS.withdrawn]: [["date", "Date", "date", true], ["note", "Reason", "area"]],
  [APP_STATUS.rejected]: [["date", "Date", "date", true], ["ref", "Letter reference"], ["note", "Reason given", "area"]],
};
ACTIONS["app-status"] = el => {
  const to = el.dataset.to, a = currentApp(), fs = STATUS_FIELDS[to] || [];
  if (to === APP_STATUS.ready) { const R = appReadiness(a); if (!R.ready) UI.readyWarn = `${R.steps.reduce((t, s) => t + s.missing.length, 0)} item(s) are still missing and ${R.docs.total - R.docs.ok} document(s) are not ready.`; else UI.readyWarn = null; }
  openModal(`<h2>${esc(to)}</h2>${to === APP_STATUS.ready && UI.readyWarn ? `<p class="note small">${esc(UI.readyWarn)} You can still send it for review.</p>` : ""}${to === APP_STATUS.submitted ? '<p class="small">Record what you submitted. The system has not sent anything.</p>' : ""}
   <form class="f" data-form="app-status" data-to="${esc(to)}" novalidate>${fs.map(([k, l, t, req, help]) => `<div class="fld"><label for="st_${k}">${esc(l)}${req ? ' <span class="req">*</span>' : ""}</label>${Array.isArray(t) ? `<select id="st_${k}" name="${k}">${t.map(o => `<option>${esc(o)}</option>`).join("")}</select>` : t === "area" ? `<textarea id="st_${k}" name="${k}" rows="3"></textarea>` : t === "check" ? `<label class="radio"><input type="checkbox" id="st_${k}" name="${k}" checked> Yes</label>` : `<input id="st_${k}" name="${k}" type="${t === "date" ? "date" : "text"}"${t === "date" ? ` value="${today()}"` : ""}>`}${help ? `<span class="help">${esc(help)}</span>` : ""}</div>`).join("")}
   <div class="row"><button class="btn p">Save</button><button type="button" class="btn" data-act="modal-close">Cancel</button></div></form>`);
};
FORMS["app-status"] = async form => {
  const to = form.dataset.to, a = currentApp(), o = readForm(form), fs = STATUS_FIELDS[to] || [];
  const miss = fs.filter(f => f[3] && !String(o[f[0]] || "").trim()).map(f => f[1] + " is required."); if (miss.length) throw miss;
  const patch = { status: to }, ev = { at: nowIso(), by: Store.uid, status: to, date: o.date || null, ref: o.ref || o.licence_number || null, note: o.note || o.conditions || null };
  if (to === APP_STATUS.submitted) { if (a.status !== APP_STATUS.approved) throw ["Only an approved application can be recorded as submitted."]; Object.assign(patch, { submitted_date: o.date, submission_method: o.method, submission_ref: o.ref || null }); ev.note = [o.method, o.note].filter(Boolean).join(" - "); }
  if (to === APP_STATUS.aip) Object.assign(patch, { aip_date: o.date, aip_ref: o.ref || null, aip_conditions: o.conditions || null });
  if (to === APP_STATUS.issued) { const exp = o.expiry || addMonthsDay(o.date, 12); Object.assign(patch, { licence_number: o.licence_number.trim(), licence_issue_date: o.date, licence_expiry_date: exp, agreement_date: o.agreement || null, cert_reg: o.cert_reg || null, licence_conditions: o.conditions || null }); }
  if (to === APP_STATUS.info && o.log) {
    const rid_ = await Store.save("requests", { title: `Further information for the licence application`, category: "Licence and approvals", description: o.note, authority: "Colombo Port City Economic Commission", received_date: o.date, status: "New", required_info: o.note });
    await Store.audit("requests", rid_, "Created", "Commission request: further information for the licence application"); ev.note += " (logged under Commission Requests)";
  }
  patch.events = (a.events || []).concat([ev]);
  await Store.save("apps", patch, a.id); await Store.audit("apps", a.id, "Status changed", `${a.title}: ${a.status} → ${to}${ev.ref ? " (" + ev.ref + ")" : ""}`);
  closeModal(); toast(`Recorded: ${to}.`);
  if (to === APP_STATUS.issued) setTimeout(() => ACTIONS["app-setup"](), 50); else render();
};
ACTIONS["app-approve"] = async () => {
  const a = currentApp(); needDifferentPerson(a.updated_by, "approve the application");
  const lastPeople = appPeople("app_id", a.id); const lastEdit = lastPeople.map(p => p.updated_by).filter(Boolean);
  if (Store.setting("separate_reviewer", true) && lastEdit.includes(Store.uid)) throw ["A different person must approve the application. You changed the people details in it."];
  const R = appReadiness(a), gaps = R.steps.reduce((t, s) => t + s.missing.length, 0) + (R.docs.total - R.docs.ok);
  if (gaps && !(await confirmAsk(`${gaps} item(s) are still missing or not ready. Approve anyway? The approval will record this.`))) return;
  const body = { app: Object.assign({}, a), people: lastPeople }, data = JSON.stringify(body), hash = await sha256(data), vno = Store.list("snapshots").filter(s => s.app_id === a.id).length + 1;
  const sid = await Store.save("snapshots", { kind: "application", app_id: a.id, version_no: vno, data, hash, approved_by: Store.uid, approved_at: today(), gaps });
  await Store.save("apps", { status: APP_STATUS.approved, approved_by: Store.uid, approved_at: today(), approved_version: vno, approved_snapshot: sid, events: (a.events || []).concat([{ at: nowIso(), by: Store.uid, status: APP_STATUS.approved, note: `Version ${vno} approved${gaps ? ` with ${gaps} open item(s)` : ""}` }]) }, a.id);
  await Store.audit("apps", a.id, "Approved", `${a.title}: version ${vno} approved for submission (SHA-256 ${hash.slice(0, 12)}…)`); toast("Approved for submission. A fixed copy has been kept."); render();
};

/* ---------- after the licence is issued: set up the compliance records ---------- */
ACTIONS["app-setup"] = () => {
  const a = currentApp(), c = Store.company(), has = { lic: !!c.main_licence_id, people: Store.list("people").length, office: Store.list("offices").length, bp: Store.list("bplans").length };
  const opt = (k, l, on, help) => `<label class="radio"><input type="checkbox" name="${k}"${on ? " checked" : ""}> ${esc(l)}</label>${help ? `<div class="help" style="margin:0 0 8px 24px">${esc(help)}</div>` : ""}`;
  openModal(`<h2>Set up compliance records</h2><p class="small">Copy what the application already holds into the records the rest of Quayzen uses. Choose what to copy; nothing is overwritten without your choice.</p>
   <form class="f" data-form="app-setup" novalidate>
   ${opt("profile", "Update the company profile (name, licence number, designation, address, signatory and contact)", true)}
   ${opt("licence", `Create the licence record (${a.licence_number || "no number"}) and make it the main licence`, !has.lic)}
   ${opt("people", "Add directors and shareholders to the company register", !has.people, "People already in the register with the same name are skipped.")}
   ${opt("office", "Add the proposed office to the office register as planned", !has.office && !!(getPath(a, "p2.loc_within_addr") || getPath(a, "p2.loc_desig_addr")))}
   ${opt("bplan", "Create or update the business plan reference, linked to this application", true, "Ten years of figures from the Projections step, with text and milestones from the Business plan step. Recorded as a projection for comparison, not a commitment. A second person still checks and locks it.")}
   ${opt("conds", "Add the conditions you recorded (Approval in Principle and licence) as obligations", !!(a.aip_conditions || a.licence_conditions), "Each line becomes an obligation with basis 'Stated in our licence, approval or agreement'.")}
   <div class="row"><button class="btn p">Copy now</button><button type="button" class="btn" data-act="modal-close">Not now</button></div></form>`);
};
FORMS["app-setup"] = async form => {
  const o = readForm(form), a = currentApp(), c = Store.company(), done = [], ps = appPeople("app_id", a.id);
  let licId = null;
  if (o.licence) {
    licId = await Store.save("licences", { licence_type: /BSI/.test(a.app_type) ? "BSI designation" : "Authorised Person licence", title: a.app_type === "Authorised Person only" ? "Authorised Person licence" : `${a.app_type} designation`, number: a.licence_number || null, issuing_authority: "Colombo Port City Economic Commission", issue_date: a.licence_issue_date || null, expiry_date: a.licence_expiry_date || null, status: "Active", approved_activities: getPath(a, "p2.description") || null, conditions: a.licence_conditions || null, renewal_notice_days: 60, data_source: "From licence application" });
    await Store.audit("licences", licId, "Created", "Licence record created from the application"); done.push("licence record");
  }
  if (o.profile) {
    const p2 = a.p2 || {}, patch = { stage: "licensed", name: getPath(a, "p1.name") || c.name, licence_number: a.licence_number || c.licence_number || null, register_address: getPath(a, "p1.address") || c.register_address || null,
      designation_type: a.app_type === "Authorised Person only" ? "Authorised Person only" : a.app_type, country_of_incorporation: getPath(a, "p1.country") || c.country_of_incorporation || null, registration_no: getPath(a, "q.reg_no") || c.registration_no || null,
      business_sector: (p2.sectors || []).join(", ") || c.business_sector || null, signatory_name: p2.signatory || c.signatory_name || null, signatory_designation: p2.signatory_designation || c.signatory_designation || null, contact_name: p2.contact || c.contact_name || null,
      contact_email: getPath(a, "p1.email") || c.contact_email || null, contact_phone: getPath(a, "p1.tel") || c.contact_phone || null };
    if (licId) patch.main_licence_id = licId;
    await Store.saveCompany(patch); await Store.audit("companies", Store.cid, "Updated", "Company profile updated from the licence application", diff(COMPANY_DEF, c, Object.assign({}, c, patch))); done.push("company profile");
  } else if (licId) await Store.saveCompany({ main_licence_id: licId, stage: "licensed" });
  if (o.people) {
    const have = new Set(Store.list("people").map(p => (p.full_name || "").toLowerCase())); let n = 0;
    for (const p of ps.filter(p => hasRole(p, "sh") || hasRole(p, "dir"))) {
      if (have.has((p.name || "").toLowerCase())) continue;
      const role = hasRole(p, "sh") && hasRole(p, "dir") ? "Director and shareholder" : hasRole(p, "dir") ? "Director" : "Shareholder";
      const pid = await Store.save("people", { full_name: p.name, person_type: p.kind === "Corporate" ? "Corporate" : "Individual", role, nationality: p.nationality || null, shareholding_pct: p.shareholding_pct ?? null, appointed_date: a.licence_issue_date || null, data_source: "From licence application" });
      await Store.audit("people", pid, "Created", `Director or shareholder: ${p.name} (from the application)`); n++;
    }
    done.push(`${n} people`);
  }
  if (o.office) {
    const inPC = !!getPath(a, "p2.loc_within"), addr = inPC ? getPath(a, "p2.loc_within_addr") : getPath(a, "p2.loc_desig_addr");
    if (addr) { const oid = await Store.save("offices", { name: inPC ? "Port City office" : "Designated location", address: addr, location: inPC ? "Inside Colombo Port City" : "Outside Colombo Port City", designated_status: inPC ? "Not applicable" : "Designation requested", floor_area: getPath(a, "p2.floor_sqm") || 0, area_unit: "sqm", area_sqm: getPath(a, "p2.floor_sqm") || 0, measurement_basis: "Approximate", status: "Planned", data_source: "From licence application" });
      await Store.audit("offices", oid, "Created", "Office added from the licence application"); done.push("office"); }
  }
  if (o.bplan) {
    const T = tefTotals(a), years = Array.from({ length: BP_YEARS }, (_, y) => ({ revenue_usd: tefVal(a, "revenue", y), expenses_usd: tefVal(a, "expenses", y), net_income_usd: tefVal(a, "net_income", y),
      local_employees: T[y].local || null, foreign_employees: T[y].foreign || null, local_remuneration_usd: T[y].rem_local || null, foreign_remuneration_usd: T[y].rem_foreign || null, office_sqm: tefVal(a, "floor", y),
      fdi_usd: T[y].fdi || null, lkr_land_lease: T[y].lkr || null, funding_source: tefVal(a, "fdi_loans", y) && (tefVal(a, "fdi_equity", y) || tefVal(a, "fdi_reinvested", y)) ? "Equity and Debt" : tefVal(a, "fdi_loans", y) ? "Debt" : T[y].fdi ? "Equity" : null }));
    const n = Store.list("bplans").length + 1;
    const bid = await Store.save("bplans", { title: "Business plan submitted with the licence application", version_no: n, status: "Draft", commission_status: BP_COMMISSION[0], commission_date: a.submitted_date || null, commission_ref: a.submission_ref || null, year1_start: (a.tef || {}).year1 || null,
      sections: { activities: getPath(a, "p2.description") || getPath(a, "p6.products"), operating_model: getPath(a, "bp.operating_model"), customers: getPath(a, "p6.target_market"), implementation: getPath(a, "p6.strategy"), projections: getPath(a, "bp.assumptions") }, years, milestones: [], notes: {}, prepared_by: Store.uid, data_source: "From licence application" });
    await Store.audit("bplans", bid, "Created", "Business plan reference created from the application projections"); done.push("business plan (draft, to be checked and locked)");
  }
  if (o.conds) {
    let n = 0;
    for (const [txt, src] of [[a.aip_conditions, `Approval in Principle letter ${a.aip_ref || ""} (${fmtDate(a.aip_date)})`], [a.licence_conditions, `Licence ${a.licence_number || ""} / Investor Agreement`]]) for (const line of String(txt || "").split(/\n+/).map(s => s.trim()).filter(Boolean)) {
      const oid = await Store.save("obligations", { title: line.slice(0, 140), description: line, obligation_type: "Licence condition", basis: "Stated in our licence, approval or agreement", source_document: src.trim(), recurrence: "One-off", status: "Not started", needs_review: "Yes", data_source: "From licence application" });
      await Store.audit("obligations", oid, "Created", `Obligation from the licence application: ${line.slice(0, 60)}`); n++;
    }
    done.push(`${n} obligations`);
  }
  await Store.save("apps", { setup_done: today() }, a.id); await Store.audit("apps", a.id, "Records set up", `Copied: ${done.join(", ") || "nothing"}`);
  closeModal(); toast(done.length ? `Copied: ${done.join(", ")}.` : "Nothing copied.", "ok"); render();
};

