/* ===== x_bplink.js ===== */
/* Business plan reference (Operations) and the licence application's business plan.
   Route 1 - the company applied through Quayzen: the reference version is linked to the application and filled automatically
     from its Projections (Technical Evaluation Form) and business plan builder. It is created when the application is recorded as
     submitted, kept in step while it is a draft, and never changed once a second person has checked and locked it.
     If the application is later resubmitted with different figures, a new linked version is created.
   Route 2 - the company was licensed before using Quayzen: the figures are entered by hand (as before), or uploaded from the
     Technical Evaluation Form the company gave the Commission (old one-sheet form or the new two-sheet form), or from Quayzen's
     Excel template. Every upload is shown for checking before anything is saved.
   In both routes the figures stay projections, not commitments. */

const BPL_SECTION_MAP = { summary: "background", applicant: "ownership", activities: "activities", operating: "operating_model", markets: "customers", implementation: "implementation", staffing: "employment", office: "office", funding: "investment", financials: "projections", controls: "other" };
const BPL_YEARS = 10;
const bplLinked = v => !!(v && v.link && v.link.app_id && !v.link.off);
const bplVersionsFor = a => Store.list("bplans").filter(v => v.link && v.link.app_id === a.id).sort((x, y) => (y.version_no || 0) - (x.version_no || 0));

/* Ten plan years from application-style projections (a real application, or one built from an uploaded Technical Evaluation Form) */
function bplYears(a) {
  const T = tefTotals(a), d = (a.tef || {}).d || {};
  const det = ["fdi_equity", "fdi_loans", "fdi_reinvested"].map(k => (d[k] || {}).provider ? `${TEF_ROWS.find(r => r.k === k).l.replace("FDI - ", "")}: ${d[k].provider}` : "").filter(Boolean).join("; ");
  return Array.from({ length: BPL_YEARS }, (_, y) => {
    const has = k => tefVal(a, k, y);
    return { revenue_usd: tefVal(a, "revenue", y), expenses_usd: tefVal(a, "expenses", y), net_income_usd: tefVal(a, "net_income", y),
      local_employees: T[y].local || null, foreign_employees: T[y].foreign || null, local_remuneration_usd: T[y].rem_local || null, foreign_remuneration_usd: T[y].rem_foreign || null,
      office_sqm: tefVal(a, "floor", y), fdi_usd: T[y].fdi || null, lkr_land_lease: T[y].lkr || null,
      funding_source: has("fdi_loans") && (has("fdi_equity") || has("fdi_reinvested")) ? "Equity and Debt" : has("fdi_loans") ? "Debt" : T[y].fdi ? "Equity" : null,
      funding_details: T[y].fdi && det ? det.slice(0, 500) : null, funding_evidence: null };
  });
}
function bplFromApp(a) {
  const b = a.bpb, sections = {};
  if (b && (b.sections || []).length) for (const s of b.sections.filter(s => s.on && String(s.body || "").trim())) { const k = BPL_SECTION_MAP[s.key] || "other"; sections[k] = [sections[k], s.body.trim()].filter(Boolean).join("\n\n"); }
  else Object.assign(sections, { activities: getPath(a, "p2.description") || getPath(a, "p6.products") || "", operating_model: getPath(a, "bp.operating_model") || "", customers: getPath(a, "p6.target_market") || "", implementation: getPath(a, "p6.strategy") || "", projections: getPath(a, "bp.assumptions") || "" });
  const milestones = ((b || {}).milestones || []).filter(m => m && m.m).map(m => ({ milestone: m.m, target_date: /^\d{4}-\d{2}-\d{2}$/.test(m.date || "") ? m.date : null }));
  return { years: bplYears(a), sections, milestones, year1_start: (a.tef || {}).year1 || a.licence_issue_date || null };
}
const bplBody = x => JSON.stringify({ years: x.years, sections: x.sections, milestones: (x.milestones || []).map(m => [m.milestone, m.target_date]), year1: x.year1_start });

