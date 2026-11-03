/* ===== app.js ===== */
/* App shell: sidebar, router, banners, modal, and the delegated event handlers. */


const UI = { chat: [], section: "dashboard", view: null, stack: [], filter: {}, showArchived: {}, tab: {}, params: {}, modal: null, calc: {}, lastRep: null };
const SECTIONS = [["dashboard", "Dashboard", "dashboard"], ["company", "Company Profile", "company"], ["apply", "Licence Application", "licensing"], ["changes", "Licence Changes", "licensing"], ["develop", "Development Approvals", "development"], ["checklists", "Checklists", "checklists"], ["bplan", "Business Plan Reference", "bplan"],
  ["requests", "Commission Requests", "requests"], ["workforce", "Workforce", "workforce"], ["investment", "Investment and Funding", "investment"], ["budget", "Budget", "budget"], ["offices", "Office Space", "offices"],
  ["returns", "Annual Returns", "returns"], ["obligations", "Licences and Obligations", "obligations"], ["visas", "Visas and Permits", "visas"], ["documents", "Documents", "documents"],
  ["reports", "Reports", "reports"], ["library", "Quayza", null], ["howto", "How It Works", null], ["setup", "Setup", "settings"]];
const EDIT_KINDS = ["form", "company-edit", "bpedit", "docform", "budedit", "appperson"];

function go(view) { UI.stack.push(UI.view); UI.view = view; render(); window.scrollTo(0, 0); }
function back() { UI.view = UI.stack.length ? UI.stack.pop() : null; render(); }
function setHash(s) { if (location.hash !== "#" + s) { UI.ignoreHash = s; location.hash = s; } }
function navTo(section, view, push) {
  if (push && section === UI.section) return go(view);
  UI.section = section; UI.stack = []; UI.view = view || null; setHash(section); render(); window.scrollTo(0, 0);
}
function openModal(html, size = "") { UI.modal = { html, size }; renderModal(); setTimeout(() => { const f = document.querySelector("#modal input:not([type=hidden]):not([type=radio]), #modal textarea, #modal select, #modal button"); f && f.focus(); }, 0); }
function closeModal() { UI.modal = null; renderModal(); if (UI.dirty) { UI.dirty = false; render(); } }
function renderModal() {
  const m = document.getElementById("modal");
  if (!UI.modal) { m.hidden = true; m.innerHTML = ""; return; }
  m.hidden = false; m.innerHTML = `<div class="mbox ${UI.modal.size}" role="dialog" aria-modal="true"><button class="x" data-act="modal-close" aria-label="Close">×</button>${UI.modal.html}</div>`;
}
function confirmModal(text, fn) { UI.confirmFn = fn; openModal(`<p>${esc(text)}</p><div class="row"><button class="btn p" data-act="confirm-yes">Yes</button><button class="btn" data-act="modal-close">Cancel</button></div>`); }
function confirmAsk(text) { return new Promise(res => confirmModal(text, () => res(true))); }

