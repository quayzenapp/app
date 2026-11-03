/* ===== x_bpb.js ===== */
/* Business plan builder, inside the licence application.
   The Commission asks for a business plan of at most four pages (PDF) covering activities, operating model, target markets
   and financial projections (Required documents list), and Schedule I Part VI(A) lists what it should include.
   Sections can be switched on or off, renamed, reordered, added and filled from what the application already holds.
   Tables (projections, manpower, funding, ownership, milestones) are built from the application data. Versions can be kept. */

const BPB_TABLES = { none: "No table", projections: "Financial projections (from Projections)", manpower: "Staffing plan (from Projections)", funding: "Investment and funding (from Projections)", ownership: "Ownership (from People)", milestones: "Milestones (edited below)" };
const BPB_TEMPLATE = [
  ["summary", "Executive summary", "none", "A short overview: who the applicant is, what it will do from Port City, the investment and the jobs."],
  ["applicant", "The applicant and its ownership", "ownership", "Company, group structure and owners."],
  ["activities", "Business activities and services", "none", "Required: proposed business activities (Required documents; Schedule I Part VI(a)-(b))."],
  ["operating", "Operating model", "none", "Required: how the business will operate."],
  ["markets", "Target markets and customers", "none", "Required: target markets (Schedule I Part VI(c))."],
  ["implementation", "Implementation plan and milestones", "milestones", "Schedule I Part VI(d): the approach to put the objectives into practice."],
  ["staffing", "Staffing plan", "manpower", "Local and foreign staff, and remuneration."],
  ["office", "Office and location", "none", "Where the business will operate from, and the space needed."],
  ["funding", "Investment and funding", "funding", "How the investment will be funded."],
  ["financials", "Financial projections", "projections", "Required: financial projections, with the main assumptions."],
  ["controls", "Risks, internal policies and controls", "none", "Schedule I Part VI(e)."],
];
const bpbId = () => "s" + Math.random().toString(36).slice(2, 7);
function bpbDefault(a) { return { sections: BPB_TEMPLATE.map(([key, title, table]) => ({ id: bpbId(), key, title, table, on: true, body: bpbSuggest(a, key) })), milestones: [], versions: [] }; }
const bpbOf = a => a.bpb && a.bpb.sections ? a.bpb : bpbDefault(a);
/* Text suggested from the application for each standard section */
function bpbSuggest(a, key) {
  const g = k => getPath(a, k), ps = appPeople("app_id", a.id), T = tefTotals(a), name = g("p1.name") || "The applicant";
  const fdi = T.reduce((t, y) => t + y.fdi, 0), y5 = T[4] || {}, ents = ((a.prof || {}).entities || []).filter(e => e.name && e.type !== "Applicant");
  const sh = ps.filter(p => hasRole(p, "sh")).map(p => `${p.name}${p.shareholding_pct != null ? ` (${fmtNum(p.shareholding_pct)}%)` : ""}`);
  const join = (...x) => x.filter(Boolean).join("\n\n");
  switch (key) {
    case "summary": return join(`${name} is applying to the Colombo Port City Economic Commission for ${a.app_type === "Authorised Person only" ? "an Authorised Person licence" : a.app_type + " designation"}.`, g("p6.objective"), fdi ? `The plan is to invest about USD ${fmtK(fdi)} over ten years${y5.staff ? ` and employ ${y5.staff} people by year 5 (${y5.local} local)` : ""}.` : "");
    case "applicant": return join(`${name} is a ${(a.legal || "").toLowerCase()} ${g("p1.country") ? "incorporated or registered in " + g("p1.country") : ""}.`, sh.length ? `Owners: ${sh.join("; ")}.` : "", ents.length ? `Group and associated entities: ${ents.map(e => `${e.name} (${e.type}${e.country ? ", " + e.country : ""}${e.years ? ", " + e.years + " years" : ""})`).join("; ")}.` : "", (a.prof || {}).years_exp ? `Experience: ${a.prof.years_exp}.` : "");
    case "activities": return join(g("p2.description"), g("p6.products") ? "Products and services: " + g("p6.products") : "", (g("p2.sectors") || []).length ? `Sectors: ${g("p2.sectors").join(", ")}.` : "");
    case "operating": return join(g("bp.operating_model"));
    case "markets": return join(g("p6.target_market"), (a.prof || {}).countries ? "Main countries served: " + a.prof.countries + "." : "", (a.prof || {}).segments ? "Customer segments: " + a.prof.segments + "." : "", (a.prof || {}).client_sectors ? "Client sectors: " + a.prof.client_sectors + "." : "");
    case "implementation": return join(g("p6.strategy"));
    case "staffing": return T[0].staff ? `In year 1 the business expects ${T[0].staff} staff (${T[0].local} local, ${T[0].foreign} foreign), rising to ${y5.staff || "-"} by year 5. The table shows the plan at the end of each year.` : "";
    case "office": { const addr = g("p2.loc_within") ? oneLine(g("p2.loc_within_addr")) : oneLine(g("p2.loc_desig_addr")); return addr ? `The proposed office is at ${addr}${g("p2.floor_sqm") ? `, about ${fmtNum(g("p2.floor_sqm"))} square metres` : ""}${g("p2.loc_desig") ? ", a designated location under section 64 of the Act" : ", within the Area of Authority of the Colombo Port City"}.` : ""; }
    case "funding": { const det = TEF_ROWS.filter(r => r.det).map(r => (((a.tef || {}).d || {})[r.k] || {}).provider).filter(Boolean); return join(fdi ? `Total proposed foreign direct investment over ten years: USD ${fmtNum(r2(fdi))}.` : "", g("p2.fdi_source") ? "Source of funds: " + g("p2.fdi_source") + "." : "", det.length ? "Funding providers: " + [...new Set(det)].join("; ") + "." : ""); }
    case "financials": return join("The table shows the ten-year projections from the Technical Evaluation Form (USD). These are projections, not commitments.", g("bp.assumptions") ? "Main assumptions: " + g("bp.assumptions") : "");
    case "controls": return join(g("p6.controls"));
    default: return "";
  }
}
function bpbTableBlock(a, kind, b) {
  const yrs = Array.from({ length: 10 }, (_, i) => i), T = tefTotals(a), fx = v => v == null || v === 0 ? "" : fmtK(v);
  if (kind === "projections") return { table: { cols: ["USD", ...yrs.map(y => "Y" + (y + 1))], rows: [["Revenue", ...yrs.map(y => fx(tefVal(a, "revenue", y)))], ["Expenses", ...yrs.map(y => fx(tefVal(a, "expenses", y)))], ["Net income", ...yrs.map(y => fx(tefVal(a, "net_income", y)))]] } };
  if (kind === "manpower") return { table: { cols: ["At year end", ...yrs.map(y => "Y" + (y + 1))], rows: [["Local staff", ...yrs.map(y => T[y].local || "")], ["Foreign staff", ...yrs.map(y => T[y].foreign || "")], ["Remuneration (USD)", ...yrs.map(y => fx(T[y].rem_local + T[y].rem_foreign))], ["Office space (sqm)", ...yrs.map(y => fx(tefVal(a, "floor", y)))]] } };
  if (kind === "funding") return { table: { cols: ["Funding", ...yrs.map(y => "Y" + (y + 1)), "Total"], rows: [["FDI (USD)", ...yrs.map(y => fx(T[y].fdi)), fx(T.reduce((t, y) => t + y.fdi, 0))], ["Other USD", ...yrs.map(y => fx(T[y].usd_other)), fx(T.reduce((t, y) => t + y.usd_other, 0))], ["LKR (LKR)", ...yrs.map(y => fx(T[y].lkr)), fx(T.reduce((t, y) => t + y.lkr, 0))]] } };
  if (kind === "ownership") { const ps = appPeople("app_id", a.id).filter(p => hasRole(p, "sh")); return ps.length ? { table: { cols: ["Owner", "Country", "%"], rows: ps.map(p => [p.name, p.nationality || "", p.shareholding_pct != null ? fmtNum(p.shareholding_pct) : ""]) } } : null; }
  if (kind === "milestones") { const ms = (b.milestones || []).filter(m => m.m); return ms.length ? { table: { cols: ["Milestone", "Target date"], rows: ms.map(m => [m.m, fmtDate(m.date) || m.date || ""]) } } : null; }
  return null;
}
function bpbModel(a) {
  const b = bpbOf(a), blocks = [];
  b.sections.filter(s => s.on).forEach((s, i) => { blocks.push({ h: `${i + 1}. ${s.title}` }); if (s.body) blocks.push({ p: s.body }); const t = bpbTableBlock(a, s.table, b); if (t) blocks.push(t); });
  return { title: `Business plan - ${getPath(a, "p1.name") || Store.company().name}`, subtitle: `Application to the Colombo Port City Economic Commission for ${a.app_type === "Authorised Person only" ? "an Authorised Person licence" : a.app_type}${b.date ? " · " + fmtDate(b.date) : ""}`, blocks, footer: `Business plan - ${getPath(a, "p1.name") || ""}` };
}
/* A rough page estimate while editing; the exact count comes from the PDF */
function bpbPages(a) { const b = bpbOf(a); let lines = 6; b.sections.filter(s => s.on).forEach(s => { lines += 2 + String(s.body || "").split(/\n/).reduce((t, p) => t + Math.max(1, Math.ceil(p.length / 95)), 0); const t = bpbTableBlock(a, s.table, b); if (t) lines += 2 + t.table.rows.length * 1.3; }); return Math.max(1, Math.round(lines / 52 * 10) / 10); }