/* Create or update the linked version. Returns a short description of what happened. */
async function bplSync(a, why, o = {}) {
  if (!Store.can("bplan", "write") || [APP_STATUS.withdrawn, APP_STATUS.rejected].includes(a.status)) return null;
  const data = bplFromApp(a), vs = bplVersionsFor(a), cur = vs.find(v => !v.link.off), stamp = { app_id: a.id, app_title: a.title, app_status: a.status, synced_at: nowIso(), synced_by: Store.uid, why };
  const commission = { commission_date: a.submitted_date || null, commission_ref: a.submission_ref || null };
  if (cur && (cur.status === "Draft" || cur.status === "Ready for check")) {
    const keepMs = data.milestones.map(m => Object.assign({}, (cur.milestones || []).find(x => x.milestone === m.milestone) || {}, m)); // keep recorded progress
    const next = Object.assign({}, data, { milestones: keepMs, year1_start: cur.year1_start || data.year1_start });
    const changed = bplBody(next) !== bplBody(cur) || (commission.commission_date && commission.commission_date !== cur.commission_date);
    if (!changed && !o.force) return null;
    const patch = Object.assign({}, next, commission, { link: stamp, data_source: "From licence application" }); if (cur.status === "Ready for check" && changed) patch.status = "Draft";
    await Store.save("bplans", patch, cur.id);
    await Store.audit("bplans", cur.id, "Updated from the licence application", `v${cur.version_no}: ${why}${patch.status === "Draft" && cur.status !== "Draft" ? " (back to draft for a new check)" : ""}`);
    return `Business plan reference v${cur.version_no} updated from the application.`;
  }
  if (cur && cur.status === "Locked" && bplBody(Object.assign({}, data, { year1_start: cur.year1_start })) === bplBody(cur)) return null;
  const n = Math.max(0, ...Store.list("bplans").map(v => v.version_no || 0)) + 1, revised = !!(cur && cur.status === "Locked");
  const id = await Store.save("bplans", Object.assign({ title: revised ? "Revised business plan (licence application)" : "Business plan submitted with the licence application", version_no: n, status: "Draft",
    commission_status: revised ? BP_COMMISSION[1] : BP_COMMISSION[0], notes: {}, prepared_by: Store.uid, parent_id: revised ? cur.id : null,
    change_summary: revised ? `Updated from the licence application: ${why}` : "", link: stamp, data_source: "From licence application" }, data, commission));
  await Store.audit("bplans", id, "Created", `v${n} created from the licence application (${why})`);
  return `Business plan reference v${n} created from the application. A second person still checks and locks it.`;
}

/* Triggers: recording submission or licence issue, the set-up step, and edits while a linked draft exists */
const _formAppStatus = FORMS["app-status"];
FORMS["app-status"] = async (form, ev) => {
  const to = form.dataset.to, id = (currentApp() || {}).id; await _formAppStatus(form, ev);
  const a = id && appOf(id); if (!a || a.status !== to) return;
  if (to === APP_STATUS.submitted || to === APP_STATUS.issued) { try { const r = await bplSync(a, to === APP_STATUS.submitted ? `recorded as submitted on ${fmtDate(a.submitted_date)}` : `licence issued on ${fmtDate(a.licence_issue_date)}`); if (r) toast(r, "info"); } catch (e) { toast("The business plan reference could not be updated: " + (e.message || e), "warn"); } }
};
const _formAppSetup = FORMS["app-setup"];
FORMS["app-setup"] = async (form, ev) => {
  const box = form.querySelector('[name="bplan"]'), want = box && box.checked; if (box) box.checked = false;
  const a = currentApp(); await _formAppSetup(form, ev);
  if (want && a) { const r = await bplSync(appOf(a.id), "set up from the issued licence", { force: true }); toast(r || "The business plan reference is already up to date with the application.", "info"); }
};
const _saveAppBpl = saveApp; let _bplTimer = null;
saveApp = async function (a, patch, what, changes) {
  await _saveAppBpl(a, patch, what, changes);
  const cur = bplVersionsFor(a).find(v => !v.link.off);
  if (cur && cur.status !== "Locked") { clearTimeout(_bplTimer); _bplTimer = setTimeout(() => bplSync(appOf(a.id), `application changed: ${String(what || "").slice(0, 80)}`).catch(() => { }), 1200); }
};
ACTIONS["bpl-sync"] = async el => { const a = appOf(el.dataset.app); if (!a) return; const r = await bplSync(a, "updated by hand from the application", { force: true }); toast(r || "Already up to date with the application."); render(); };
ACTIONS["bpl-unlink"] = async el => {
  const v = Store.get("bplans", el.dataset.id); if (!(await confirmAsk("Stop filling this version from the licence application? You can then edit the figures by hand. Changes to the application will no longer reach it."))) return;
  await Store.save("bplans", { link: Object.assign({}, v.link, { off: true, off_at: nowIso(), off_by: Store.uid }), data_source: "From licence application, then edited by hand" }, v.id);
  await Store.audit("bplans", v.id, "Link stopped", `v${v.version_no} is no longer filled from the licence application`); render();
};
CHANGES["bpl-y1"] = async el => { const v = Store.get("bplans", el.dataset.id), old = v.year1_start || null; if (v.status === "Locked") return; await Store.save("bplans", { year1_start: el.value || null }, v.id); await Store.audit("bplans", v.id, "Updated", `v${v.version_no}: Year 1 start ${old || "blank"} → ${el.value || "blank"}`); };
ACTIONS["bpl-openapp"] = el => { UI.appId = el.dataset.app; UI.tab.apply = el.dataset.step || "overview"; navTo("apply"); };