/* ---------- rendering ---------- */
function canSection(s) { const d = SECTIONS.find(x => x[0] === s); return d && (!d[2] || Store.can(d[2])); }
function banners() {
  const c = Store.company(), out = [];
  if (Store.mode === "memory") out.push('<div class="banner bad"><b>Not saved.</b> Open in claude.ai to keep your work.</div>');
  if (Store.readOnly) out.push('<div class="banner warn">You can view this workspace but not change it.</div>');
  if (c && c.is_demo) out.push('<div class="banner demo">Demo data. Sample figures only, not for a real submission.</div>');
  if (Store.preview) out.push(`<div class="banner info">Previewing as <b>${esc(ROLES[Store.preview])}</b>. <button class="link" data-act="preview-off">Back to my own role</button></div>`);
  return out.join("");
}
const ICON_PATHS = {
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z",
  company: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3",
  bplan: "M5 3h10l4 4v14H5V3Zm9 0v5h5M8 13h8M8 17h5",
  budget: "M3 7h18v12H3V7Zm0 4h18M7 15h3M16 3H8l-2 4h12l-2-4Z",
  investment: "M4 19V9M10 19V5M16 19v-7M3 21h18M15 7l3-3 3 3M18 4v6",
  workforce: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 10a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M21 21a5 5 0 0 0-4-4.9",
  offices: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h.01M12 10h.01M15 10h.01M9 13h.01M12 13h.01M15 13h.01",
  visas: "M5 3h14v18H5V3Zm7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-4 11h8",
  obligations: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9",
  requests: "M4 4h16v12H7l-3 3V4Zm4 5h8M8 12h5",
  returns: "M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2Zm2 6h6M9 13h6",
  documents: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
  reports: "M4 20V4h11l5 5v11H4Zm11-16v5h5M8 16v-3M12 16v-6M16 16v-2",
  library: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14ZM20 17v4H6.5A2.5 2.5 0 0 1 4 18.5M9 7h7M9 11h5",
  howto: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14m0 3h.01",
  setup: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  menu: "M4 6h16M4 12h16M4 18h16", sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z", auto: "M3 5h18v11H3V5Zm6 15h6M12 16v4",
  apply: "M9 3h6l1 2h3v16H5V5h3l1-2Zm0 0v3h6V3M8.5 13l2.5 2.5 4.5-5",
  develop: "M3 21h18M5 21V10l5-4v15M10 21V4l9 5v12M13 10h3M13 14h3M13 18h3",
  checklists: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  changes: "M4 7h11M4 7l3-3M4 7l3 3M20 17H9m11 0-3-3m3 3-3 3",
  ask: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12ZM9 10h6M9 13h4",
};
const iconLine = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[k] || ICON_PATHS.dashboard}"/></svg>`;
const icon = k => `<img class="pi" src="${qzIconDir()}/${PENCIL_SET.has(k) ? k : "dashboard"}.svg" alt="" draggable="false">`;
const NAV_GROUPS = [["Overview", ["dashboard", "company", "checklists", "documents", "reports"]], ["1 · Application", ["apply"]], ["2 · Development", ["develop"]], ["3 · Operations", ["workforce", "visas", "offices", "investment", "budget", "bplan"]],
  ["4 · Compliance", ["obligations", "requests", "returns"]], ["5 · Amendments", ["changes"]], ["6 · AI and library", ["library"]], ["Help", ["howto", "setup"]]];