APP_STEPS.splice(APP_STEPS.findIndex(s => s[0] === "projections") + 1, 0, ["bplan", "Business plan"]);
const _stepMissing = stepMissing;
stepMissing = function (a, step) {
  if (step !== "bplan") return _stepMissing(a, step);
  const b = bpbOf(a), on = b.sections.filter(s => s.on), out = [];
  if (!a.bpb) out.push("Open the builder and save the plan");
  on.filter(s => ["activities", "operating", "markets", "financials"].includes(s.key) && !String(s.body || "").trim()).forEach(s => out.push(`${s.title}: no text yet`));
  if (["activities", "operating", "markets", "financials"].some(k => !on.find(s => s.key === k))) out.push("A required section is switched off (activities, operating model, target markets or financial projections)");
  if ((b.pages_pdf || bpbPages(a)) > 4) out.push("Longer than four pages");
  return out;
};

function bpbStep(a) {
  const b = bpbOf(a), locked = !canLic() || appLocked(a), est = bpbPages(a), miss = stepMissing(a, "bplan"), dis = locked ? " disabled" : "";
  const sec = (s, i, n) => `<div class="card bps${s.on ? "" : " off"}" data-sid="${s.id}">
    <div class="row bpsh"><span class="bpno">${i + 1}</span><input name="t.${s.id}" value="${esc(s.title)}"${dis} aria-label="Section title" class="bpt">
     <label class="radio small"><input type="checkbox" name="on.${s.id}"${s.on ? " checked" : ""}${dis}> Include</label>
     ${locked ? "" : `<span class="bpbtns"><button type="button" class="mk" data-act="bpb" data-op="up" data-sid="${s.id}"${i ? "" : " disabled"} title="Move up">↑</button><button type="button" class="mk" data-act="bpb" data-op="down" data-sid="${s.id}"${i < n - 1 ? "" : " disabled"} title="Move down">↓</button>${s.key ? `<button type="button" class="mk" data-act="bpb" data-op="fill" data-sid="${s.id}" title="Replace the text with a draft from the application">Fill from application</button>` : `<button type="button" class="mk" data-act="bpb" data-op="del" data-sid="${s.id}">Remove</button>`}</span>`}</div>
    ${s.key ? `<p class="help">${esc((BPB_TEMPLATE.find(x => x[0] === s.key) || [])[3] || "")}</p>` : ""}
    <textarea name="b.${s.id}" rows="${Math.min(14, Math.max(4, Math.ceil(String(s.body || "").length / 90) + 1))}"${dis} aria-label="Section text">${esc(s.body || "")}</textarea>
    <div class="row small"><label>Table: <select name="tb.${s.id}"${dis}>${Object.entries(BPB_TABLES).map(([k, l]) => `<option value="${k}"${k === s.table ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label><span class="muted">${esc(String(s.body || "").length)} characters</span></div></div>`;
  const ms = Array.from({ length: Math.max(3, (b.milestones || []).length + 1) }, (_, i) => (b.milestones || [])[i] || {});
  const prev = bpbModel(a);
  return `<div class="card"><h2>Business plan builder</h2><p class="muted small">The Commission asks for a business plan of no more than four pages (PDF) covering the proposed activities, operating model, target markets and financial projections. Start from the standard sections below; each can be filled from what you entered elsewhere, edited, switched off, moved, or added to. Tables are built from your projections and people.</p>
   ${hlCards([{ value: b.pages_pdf ? `${b.pages_pdf} page(s)` : `about ${est}`, label: b.pages_pdf ? "Last PDF" : "Estimated pages", kind: (b.pages_pdf || est) > 4 ? "bad" : "", sub: (b.pages_pdf || est) > 4 ? "over the four-page limit" : "limit: 4 pages" }, { value: b.sections.filter(s => s.on).length, label: "Sections included" }, { value: (b.versions || []).length, label: "Saved versions" }, { value: miss.length, label: "To do", kind: miss.length ? "warn" : "" }])}
   ${miss.length ? `<p class="small"><span class="badge warn">to do</span> ${esc(miss.join("; "))}</p>` : ""}
   <div class="row">${fmtButtons("bpb-dl", `data-id="${a.id}"`, ["docx", "pdf"], null)}${locked ? "" : `<button class="btn sm" data-act="bpb-version">Save as a version</button><button class="btn sm" data-act="bpb" data-op="reset">Start again from the template</button>`}</div></div>
  <div class="bpgrid"><form class="f" data-form="bpb" data-id="${a.id}" data-autosave="1" novalidate>
   <div class="card"><div class="grid2"><div class="fld"><label>Plan date (optional)</label><input type="date" name="date" value="${esc(b.date || "")}"${dis}></div></div></div>
   ${b.sections.map((s, i) => sec(s, i, b.sections.length)).join("")}
   <div class="card"><h3>Milestones</h3><p class="help">Shown in any section whose table is set to Milestones.</p><div class="tw"><table class="t small rowsin"><thead><tr><th>Milestone</th><th>Target date</th></tr></thead><tbody>${ms.map((m, i) => `<tr><td><input name="ms.${i}.m" value="${esc(m.m || "")}"${dis} aria-label="Milestone ${i + 1}"></td><td><input type="date" name="ms.${i}.date" value="${esc(m.date || "")}"${dis} aria-label="Target date ${i + 1}"></td></tr>`).join("")}</tbody></table></div></div>
   ${locked ? "" : '<div class="row sticky-save"><button class="btn p">Save</button><button type="button" class="btn" data-act="bpb" data-op="add">Add a section</button></div>'}</form>
   <div class="bpprev card"><h3>Preview</h3><div class="bpdoc"><h2>${esc(prev.title)}</h2><p class="muted small">${esc(prev.subtitle)}</p>${prev.blocks.map(x => x.h ? `<h4>${esc(x.h)}</h4>` : x.p != null ? x.p.split(/\n{2,}/).map(t => `<p>${esc(t).replace(/\n/g, "<br>")}</p>`).join("") : x.table ? `<div class="tw"><table class="t small"><thead><tr>${x.table.cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${x.table.rows.map(r => `<tr>${r.map(c => `<td>${esc(mText(c))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "").join("")}</div>
    ${(b.versions || []).length ? `<h3>Saved versions</h3>${b.versions.slice().reverse().map(v => `<div class="li small"><b>v${v.no}</b> ${esc(v.label || "")} <span class="muted">${esc(v.at)} · ${esc(Store.name(v.by))}</span> ${locked ? "" : `<button class="link small" data-act="bpb-restore" data-no="${v.no}">Restore</button>`}</div>`).join("")}` : ""}</div></div>`;
}
function bpbRead(form, a) {
  const b = clone(bpbOf(a));
  b.sections.forEach(s => { const t = form.querySelector(`[name="t.${s.id}"]`), on = form.querySelector(`[name="on.${s.id}"]`), x = form.querySelector(`[name="b.${s.id}"]`), tb = form.querySelector(`[name="tb.${s.id}"]`);
    if (t) s.title = t.value.trim() || s.title; if (on) s.on = on.checked; if (x) s.body = x.value; if (tb) s.table = tb.value; });
  const ms = []; for (let i = 0; i < 40; i++) { const m = form.querySelector(`[name="ms.${i}.m"]`); if (!m) break; const d = form.querySelector(`[name="ms.${i}.date"]`); if (m.value.trim()) ms.push({ m: m.value.trim(), date: d ? d.value || null : null }); }
  b.milestones = ms; const dt = form.querySelector('[name="date"]'); if (dt) b.date = dt.value || null;
  return b;
}
async function bpbSave(a, b, what) { b.pages_pdf = null; await saveApp(a, { bpb: b }, `Business plan: ${what}`, [{ label: "Business plan", old: null, new: what }]); }
FORMS.bpb = async (form, o = {}) => { const a = appOf(form.dataset.id), b = bpbRead(form, a); if (JSON.stringify(b) === JSON.stringify(a.bpb || null) && a.bpb) { if (!o.silent) toast("No changes to save.", "info"); UI.typing = false; return; } await bpbSave(a, b, "edited"); UI.typing = false; if (!o.silent) { toast("Saved."); render(); } };
ACTIONS.bpb = async el => {
  const a = currentApp(), form = document.querySelector('form[data-form="bpb"]'), b = form ? bpbRead(form, a) : clone(bpbOf(a)), op = el.dataset.op, i = b.sections.findIndex(s => s.id === el.dataset.sid);
  if (op === "up" && i > 0) [b.sections[i - 1], b.sections[i]] = [b.sections[i], b.sections[i - 1]];
  if (op === "down" && i < b.sections.length - 1) [b.sections[i + 1], b.sections[i]] = [b.sections[i], b.sections[i + 1]];
  if (op === "del" && !(await confirmAsk("Remove this section and its text?"))) return; if (op === "del") b.sections.splice(i, 1);
  if (op === "add") b.sections.push({ id: bpbId(), title: "New section", body: "", table: "none", on: true });
  if (op === "fill") { const s = b.sections[i], txt = bpbSuggest(a, s.key); if (!txt) return toast("There is nothing in the application for this section yet. Fill in the related steps first.", "warn"); if (String(s.body || "").trim() && s.body !== txt && !(await confirmAsk("Replace the text in this section with a draft from the application?"))) return; s.body = txt; }
  if (op === "reset") { if (!(await confirmAsk("Start again from the standard sections? Your current text is kept as a saved version first."))) return; const v = (b.versions || []); v.push({ no: v.length + 1, at: nowIso(), by: Store.uid, label: "Before starting again", sections: b.sections, milestones: b.milestones }); const nb = bpbDefault(a); nb.versions = v; await bpbSave(a, nb, "started again from the template"); UI.typing = false; return render(); }
  await bpbSave(a, b, { up: "section moved", down: "section moved", del: "section removed", add: "section added", fill: "section filled from the application" }[op]); UI.typing = false; render();
};
ACTIONS["bpb-version"] = async () => {
  const a = currentApp(), form = document.querySelector('form[data-form="bpb"]'), b = form ? bpbRead(form, a) : clone(bpbOf(a)), v = b.versions || [];
  v.push({ no: v.length + 1, at: nowIso(), by: Store.uid, label: `${b.sections.filter(s => s.on).length} sections`, sections: clone(b.sections), milestones: clone(b.milestones || []) }); b.versions = v.slice(-10);
  await bpbSave(a, b, `version ${v.length} saved`); UI.typing = false; toast(`Version ${v.length} saved.`); render();
};
ACTIONS["bpb-restore"] = async el => { const a = currentApp(), b = clone(bpbOf(a)), v = (b.versions || []).find(x => x.no === +el.dataset.no); if (!v || !(await confirmAsk(`Restore version ${v.no}? The current text is replaced (save it as a version first if you want to keep it).`))) return; b.sections = clone(v.sections); b.milestones = clone(v.milestones || []); await bpbSave(a, b, `version ${v.no} restored`); render(); };
ACTIONS["bpb-dl"] = async el => {
  const a = appOf(el.dataset.id), form = document.querySelector('form[data-form="bpb"]');
  if (form && UI.typing && !appLocked(a)) { await FORMS.bpb(form, { silent: true }); }
  const f = el.dataset.f, x = APP_OUTPUTS.find(o => o.k === "bplan");
  await runAndSave("the business plan", () => outputFiles(appOf(a.id), x, f), async files => { await recordGenerated(appOf(a.id), ["bplan"], files);
    if (f === "pdf" && files[0] && files[0].pages) { const cur = appOf(a.id); if (!appLocked(cur)) await Store.save("apps", { bpb: Object.assign({}, bpbOf(cur), { pages_pdf: files[0].pages }) }, cur.id); if (files[0].pages > 4) files[0].notes.unshift(`The Commission asks for a maximum of four pages; this plan runs to ${files[0].pages}.`); } });
};