/* Linked drafts are edited in the application, not here */
const _viewBpedit = VIEWS.bpedit;
VIEWS.bpedit = view => {
  const v = Store.get("bplans", view.id);
  if (bplLinked(v)) return `<div class="head"><div class="t"><button class="link" data-act="back">← Back</button><h1>Business plan v${v.version_no}</h1></div></div>
    <div class="card"><p>This version is filled automatically from the licence application <b>${esc(v.link.app_title || "")}</b>. Change the figures in the application's Projections step, or the text in its Business plan step, and this version follows.</p>
    <div class="row"><button class="btn p" data-act="bpl-openapp" data-app="${esc(v.link.app_id)}" data-step="projections">Open the application's projections</button><button class="btn" data-act="bpl-unlink" data-id="${v.id}">Stop the link and edit by hand</button></div></div>`;
  return _viewBpedit(view);
};
const _viewBpview = VIEWS.bpview;
VIEWS.bpview = view => {
  const v = Store.get("bplans", view.id), html = _viewBpview(view); if (!v) return html;
  const a = v.link && v.link.app_id ? appOf(v.link.app_id) : null, w = Store.can("bplan", "write"), draft = v.status !== "Locked";
  const src = bplLinked(v) ? `<div class="card linkcard"><b>Filled from the licence application</b> <span class="badge info">Linked</span><p class="small">${a ? `<a href="#" data-act="bpl-openapp" data-app="${a.id}">${esc(a.title)}</a> (${esc(a.status)})` : esc(v.link.app_title || "")}. Figures come from its Projections step (the Technical Evaluation Form) and text and milestones from its Business plan step. Last updated ${esc(String(v.link.synced_at || "").slice(0, 16).replace("T", " "))} - ${esc(v.link.why || "")}.</p>
      <p class="small muted">${draft ? "While this version is a draft, changes to the application are copied here automatically. Once checked and locked it never changes; a new linked version is made if the application is resubmitted with different figures." : "Checked and locked: it no longer changes with the application."}</p>
      ${w && draft ? `<div class="row"><label class="small">Year 1 starts on <input type="date" value="${esc(v.year1_start || "")}" data-change="bpl-y1" data-id="${v.id}"></label><span class="help">Needed before the check. Usually the start of operations or the licence date.</span></div>` : ""}
      ${w && draft && a ? `<div class="row"><button class="btn sm" data-act="bpl-sync" data-app="${a.id}">Update from the application now</button><button class="btn sm" data-act="bpl-unlink" data-id="${v.id}">Stop the link and edit by hand</button></div>` : ""}</div>`
    : v.link && v.link.off ? `<div class="card linkcard small">Started from the licence application ${esc(v.link.app_title || "")}, then the link was stopped on ${esc(String(v.link.off_at || "").slice(0, 10))}. Figures are now kept by hand.</div>`
    : v.import ? `<div class="card linkcard small"><b>Uploaded</b> from <i>${esc(v.import.file)}</i> (${esc(v.import.format)}) on ${esc(String(v.import.at || "").slice(0, 16).replace("T", " "))} by ${esc(Store.name(v.import.by))}. ${draft ? "Check every figure against the plan before asking for a check." : ""}</div>`
    : `<div class="card linkcard small">Figures entered by hand.</div>`;
  const up = w ? `<div class="card"><h3>Plan document</h3><p class="small muted">Upload the business plan as given to the Commission (PDF). It is kept in the Documents register with this version.</p><label class="btn sm">Upload the plan document<input type="file" accept=".pdf" data-change="bpl-docup" data-id="${v.id}" hidden></label>
      ${draft && !bplLinked(v) ? `<span class="small"> or </span><label class="btn sm">Upload figures from Excel<input type="file" accept=".xlsx,.xls" data-change="bpl-import" data-target="${v.id}" hidden></label>` : ""}</div>` : "";
  let out = html;
  if (bplLinked(v)) out = out.replace(`<button class="btn p" data-act="bp-edit" data-id="${v.id}">Edit</button>`, "")
    .replace("Enter the figures exactly as they appear in the plan you submitted. A second person then checks them against the plan and locks this version.", "These figures were copied from the licence application. A second person checks them against the plan as submitted and locks this version.");
  return out.replace(/(<\/div><\/div>\s*<div class="card"><dl class="kv">)/, `</div></div>${src}<div class="card"><dl class="kv">`).replace(/(<div class="card"><h3>Year-by-year projections)/, `${up}$1`);
};