function sidebar() {
  const mine = Store.myCompanies(), lab = k => (SECTIONS.find(s => s[0] === k) || [])[1];
  return `<a class="brand" href="#dashboard" data-act="nav" data-section="dashboard"><span class="mark">${icon("obligations")}</span><span>Quayzen<small>Port City compliance</small></span></a>
   <div class="cobox"><label for="cosel">Company</label><select id="cosel" data-change="co-switch">${mine.map(c => `<option value="${c.id}"${c.id === Store.cid ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
    <div class="role">${esc(ROLES[Store.role()] || "")}${Store.preview ? " (preview)" : ""}</div></div>
   <nav aria-label="Sections">${NAV_GROUPS.map(([g, ks]) => { const items = ks.filter(canSection); return items.length ? `<div class="ng"><span>${esc(g)}</span>${items.map(k => `<a href="#${k}" class="${k === UI.section ? "on" : ""}" data-act="nav" data-section="${k}"${k === UI.section ? ' aria-current="page"' : ""}>${icon(k)}${esc(lab(k))}</a>`).join("")}</div>` : ""; }).join("")}</nav>`;
}
function themeNow() { try { return localStorage.getItem("pcch.theme") || "system"; } catch (e) { return "system"; } }
function applyTheme(t) { if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; }
function topbar() {
  const c = Store.company(), t = themeNow(), lab = (SECTIONS.find(s => s[0] === UI.section) || [])[1] || "";
  return `<div class="topbar"><button class="iconbtn menu-btn" data-act="menu" aria-label="Open menu">${icon("menu")}</button>
   <div class="crumb">${esc(c ? c.name : "")}${c && c.is_demo ? ' <span class="badge warn">DEMO</span>' : ""}<span aria-hidden="true">/</span><b>${esc(lab)}</b></div>
   <div class="tgroup"><div class="look-seg" role="group" aria-label="Charts and icons style"><button class="${qzLook() !== "pro" ? "on" : ""}" data-act="look" data-v="pencil" aria-pressed="${qzLook() !== "pro"}" title="Hand-drawn charts and icons">Pencil</button><button class="${qzLook() === "pro" ? "on" : ""}" data-act="look" data-v="pro" aria-pressed="${qzLook() === "pro"}" title="Clean charts and icons for presentations">Professional</button></div>${UI.section !== "library" && canSection("library") ? `<button class="btn sm" data-act="nav" data-section="library" title="Ask Quayza, your AI assistant for SEZ rules">${icon("quayza")}<span class="hide-sm">Ask Quayza</span></button>` : ""}
   <button class="iconbtn" data-act="theme" aria-label="Theme: ${t}. Change theme" title="Theme: ${t}">${icon(t === "dark" ? "moon" : t === "light" ? "sun" : "auto")}</button></div></div>`;
}
function welcome() {
  const others = Store.companies.length - Store.myCompanies().length;
  return `<main class="welcome"><div class="card"><h1>Quayzen</h1><p class="muted" style="margin-top:-4px">Port City compliance workspace</p><p>For companies holding an Authorised Person licence or BSI designation with the Colombo Port City Economic Commission. Keep your Port City records, compare progress with your business plan, track licence conditions and obligations, answer Commission requests and prepare the annual return.</p>
   ${others > 0 ? `<p class="note">There ${others === 1 ? "is 1 company" : `are ${others} companies`} here that you have not been added to. Ask that company's administrator to add you under Setup > People and roles.</p>` : ""}
   ${Store.readOnly ? '<p class="note">You can view this page but not add a company.</p>' : `<h3>Start</h3><form class="inline" data-form="newco"><input name="name" placeholder="Your company's name" required aria-label="Company name"><button class="btn p">Create company</button></form>
   <p>or <button class="btn" data-act="demo-load">Try it with a demo company</button> <span class="small muted">(made-up sample data, clearly marked DEMO)</span></p>`}
   ${banners()}<p class="small muted">You become the administrator of a company you create. Data is saved with this page and visible to people you share it with.</p></div></main>`;
}
function mainContent() {
  if (!canSection(UI.section)) return '<div class="card empty">Your role cannot open this area.</div>';
  const v = UI.view;
  if (v && v.kind !== "company-edit") {
    if (v.kind === "form") { if (!Store.can(REG[v.type].module, "write")) return '<div class="card empty">Your role cannot change these records.</div>'; return formHTML(v.type, v.id, v.defaults); }
    if (v.kind === "view") { const r = Store.get(v.type, v.id); return viewHTML(v.type, v.id, r && EXTRAS[v.type] ? EXTRAS[v.type](r) : ""); }
    if (VIEWS[v.kind]) return VIEWS[v.kind](v);
  }
  return PAGES[UI.section]();
}
function render() {
  const app = document.getElementById("app");
  if (Store.mode === "loading") { app.innerHTML = '<div class="loading">Loading…</div>'; return; }
  if (!Store.cid) { app.innerHTML = welcome(); renderModal(); return; }
  UI.typing = false;
  const active = document.activeElement, fk = active && active.dataset && active.dataset.filter, pos = fk ? active.selectionStart : 0;
  let html; try { html = mainContent(); } catch (e) { console.error(e); html = `<div class="card"><h2>Something went wrong showing this screen</h2><p class="muted">${esc(e.message || e)}</p><button class="btn" data-act="home">Go to the dashboard</button></div>`; }
  app.innerHTML = `<div class="mainwrap">${topbar()}<main>${banners()}${html}</main></div>${dock()}`;
  if (fk) { const el = document.querySelector(`[data-filter="${fk}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { } } }
  renderModal();
  const ids = []; document.querySelectorAll("[data-uid]").forEach(e => ids.push(e.dataset.uid)); Store.resolveNames(ids.concat(members()));
}

/* ---------- generic actions ---------- */
const GEN = {
  nav: el => { UI.menuOpen = false; if (el.dataset.report) return navTo("reports", { kind: "report", code: el.dataset.report }); navTo(el.dataset.section); },
  home: () => navTo("dashboard"),
  menu: () => { UI.menuOpen = !UI.menuOpen; render(); },
  theme: () => { const order = ["system", "light", "dark"], n = order[(order.indexOf(themeNow()) + 1) % 3]; try { localStorage.setItem("pcch.theme", n); } catch (e) { } applyTheme(n); render(); toast(`Theme: ${n === "system" ? "follows your device" : n}.`, "info"); },
  tab: el => { UI.tab[el.dataset.section] = el.dataset.tab; UI.view = null; UI.stack = []; render(); },
  new: el => go({ kind: "form", type: el.dataset.type }),
  edit: el => go({ kind: "form", type: el.dataset.type, id: el.dataset.id }),
  open: el => { const s = el.dataset.section; if (s && s !== UI.section) return navTo(s, { kind: "view", type: el.dataset.type, id: el.dataset.id }); go({ kind: "view", type: el.dataset.type, id: el.dataset.id }); },
  back: () => back(),
  "modal-close": () => closeModal(),
  "confirm-yes": async () => { const fn = UI.confirmFn; UI.confirmFn = null; closeModal(); if (fn) await fn(); },
  "preview-off": () => { Store.preview = null; UI.view = null; UI.stack = []; render(); },
  "toggle-archived": el => { UI.showArchived[el.dataset.type] = el.checked; render(); },
  archive: el => confirmModal("Archive this record? It will be hidden from lists but kept, with its history.", async () => {
    await Store.save(el.dataset.type, { archived: true }, el.dataset.id); await Store.audit(el.dataset.type, el.dataset.id, "Archived", REG[el.dataset.type].label); toast("Archived."); back(); }),
  review: async el => {
    const t = el.dataset.type, r = Store.get(t, el.dataset.id), s = el.dataset.status;
    if (s !== "Queried") needDifferentPerson(r.updated_by, "review this record");
    await Store.save(t, { review_status: s, reviewed_by: Store.uid, reviewed_at: today() }, r.id);
    await Store.audit(t, r.id, s === "Queried" ? "Queried" : "Reviewed", `${REG[t].label}: ${s}`); toast(s === "Queried" ? "Marked as queried." : "Review recorded.");
  },
  "fill-rate": el => {
    const f = el.closest("form"), cur = (f.original_currency.value || "").toUpperCase(), d = (f.entry_date && f.entry_date.value) || today();
    if (!cur) return toast("Enter the original currency first.", "warn");
    const rate = Store.list("fx_rates").filter(x => x.currency === cur && x.rate_date <= d).sort((a, b) => b.rate_date.localeCompare(a.rate_date))[0];
    if (!rate) return toast(`No ${cur} rate on or before ${fmtDate(d)} in the exchange rate table (Setup > Exchange rates).`, "warn");
    const set = (n, x) => { if (f[n]) f[n].value = x; };
    if (cur !== "USD" && rate.per_usd) set("usd_rate", rate.per_usd);
    if (cur !== "LKR" && rate.lkr_per_unit) set("lkr_rate", rate.lkr_per_unit);
    set("rate_date", rate.rate_date); set("rate_source", rate.source); convHint(f); toast(`Rates from ${fmtDate(rate.rate_date)} filled in. Check them.`);
  },
  import: el => { const t = el.dataset.type; openModal(`<h2>Import ${esc(REG[t].plural.toLowerCase())} from Excel</h2><ol class="small"><li>Download the template and fill one row per record.</li><li>Choose the filled file. You will see a preview with any problems.</li><li>Only rows without problems are imported, when you confirm.</li></ol>
    <div class="row"><button class="btn" data-act="import-template" data-type="${t}">Download template</button><label class="btn p">Choose file<input type="file" accept=".xlsx,.xls,.csv" data-change="import-file" data-type="${t}" hidden></label></div>`); },
  "import-template": el => importTemplate(el.dataset.type),
  "import-run": async () => {
    const st = UI.importState; if (!st) return; const ok = st.rows.filter(r => !r.errors.length);
    let n = 0; for (const r of ok) { await saveRecord(st.type, Object.assign({ __nolog: true }, r.data), null, "Imported"); n++; }
    await Store.audit(st.type, null, "Imported", `${n} ${REG[st.type].plural.toLowerCase()} imported from ${st.file}${st.rows.length - n ? `; ${st.rows.length - n} row(s) skipped` : ""}`);
    UI.importState = null; closeModal(); toast(`${n} record(s) imported.`);
  },
  "export-list": async el => {
    const t = el.dataset.type, def = REG[t], X = await libs.xlsx(), fs = def.fields;
    const rows = Store.list(t, { archived: UI.showArchived[t] }).map(r => [...fs.map(f => plain(f, r[f.name])), r.data_source || "", ...(def.reviewable ? [r.review_status || ""] : [])]);
    const c = Store.company();
    const aoa = [...(c.is_demo ? [["DEMO DATA - made-up sample figures"]] : []), [`${def.plural} - ${c.name} - exported ${today()}`], [], [...fs.map(f => f.label), "Source", ...(def.reviewable ? ["Review"] : [])], ...rows];
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), def.plural.slice(0, 30).replace(/[\\/?*[\]:]/g, ""));
    if (await saveFile(`${c.is_demo ? "DEMO_" : ""}${t}_${today()}.xlsx`, new Blob([X.write(wb, { type: "array", bookType: "xlsx" })]))) { toast("File ready."); Store.audit(t, null, "Exported", `${def.plural}: ${rows.length} rows to Excel`); }
  },
};
CHANGES["import-file"] = async el => {
  const file = el.files && el.files[0]; if (!file) return; const t = el.dataset.type;
  const res = await parseImport(t, file); UI.importState = Object.assign(res, { type: t, file: file.name });
  const ok = res.rows.filter(r => !r.errors.length).length;
  openModal(`<h2>Check before importing</h2><p>${res.rows.length} row(s) found: <b>${ok} ready</b>, ${res.rows.length - ok} with problems.</p>
   ${res.unknown.length ? `<p class="note small">Columns not recognised and ignored: ${esc(res.unknown.join(", "))}</p>` : ""}
   <div class="tw" style="max-height:320px"><table class="t small"><thead><tr><th>Row</th><th>Result</th></tr></thead><tbody>${res.rows.map(r => `<tr><td>${r.row}</td><td>${r.errors.length ? `<span class="badge bad">skip</span> ${esc(r.errors.join("; "))}` : '<span class="badge ok">ready</span> ' + esc(Object.entries(r.data).filter(([k, v]) => v != null).slice(0, 4).map(([k, v]) => { const f = REG[t].fmap[k]; return f.type === "ref" ? refLabel(f, v) : v; }).join(" · "))}</td></tr>`).join("")}</tbody></table></div>
   <div class="row">${ok ? `<button class="btn p" data-act="import-run">Import ${ok} row(s)</button>` : ""}<button class="btn" data-act="modal-close">Cancel</button></div>`, "wide");
};
CHANGES["co-switch"] = el => { Store.switchCompany(el.value); UI.view = null; UI.stack = []; navTo("dashboard"); };

FORMS.record = async form => {
  const t = form.dataset.type, id = form.dataset.id || null;
  const { id: nid, notes } = await saveRecord(t, readForm(form), id, "Manual");
  if (AFTER_SAVE[t]) await AFTER_SAVE[t](nid, !id);
  notes.forEach(n => toast(n, "warn")); toast("Saved.");
  UI.stack.pop(); UI.view = { kind: "view", type: t, id: nid };
  if (!id) UI.stack.push(null);
  render();
};

function convHint(f) {
  const h = f.querySelector("#conv-hint"); if (!h || !f.original_amount) return;
  const v = n => (f[n] && f[n].value) || "";
  const a = Number(String(v("original_amount")).replace(/,/g, "")), cur = v("original_currency").toUpperCase(), ur = Number(v("usd_rate")), lr = Number(v("lkr_rate"));
  if (!a || !cur) { h.textContent = ""; return; }
  const p = [];
  if (cur === "USD") p.push(`USD ${fmtMoney(a)}`); else if (v("usd_amount")) p.push(`USD ${v("usd_amount")} (typed)`); else if (ur) p.push(`USD ${fmtMoney(a / ur)} (${cur} ${fmtMoney(a)} ÷ ${ur})`); else p.push("no USD figure yet");
  if (cur === "LKR") p.push(`LKR ${fmtMoney(a)}`); else if (v("lkr_amount")) p.push(`LKR ${v("lkr_amount")} (typed)`); else if (lr) p.push(`LKR ${fmtMoney(a * lr)} (${cur} ${fmtMoney(a)} × ${lr})`);
  h.textContent = "Will be saved as: " + p.join(" · ");
}