/* The Business plan reference page: where the figures come from */
PAGES.bplan = () => {
  const vs = Store.list("bplans").sort((a, b) => b.version_no - a.version_no), w = Store.can("bplan", "write"), ref = referencePlan();
  const apps = Store.can("licensing") ? Store.list("apps").filter(a => ![APP_STATUS.withdrawn, APP_STATUS.rejected].includes(a.status)) : [];
  const srcOf = v => bplLinked(v) ? '<span class="badge info">Linked to application</span>' : v.import ? `<span class="badge">Uploaded</span>` : v.link && v.link.off ? '<span class="badge">From application, then by hand</span>' : '<span class="badge">Entered by hand</span>';
  const appCard = apps.length ? `<div class="card"><h3>From your licence application</h3><p class="small muted">You applied through Quayzen, so the business plan reference is filled automatically from the application: figures from its Projections step, text and milestones from its Business plan step. It is created when you record the application as submitted, and kept up to date until a second person checks and locks it.</p>
     <div class="tw"><table class="t small"><thead><tr><th>Application</th><th>Status</th><th>Linked version</th><th></th></tr></thead><tbody>${apps.map(a => { const lv = bplVersionsFor(a).find(v => !v.link.off), sub = !APP_LOCKED.includes(a.status) && a.status !== APP_STATUS.info ? false : true;
       return `<tr><td>${esc(a.title)}</td><td>${badge(a.status)}</td><td>${lv ? `<a href="#" data-act="bp-open" data-id="${lv.id}">v${lv.version_no}</a> ${badge(lv.status)}` : `<span class="muted">${sub ? "Not linked yet" : "Created when you record the submission"}</span>`}</td>
       <td>${w ? `<button class="btn sm" data-act="bpl-sync" data-app="${a.id}">${lv ? (lv.status === "Locked" ? "Check for changes" : "Update now") : "Copy now"}</button>` : ""} <button class="btn sm" data-act="bpl-openapp" data-app="${a.id}" data-step="bplan">Open the application's plan</button></td></tr>`; }).join("")}</tbody></table></div></div>` : "";
  const manualCard = `<div class="card"><h3>${apps.length ? "Or enter or upload the figures" : "Enter or upload the plan you submitted"}</h3><p class="small muted">${apps.length ? "For a plan that did not go through Quayzen." : "Your licence was issued before you used Quayzen, so record the plan you gave the Commission."} Type the figures in, or upload the Technical Evaluation Form you submitted (the one-sheet form or the newer two-sheet form), or Quayzen's Excel template. You see every figure before it is saved.</p>
     ${w ? `<div class="row"><button class="btn${apps.length ? "" : " p"}" data-act="bp-new">Enter the figures by hand</button><label class="btn">Upload figures from Excel<input type="file" accept=".xlsx,.xls" data-change="bpl-import" data-target="" hidden></label><button class="btn" data-act="bpl-template">Download the Excel template</button></div>` : ""}</div>`;
  return `<div class="head"><div class="t"><h1>Business plan reference</h1><p class="muted">The business plan your company gave the Commission, kept as the reference for comparing plan with actual progress. Business plan figures are projections, not commitments, unless your licence, approval or an agreement says otherwise.</p></div>
   <div class="acts">${vs.length > 1 ? '<button class="btn" data-act="bp-compare">Compare versions</button>' : ""}</div></div>
   ${bpHighlights(ref)}${appCard}${manualCard}
   <div class="tw"><table class="t"><thead><tr><th>Version</th><th>Title</th><th>Filled from</th><th>What it is</th><th>Date given to the Commission</th><th>Status</th><th>Used for comparison</th></tr></thead><tbody>
   ${vs.map(v => `<tr><td>v${v.version_no}</td><td><a href="#" data-act="bp-open" data-id="${v.id}">${esc(v.title)}</a></td><td>${srcOf(v)}</td><td class="small">${esc(v.commission_status || "")}</td><td>${fmtDate(v.commission_date)}</td><td>${badge(v.status)}</td><td>${ref && ref.id === v.id ? '<span class="badge ok">Reference</span>' : ""}</td></tr>`).join("") || '<tr><td colspan="7" class="empty">No business plan recorded yet.</td></tr>'}</tbody></table></div>
   ${ref ? `<h2>Plan vs actual</h2><p class="muted">Compared with ${esc(ref.title)} v${ref.version_no}. Explain any large difference in the last column; the Commission may ask about progress against the plan.</p>${bpCharts(ref)}${pvaHTML(ref)}`
     : vs.length ? '<p class="note">Check and lock a plan version to use it for comparison.</p>' : ""}`;
};