/* ---------- event wiring ---------- */
async function run(fn, el, ev) {
  try { await fn(el, ev); }
  catch (e) { console.warn(e); showErrors(Array.isArray(e) ? e : (e && e.message) || String(e)); }
}
document.addEventListener("click", ev => {
  const el = ev.target.closest("[data-act]"); if (!el) return;
  if (el.tagName === "A" || el.tagName === "BUTTON") ev.preventDefault();
  if (el.tagName === "INPUT" && el.type === "checkbox") { /* toggle-archived */ }
  const fn = ACTIONS[el.dataset.act] || GEN[el.dataset.act]; if (fn) run(fn, el, ev);
});
document.addEventListener("submit", async ev => {
  const form = ev.target.closest("form[data-form]"); if (!form) return; ev.preventDefault();
  const fn = FORMS[form.dataset.form]; if (!fn) return;
  const b = form.querySelector("button:not([type=button])"); if (b) { if (b.disabled) return; b.disabled = true; }
  await run(fn, form, ev); if (b && b.isConnected) b.disabled = false;
  UI.typing = false; if (UI.dirty && !(UI.view && EDIT_KINDS.includes(UI.view.kind)) && !document.querySelector("#modal form")) { UI.dirty = false; render(); }
});
document.addEventListener("change", ev => { const el = ev.target.closest("[data-change]"); if (el && CHANGES[el.dataset.change]) run(CHANGES[el.dataset.change], el, ev); });
document.addEventListener("input", ev => {
  const el = ev.target;
  if (el.dataset && el.dataset.filter) { UI.filter[el.dataset.filter] = el.value; render(); return; }
  if (el.closest && el.closest('main form[data-form]')) UI.typing = true;
  const f = el.closest && el.closest('form[data-form="record"], form[data-form="quick"]'); if (f && /amount|currency|rate/.test(el.name || "")) convHint(f);
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && UI.modal) closeModal(); });
document.getElementById("modal").addEventListener("click", ev => { if (ev.target.id === "modal") closeModal(); });
window.addEventListener("hashchange", () => {
  const s = location.hash.slice(1);
  if (s === UI.ignoreHash) { UI.ignoreHash = null; return; }
  if (SECTIONS.some(x => x[0] === s) && (s !== UI.section || UI.view)) { UI.section = s; UI.view = null; UI.stack = []; render(); }
});