/* ---------- uploads: plan document and figures ---------- */
CHANGES["bpl-docup"] = async el => {
  const file = el.files && el.files[0]; el.value = ""; if (!file) return; const v = Store.get("bplans", el.dataset.id);
  if (!Store.can("documents", "write")) throw ["Your role cannot add files to the Documents register."];
  if (!/\.pdf$/i.test(file.name)) throw ["Upload the plan as a PDF. Save a Word file as PDF first."];
  let assets = null; try { assets = await window.claude?.use?.("assets"); } catch (e) { }
  if (!assets) throw ["File upload isn't available for you in this view. Only people with edit access to this page can upload files."];
  const wait = toast("Uploading…", "info"); let up;
  try { up = await assets.upload(file); } catch (e) { throw [e && e.code === "too_large" ? "The file is too large (20 MB limit)." : "The upload failed. Please try again."]; } finally { if (wait) wait.remove(); }
  const ver = { asset_id: up.id, url: up.url, name: file.name, size: up.sizeBytes, type: up.contentType, uploaded_at: nowIso(), by: Store.uid };
  const d = Store.list("docs").find(x => x.link_type === "bplans" && x.link_id === v.id);
  if (d) { const versions = (d.versions || []).concat([ver]); await Store.save("docs", { versions }, d.id); await Store.audit("docs", d.id, "File uploaded", `${d.title}: version ${versions.length} (${file.name})`); }
  else { const id = await Store.save("docs", { title: `Business plan v${v.version_no} - ${v.title}`.slice(0, 140), category: "Business plans", access: "Normal", expiry_date: null, notes: "Uploaded from the business plan reference.", link_type: "bplans", link_id: v.id, versions: [ver] }); await Store.audit("docs", id, "Created", `Document: business plan v${v.version_no} (file ${file.name})`); }
  await Store.audit("bplans", v.id, "Plan document uploaded", `v${v.version_no}: ${file.name}`); toast("Uploaded."); render();
};
ACTIONS["bpl-template"] = async () => {
  const E = await libs.exceljs(), wb = new E.Workbook(), ws = wb.addWorksheet("Business plan figures");
  ws.columns = [{ width: 46 }, ...Array.from({ length: BPL_YEARS }, () => ({ width: 15 }))];
  ws.addRow(["Business plan figures - Quayzen template"]).font = { bold: true, size: 13 };
  ws.addRow(["Copy the figures from the plan as given to the Commission. Leave a box blank if the plan does not give that figure. Keep the item names in column A as they are. Source of funding: Equity, Debt, Equity and Debt, or Other. Evidence: Yes or No."]).font = { italic: true, color: { argb: "FF666666" } };
  const h = ws.addRow(["Item", ...Array.from({ length: BPL_YEARS }, (_, i) => `Year ${i + 1}`)]); h.font = { bold: true }; h.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE8EA" } });
  BP_YEAR_FIELDS.forEach(([, l]) => ws.addRow([l]));
  ws.addRow([]); ws.addRow(["Year 1 starts on (YYYY-MM-DD)"]);
  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  await saveFile("Business_plan_figures_template.xlsx", blob);
};
/* Read an uploaded workbook. Three layouts are recognised; anything else is refused rather than guessed. */
function bplParse(X, wb, fileName) {
  const sh = n => wb.Sheets[n], val = (ws, ref) => { const c = ws && ws[ref]; return c ? c.v : undefined; }, txt = (ws, ref) => String(val(ws, ref) ?? "").trim();
  const num = x => { if (x == null || x === "") return null; if (typeof x === "number") return x; const n = Number(String(x).replace(/[, ]/g, "")); return Number.isFinite(n) ? n : NaN; };
  const warn = [], cells = {}, years = Array.from({ length: BPL_YEARS }, () => ({}));
  const put = (y, k, x, ref, kind = "num") => { if (x == null || x === "") return; if (kind === "num") { const n = num(x); if (Number.isNaN(n)) { warn.push(`${ref}: '${x}' is not a number, so it was skipped.`); return; } x = n; } years[y][k] = x; cells[`${y}:${k}`] = ref; };
  // 1. Quayzen template
  const tpl = sh("Business plan figures");
  if (tpl) {
    const rng = X.utils.decode_range(tpl["!ref"]); let hdr = -1, year1 = null;
    for (let r = rng.s.r; r <= rng.e.r; r++) { if (/^item$/i.test(txt(tpl, "A" + (r + 1))) && /year 1/i.test(txt(tpl, "B" + (r + 1)))) { hdr = r; break; } }
    if (hdr < 0) throw ["The template's header row (Item, Year 1, Year 2 ...) was not found. Download a fresh template and copy the figures into it."];
    for (let r = hdr + 1; r <= rng.e.r; r++) {
      const label = txt(tpl, "A" + (r + 1)); if (!label) continue;
      if (/^year 1 starts/i.test(label)) { const v = val(tpl, "B" + (r + 1)); year1 = typeof v === "number" ? X.SSF.format("yyyy-mm-dd", v) : String(v || "").trim() || null; continue; }
      const f = BP_YEAR_FIELDS.find(([, l]) => l.toLowerCase() === label.toLowerCase()); if (!f) { warn.push(`Row ${r + 1}: '${label}' is not one of the template's items, so it was skipped.`); continue; }
      for (let y = 0; y < BPL_YEARS; y++) { const ref = X.utils.encode_cell({ r, c: y + 1 }), x = val(tpl, ref); if (x == null || x === "") continue;
        if (f[2] === "choice") { if (!FUNDING_SOURCES.includes(String(x).trim())) { warn.push(`${ref}: source of funding '${x}' is not one of ${FUNDING_SOURCES.join(", ")}; skipped.`); continue; } put(y, f[0], String(x).trim(), ref, "text"); }
        else if (f[2] === "yn") { const s = /^y/i.test(String(x)) ? "Yes" : /^n/i.test(String(x)) ? "No" : null; if (!s) { warn.push(`${ref}: '${x}' should be Yes or No; skipped.`); continue; } put(y, f[0], s, ref, "text"); }
        else if (f[2] === "text") put(y, f[0], String(x).trim().slice(0, 600), ref, "text");
        else { const nx = num(x); if (Number.isNaN(nx)) { warn.push(`${ref}: '${x}' is not a number, so it was skipped.`); continue; } put(y, f[0], f[2] === "int" ? Math.round(nx) : nx, ref); } }
    }
    if (year1 && !/^\d{4}-\d{2}-\d{2}$/.test(year1)) { warn.push(`Year 1 start '${year1}' is not a date in the form YYYY-MM-DD; left blank.`); year1 = null; }
    return { format: "Quayzen Excel template", years, cells, warn, year1 };
  }
  // 2. Older one-sheet Technical Evaluation Form
  const old = sh("Technical Evaluation");
  if (old && /projected revenue/i.test(txt(old, "B5")) && /local employees/i.test(txt(old, "C19")) && /foreign direct investment/i.test(txt(old, "B33"))) {
    for (let y = 0; y < BPL_YEARS; y++) {
      const r1 = 6 + y, r2 = 20 + y, r3 = 34 + y;
      put(y, "revenue_usd", val(old, "B" + r1), "B" + r1); put(y, "expenses_usd", val(old, "D" + r1), "D" + r1); put(y, "net_income_usd", val(old, "F" + r1), "F" + r1);
      put(y, "local_employees", val(old, "C" + r2), "C" + r2); put(y, "foreign_employees", val(old, "D" + r2), "D" + r2); put(y, "local_remuneration_usd", val(old, "E" + r2), "E" + r2); put(y, "foreign_remuneration_usd", val(old, "F" + r2), "F" + r2); put(y, "office_sqm", val(old, "G" + r2), "G" + r2);
      put(y, "fdi_usd", val(old, "B" + r3), "B" + r3); put(y, "lkr_land_lease", val(old, "C" + r3), "C" + r3);
      const fs = txt(old, "D" + r3); if (fs) { if (FUNDING_SOURCES.includes(fs)) put(y, "funding_source", fs, "D" + r3, "text"); else warn.push(`D${r3}: source of funding '${fs}' is not one of the form's choices; skipped.`); }
      const fd = txt(old, "E" + r3); if (fd) put(y, "funding_details", fd.slice(0, 600), "E" + r3, "text");
      const ev = txt(old, "F" + r3); if (ev) put(y, "funding_evidence", /^y/i.test(ev) ? "Yes" : /^n/i.test(ev) ? "No" : null, "F" + r3, "text");
    }
    return { format: "Technical Evaluation Form (one-sheet version)", years, cells, warn, year1: null };
  }
  // 3. Newer two-sheet Technical Evaluation Form: read the sheet that has figures, using the same rows Quayzen fills
  const s1 = sh("AP Only & Secondary BSI"), s2 = sh("Primary BSI-Only");
  if (s1 || s2) {
    const has = (ws, primary) => ws && TEF_ROWS.some(r => { const row = primary ? r.s2 : r.s1; return Array.from({ length: 20 }, (_, i) => val(ws, colL(6 + i) + row)).some(x => typeof x === "number"); });
    const primary = has(s2, true) && !has(s1, false); const ws = primary ? s2 : s1;
    if (!ws || !has(ws, primary)) throw ["This Technical Evaluation Form has no figures in it."];
    const check = primary ? [["A30", /revenue/i], ["A59", /floor space/i]] : [["A25", /revenue/i], ["A54", /floor space/i]];
    for (const [ref, re] of check) if (!re.test(txt(ws, ref))) throw [`This looks like a different version of the Technical Evaluation Form (cell ${ref} is not where Quayzen expects it). Use Quayzen's Excel template instead.`];
    if (has(s1, false) && has(s2, true)) warn.push("Both sheets have figures. The 'AP Only & Secondary BSI' sheet was used.");
    const v = {}, d = {}, src = {};
    for (const r of TEF_ROWS) {
      const row = primary ? r.s2 : r.s1;
      if (r.det) d[r.k] = { provider: txt(ws, "C" + row) || null, docref: txt(ws, "D" + row) || null };
      for (let y = 0; y < BPL_YEARS; y++) {
        if (primary && r.pair) { for (const [suf, c] of [["_ll", 6 + 2 * y], ["_dev", 7 + 2 * y]]) { const ref = colL(c) + row, x = num(val(ws, ref)); if (Number.isNaN(x)) { warn.push(`${ref}: not a number; skipped.`); continue; } if (x != null) { (v[r.k + suf] = v[r.k + suf] || [])[y] = x; src[`${r.k}:${y}`] = (src[`${r.k}:${y}`] ? src[`${r.k}:${y}`] + "+" : "") + ref; } } }
        else { const ref = colL(primary && r.ccy === "LKR" ? 6 + 2 * y : 6 + y) + row, x = num(val(ws, ref)); if (Number.isNaN(x)) { warn.push(`${ref}: not a number; skipped.`); continue; } if (x != null) { (v[r.k] = v[r.k] || [])[y] = x; src[`${r.k}:${y}`] = ref; } }
      }
    }
    const pseudo = { app_type: primary ? "Primary BSI" : "Authorised Person only", tef: { v, d } }, ys = bplYears(pseudo);
    const from = { revenue_usd: ["revenue"], expenses_usd: ["expenses"], net_income_usd: ["net_income"], local_employees: ["m_local", "o_local"], foreign_employees: ["m_foreign", "o_foreign"], local_remuneration_usd: ["m_rem_local", "o_rem_local"], foreign_remuneration_usd: ["m_rem_foreign", "o_rem_foreign"], office_sqm: ["floor"], fdi_usd: ["fdi_equity", "fdi_loans", "fdi_reinvested"], lkr_land_lease: ["lkr_equity", "lkr_loans", "lkr_adv", "lkr_other"] };
    ys.forEach((yr, y) => { for (const [k, x] of Object.entries(yr)) { if (x == null || x === "" || x === 0 && !(from[k] || []).some(t => src[`${t}:${y}`])) continue; years[y][k] = x; const refs = (from[k] || []).map(t => src[`${t}:${y}`]).filter(Boolean); cells[`${y}:${k}`] = refs.length ? refs.join(", ") : k === "funding_source" ? "worked out from the FDI rows" : "column C (funding provider)"; } });
    if (ys.some(y => y.lkr_land_lease)) warn.push("'Investment in LKR' is the total of the LKR funding rows on the form (equity, loans, customer advances and other), in LKR.");
    return { format: `Technical Evaluation Form (two-sheet version, '${primary ? "Primary BSI-Only" : "AP Only & Secondary BSI"}' sheet)`, years, cells, warn, year1: null };
  }
  throw [`'${fileName}' is not a layout Quayzen recognises. Upload the Technical Evaluation Form you submitted, or copy the figures into Quayzen's Excel template.`];
}
CHANGES["bpl-import"] = async el => {
  const file = el.files && el.files[0], target = el.dataset.target || ""; el.value = ""; if (!file) return;
  if (!Store.can("bplan", "write")) throw ["Your role cannot change the business plan reference."];
  if (!/\.xlsx?$/i.test(file.name)) throw ["Upload an Excel file (.xlsx)."];
  const X = await libs.xlsx(); let wb; try { wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: "array" }); } catch (e) { throw ["This file could not be opened as an Excel workbook."]; }
  const res = bplParse(X, wb, file.name), n = Object.keys(res.cells).length;
  if (!n) throw ["No figures were found in this file."];
  UI.bplImport = Object.assign(res, { file: file.name, target });
  const shown = BP_YEAR_FIELDS.filter(([k]) => res.years.some(y => y[k] != null && y[k] !== "")), yrs = res.years.map((y, i) => i).filter(i => Object.keys(res.years[i]).length);
  const last = Math.max(...yrs, 4), cols = Array.from({ length: last + 1 }, (_, i) => i);
  const drafts = Store.list("bplans").filter(v => v.status === "Draft" && !bplLinked(v));
  openModal(`<h2>Check the uploaded figures</h2><p class="small">Read from <b>${esc(file.name)}</b> as: ${esc(res.format)}. ${n} figure(s) found. Hover over a figure to see the cell it came from. Nothing is saved until you choose below.</p>
   ${res.warn.length ? `<ul class="small">${res.warn.slice(0, 12).map(w => `<li class="wt">${esc(w)}</li>`).join("")}${res.warn.length > 12 ? `<li>…and ${res.warn.length - 12} more</li>` : ""}</ul>` : ""}
   <div class="tw"><table class="t small"><thead><tr><th>Item</th>${cols.map(i => `<th class="num">Year ${i + 1}</th>`).join("")}</tr></thead><tbody>
   ${shown.map(([k, l, t]) => `<tr><td>${esc(l)}</td>${cols.map(i => { const x = res.years[i][k]; return `<td class="${t === "num" || t === "int" ? "num" : ""}" title="${esc(res.cells[`${i}:${k}`] || "")}">${x == null ? "" : t === "num" ? fmtNum(x) : esc(x)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
   <form class="f" data-form="bpl-import-ok" novalidate><div class="grid2"><div class="fld"><label for="bi_to">Put the figures into</label><select id="bi_to" name="to"><option value="">A new draft version</option>${drafts.map(v => `<option value="${v.id}"${v.id === target ? " selected" : ""}>Draft v${v.version_no} - ${esc(v.title)} (its figures are replaced)</option>`).join("")}</select></div>
   <div class="fld"><label for="bi_y1">Year 1 starts on</label><input type="date" id="bi_y1" name="year1" value="${esc(res.year1 || "")}"><span class="help">Usually the start of operations or the licence date. Needed to compare plan with actual.</span></div></div>
   <div class="row"><button class="btn p">Save as a draft</button><button type="button" class="btn" data-act="modal-close">Cancel</button></div></form>`, "wide");
};
FORMS["bpl-import-ok"] = async form => {
  const x = UI.bplImport; if (!x) return closeModal(); const o = readForm(form), imp = { file: x.file, format: x.format, at: nowIso(), by: Store.uid, figures: Object.keys(x.cells).length, cells: x.cells };
  let id = o.to, n;
  if (id) { const v = Store.get("bplans", id); n = v.version_no; await Store.save("bplans", { years: x.years, year1_start: o.year1 || v.year1_start || null, import: imp, data_source: "Imported" }, id); await Store.audit("bplans", id, "Figures uploaded", `v${n}: ${imp.figures} figure(s) from ${x.file} (${x.format}); previous figures replaced`); }
  else { n = Math.max(0, ...Store.list("bplans").map(v => v.version_no || 0)) + 1;
    id = await Store.save("bplans", { title: "Business plan", version_no: n, status: "Draft", commission_status: n === 1 ? BP_COMMISSION[0] : BP_COMMISSION[1], year1_start: o.year1 || null, sections: {}, years: x.years, milestones: [], notes: {}, prepared_by: Store.uid, import: imp, data_source: "Imported" });
    await Store.audit("bplans", id, "Created", `v${n} created from ${x.file} (${x.format}), ${imp.figures} figure(s)`); }
  UI.bplImport = null; closeModal(); toast(`Saved in draft v${n}. Check it against the plan, then ask a second person to check and lock it.`); go({ kind: "bpview", id });
};