/* ---------- start ---------- */
(function start() {
  applyTheme(themeNow());
  const s = location.hash.slice(1); if (SECTIONS.some(x => x[0] === s)) UI.section = s;
  Store.onChange = () => { if (UI.typing) { UI.dirty = true; return; } if ((UI.view && EDIT_KINDS.includes(UI.view.kind)) || (UI.modal && document.querySelector("#modal form"))) { UI.dirty = true; return; } render(); };
  render();
  Store.init().catch(e => { console.error(e); Store.mode = "memory"; render(); });
})();


/* ======================= Pencil icons, top bar and bottom dock (Nov 2026) ======================= */
const PICS = ["quayza","dashboard","company","checklists","documents","reports","apply","develop","workforce","operations","visas","offices","investment","budget","bplan","comply","obligations","requests","returns","changes","library","howto","setup"];
function pic(k, cls = "") { return PICS.includes(k) ? `<img class="pic ${cls}" src="${qzIconDir()}/${k}.svg" alt="" draggable="false">` : icon(k); }
const DOCK_ICON = { "Overview": "dashboard", "Application": "apply", "Development": "develop", "Operations": "operations", "Compliance": "comply", "Amendments": "changes", "AI and library": "quayza", "Help": "howto" };
const QZ_MARK = '<svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true"><circle cx="24" cy="24" r="17" fill="none" stroke="#E5E7EB" stroke-width="6"/><path d="M11.98 36.02 A17 17 0 1 1 36.02 36.02" fill="none" stroke="#4F46E5" stroke-width="6" stroke-linecap="round"/><circle cx="39" cy="39" r="4.5" fill="#F97316"/></svg>';
function dockGroups() { return NAV_GROUPS.map(([g, ks]) => [g.replace(/^\d+\s*·\s*/, ""), ks.filter(canSection)]).filter(x => x[1].length); }
function dock() {
  const lab = k => (SECTIONS.find(s => s[0] === k) || [])[1] || k, groups = dockGroups();
  const open = UI.dockGroup ? groups.find(g => g[0] === UI.dockGroup) : null;
  const btn = ([g, ks]) => { const on = ks.includes(UI.section), single = ks.length === 1;
    return `<button class="dk-btn${on ? " on" : ""}${open && open[0] === g ? " open" : ""}" ${single ? `data-act="nav" data-section="${ks[0]}"` : `data-act="dock" data-g="${esc(g)}" aria-expanded="${open && open[0] === g ? "true" : "false"}"`} title="${esc(single ? lab(ks[0]) : g)}">${pic(DOCK_ICON[g] || ks[0])}<span>${esc(g === "AI and library" ? "Quayza" : g)}</span>${single ? "" : `<i class="dk-n">${ks.length}</i>`}</button>`; };
  const panel = open ? `<div class="dk-scrim" data-act="dock-close"></div><div class="dk-panel" role="dialog" aria-label="${esc(open[0])}"><div class="dk-ph"><b>${esc(open[0])}</b><span class="muted small">${open[1].length} functions</span></div><div class="dk-grid">${open[1].map(k => `<a href="#${k}" class="dk-item${k === UI.section ? " on" : ""}" data-act="nav" data-section="${k}">${pic(k)}<span>${esc(lab(k))}</span></a>`).join("")}</div></div>` : "";
  return `${panel}<nav class="dock" aria-label="Sections">${groups.map(btn).join("")}</nav>`;
}
topbar = function () {
  const c = Store.company(), t = themeNow(), lab = (SECTIONS.find(s => s[0] === UI.section) || [])[1] || "", mine = Store.myCompanies();
  return `<div class="topbar"><a class="brand" href="#dashboard" data-act="nav" data-section="dashboard" aria-label="Quayzen home"><img class="qz-logo" src="${qzDark() ? "art/quayzen-logo-dark.svg" : "art/quayzen-logo.svg"}" alt="Quayzen"><span class="qz-clean"><img class="qz-mark" src="art/quayzen-mark-clean.svg" alt=""><span class="qz-word">quayzen</span></span></a>
   <div class="cosel"><select id="cosel" data-change="co-switch" aria-label="Company">${mine.map(x => `<option value="${x.id}"${x.id === Store.cid ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select><span class="role">${esc(ROLES[Store.role()] || "")}${Store.preview ? " (preview)" : ""}${c && c.is_demo ? ' <span class="badge warn">DEMO</span>' : ""}</span></div>
   <div class="crumb">${pic(UI.section, "sm")}<b>${esc(lab)}</b></div>
   <div class="tgroup"><div class="look-seg" role="group" aria-label="Charts and icons style"><button class="${qzLook() !== "pro" ? "on" : ""}" data-act="look" data-v="pencil" aria-pressed="${qzLook() !== "pro"}" title="Hand-drawn charts and icons">Pencil</button><button class="${qzLook() === "pro" ? "on" : ""}" data-act="look" data-v="pro" aria-pressed="${qzLook() === "pro"}" title="Clean charts and icons for presentations">Professional</button></div>${UI.section !== "library" && canSection("library") ? `<button class="btn sm" data-act="nav" data-section="library" title="Ask Quayza, your AI assistant for SEZ rules">${icon("quayza")}<span class="hide-sm">Ask Quayza</span></button>` : ""}
   <button class="iconbtn" data-act="theme" aria-label="Theme: ${t}. Change theme" title="Theme: ${t}">${icon(t === "dark" ? "moon" : t === "light" ? "sun" : "auto")}</button></div></div>`;
};
GEN.dock = el => { UI.dockGroup = UI.dockGroup === el.dataset.g ? null : el.dataset.g; render(); };
GEN["dock-close"] = () => { UI.dockGroup = null; render(); };
{ const _nav = GEN.nav; GEN.nav = el => { UI.dockGroup = null; _nav(el); }; }
document.addEventListener("keydown", e => { if (e.key === "Escape" && UI.dockGroup) { UI.dockGroup = null; render(); } });

/* Show existing demo companies under the new demo name (display only; saved records are not changed) */
{ const _render = render; render = function () { try { (Store.companies || []).forEach(c => { if (c && c.is_demo && /^Lagoon Digital Services/i.test(c.name || "")) c.name = "Demo Company"; }); } catch (e) { } return _render(); }; }
/* Welcome screen: logo and a pencil drawing of Colombo */
{ const _w = welcome; welcome = function () { return _w().replace(/<p class="muted" style="margin-top:-4px">[^<]*<\/p><p>For companies[\s\S]*?<\/p>/, '<p class="muted wl-lead">Port City records, deadlines and filings in one place.</p>').replace(/ <span class="small muted">\((made-up|a made-up)[^<]*<\/span>/g, '').replace(/<p class="small muted">You become the administrator[^<]*<\/p>/, '').replace('<div class="card"><h1>Quayzen</h1>', `<div class="card"><div class="wl-brand"><img class="qz-logo" src="${qzDark() ? "art/quayzen-logo-dark.svg" : "art/quayzen-logo.svg"}" alt="Quayzen"><span class="qz-clean"><img class="qz-mark" src="art/quayzen-mark-clean.svg" alt=""><span class="qz-word">quayzen</span></span></div>`).replace(/<\/div><\/main>\s*$/, '</div><div class="wl-sketch" role="img" aria-label="Pencil sketch of the Colombo skyline from Galle Face"></div></main>'); }; }

/* Look: "pencil" (default) or "pro" (professional layout for presentations). Stored per browser. */
const PENCIL_SET = new Set(["quayza","dashboard","company","checklists","documents","reports","apply","develop","workforce","operations","visas","offices","investment","budget","bplan","comply","obligations","requests","returns","changes","library","howto","setup","ask","sun","moon","auto","menu","xlsx","pdf","docx","download"]);
let QZ_LOOK = (() => { try { return localStorage.getItem("qz.look") === "pro" ? "pro" : "pencil"; } catch (e) { return "pencil"; } })();
function qzLook() { return QZ_LOOK; }
document.documentElement.dataset.look = QZ_LOOK;
GEN.look = el => { QZ_LOOK = el.dataset.v === "pro" ? "pro" : "pencil"; try { localStorage.setItem("qz.look", QZ_LOOK); } catch (e) { } document.documentElement.dataset.look = QZ_LOOK; render(); toast(QZ_LOOK === "pro" ? "Professional layout: clean charts and icons." : "Pencil layout: hand-drawn charts and icons.", "info"); };
ICON_PATHS.operations = "M3 8h18v12H3V8Zm6 0V5h6v3M3 13h18M11 12h2v3h-2z";
ICON_PATHS.comply = "M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3Zm-3.5 9 2.5 2.5 4.5-5";

/* ---------- SEZ wording (display layer; saved data, form logic and official Commission forms are unchanged) ---------- */
const SEZ_RE = /(?:Colombo )?Port City(?: Colombo)?(?! Economic)/g;
function sez(t) { return typeof t === "string" && t.indexOf("Port City") > -1 ? t.replace(SEZ_RE, "SEZ") : t; }
function sezDeep(o) { if (typeof o === "string") return sez(o); if (Array.isArray(o)) return o.map(sezDeep); if (o && typeof o === "object") { const r = {}; for (const k in o) r[k] = sezDeep(o[k]); return r; } return o; }
function sezNode(root) {
  if (!root) return;
  if (root.nodeType === 3) { const p = root.parentNode; if (p && !/^(TEXTAREA|SCRIPT|STYLE)$/.test(p.nodeName) && !(p.isContentEditable)) { if (p.nodeName === "OPTION" && !p.hasAttribute("value")) p.setAttribute("value", p.textContent); const n = sez(root.nodeValue); if (n !== root.nodeValue) root.nodeValue = n; } return; }
  if (root.nodeType !== 1 || /^(TEXTAREA|SCRIPT|STYLE)$/.test(root.nodeName)) return;
  root.querySelectorAll && root.querySelectorAll("option:not([value])").forEach(o => { if (o.textContent.indexOf("Port City") > -1) o.setAttribute("value", o.textContent); });
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.indexOf("Port City") > -1 ? 1 : 3 });
  const list = []; while (w.nextNode()) list.push(w.currentNode); list.forEach(sezNode);
  [root].concat(root.querySelectorAll ? [...root.querySelectorAll("[title],[aria-label],[placeholder],[alt]")] : []).forEach(el => ["title", "aria-label", "placeholder", "alt"].forEach(a => { const v = el.getAttribute && el.getAttribute(a); if (v && v.indexOf("Port City") > -1) el.setAttribute(a, sez(v)); }));
}
new MutationObserver(ms => ms.forEach(m => { if (m.type === "characterData") sezNode(m.target); else m.addedNodes.forEach(sezNode); })).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
document.addEventListener("DOMContentLoaded", () => sezNode(document.body)); sezNode(document.body);
{ const t = document.title; if (t) document.title = sez(t); }

/* ---------- Theme-aware pencil icons and logo ---------- */
function qzDark() { const t = themeNow(); return t === "dark" || (t === "system" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); }
function qzIconDir() { return qzLook() === "pro" ? "icons-pro" : (qzDark() ? "icons-dark" : "icons"); }
function qzSyncDark() { document.documentElement.dataset.dark = qzDark() ? "1" : "0"; }
qzSyncDark();
{ const _r = render; render = function () { qzSyncDark(); return _r(); }; }
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => render()); } catch (e) { }

/* ---------- Visual helpers: reminder icons and the licence countdown ring ---------- */
function remIcon(kind) {
  const k = String(kind || "");
  return /obligation/i.test(k) ? "obligations" : /request/i.test(k) ? "requests" : /visa|permit|passport/i.test(k) ? "visas" : /licence|license/i.test(k) ? "comply"
    : /return/i.test(k) ? "returns" : /budget/i.test(k) ? "budget" : /investment|fdi|funding/i.test(k) ? "investment" : /office|lease/i.test(k) ? "offices"
    : /checklist/i.test(k) ? "checklists" : /document/i.test(k) ? "documents" : /employee|staff|position/i.test(k) ? "workforce" : "dashboard";
}
function licRing(lic) {
  if (!lic || !lic.expiry_date) return "";
  const left = daysUntil(lic.expiry_date), a = lic.issue_date ? new Date(lic.issue_date) : null, b = new Date(lic.expiry_date);
  const total = a ? Math.max(1, Math.round((b - a) / 864e5)) : 365, used = Math.min(100, Math.max(0, Math.round((total - left) / total * 100)));
  const tone = left < 0 ? "bad" : left <= 60 ? "warn" : "ok";
  return `<div class="lring ${tone}" style="--p:${used}" role="img" aria-label="${left < 0 ? -left + " days past expiry" : left + " days until the licence expires"}"><div><b>${Math.abs(left)}</b><span>${left < 0 ? "days over" : "days left"}</span></div></div>`;
}

/* Quayza: the AI assistant uses the sparkle icon wherever the library icon showed */
{ const _pic = pic; pic = function (k, cls) { return _pic(k === "library" ? "quayza" : k, cls); }; }
