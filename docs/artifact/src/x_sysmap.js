/* ===== x_sysmap.js ===== */
/* How It Works › System diagram: one picture of the whole product.
   Stages as columns (Application with its Development branch, Operations, Compliance, Amendments), the core workspace underneath,
   what comes in at the top and what goes out at the bottom. Numbered lines show where information moves from one part to another
   automatically; the list under the diagram explains each one. Every box opens its screen. Parts outside the company's plan are greyed. */

const SYS_W = 1276, SYS_H = 762, SYS_COL = [20, 342, 664, 986], SYS_CW = 270, SYS_BW = 242, SYS_BH = 44;
const SYS_THEME = { apply: ["#f1efff", "#6c5cf2"], develop: ["#eaf3fd", "#2f78d0"], operate: ["#e8f7f2", "#1f9e86"], comply: ["#fff5e3", "#d98b0b"], change: ["#fdeef1", "#e0476e"], core: ["#f3f3fa", "#5a5a7a"], ai: ["#eeebff", "#5546e0"] };
const SYS_BOXES = [
  // [id, column, y, title, detail, section, package]
  ["a1", 0, 114, "Licence application", "Schedule I and the Commission's forms", "apply", "apply"],
  ["a2", 0, 168, "Business plan builder", "Sections, tables, Word and PDF", "apply", "apply"],
  ["a3", 0, 222, "Supporting documents", "Uploads, formats, Commission requests", "apply", "apply"],
  ["a4", 0, 276, "Approval and submission", "Second person approves; you submit", "apply", "apply"],
  ["d1", 0, 382, "Development projects", "Primary BSI and plot lessees", "develop", "develop"],
  ["d2", 0, 436, "DCR forms and CAA clearance", "Schedule I, Forms 01-06, height", "develop", "develop"],
  ["d3", 0, 490, "Stages and fees", "Clearance → permit → conformity", "develop", "develop"],
  ["o1", 1, 114, "Workforce", "Staff, directors and shareholders", "workforce", "operate"],
  ["o2", 1, 184, "Visas and permits", "Visa procedure, landing endorsement", "visas", "operate"],
  ["o3", 1, 254, "Office space", "Port City and designated locations", "offices", "operate"],
  ["o4", 1, 324, "Investment and funding", "FDI and other funding records", "investment", "operate"],
  ["o5", 1, 394, "Budget", "Planned against actual spending", "budget", "operate"],
  ["o6", 1, 464, "Business plan reference", "Plan against actual progress", "bplan", "operate"],
  ["k1", 2, 114, "Licences and obligations", "Conditions, deadlines, owners", "obligations", "comply"],
  ["k2", 2, 254, "Commission requests", "Requests, replies and due dates", "requests", "comply"],
  ["k3", 2, 394, "Annual returns", "The Commission's 2026 form", "returns", "comply"],
  ["m1", 3, 114, "Licence renewal", "Schedule V", "changes", "change"],
  ["m2", 3, 254, "Surrender", "Schedule VI and Form V", "changes", "change"],
  ["m3", 3, 394, "Schedule IV annual return", "Regulations format", "changes", "change"],
  ["m4", 3, 464, "Notice of change", "Schedule III and Form III", "changes", "change"],
];
const SYS_CORE = [["Company profile", "company"], ["Documents and formats", "documents"], ["Checklists", "checklists"], ["Dashboard, reminders", "dashboard"], ["Reports", "reports"], ["Roles, approvals, audit", "setup"], ["Quayza (AI)", "library"]];
const SYS_LINKS = [
  [1, "On licence issue, the set-up step copies the company profile, licence record, directors and shareholders, and the office into Operations.", "a4:r", "o1:l"],
  [2, "The application's business plan and projections fill the business plan reference, and stay linked until a second person checks and locks it.", "a2:r", "o6:l"],
  [3, "Conditions in the Approval in Principle letter and the licence are recorded as obligations, with the source and a review flag.", "top"],
  [4, "A Primary BSI application adds the development approvals route: planning clearance, development permit and certificate of conformity.", "a4:b", "d1:t"],
  [5, "Staff numbers, office space and investment records give the suggested figures for the annual return. Each figure is checked before approval.", "o4:r", "k3:l"],
  [6, "Licence dates set the renewal reminder (60 days before expiry) and the Schedule V application.", "k1:r", "m1:l"],
  [7, "The same register figures are suggested for the Schedule IV annual return when the Commission asks for that format.", "k3:r", "m3:l"],
  [8, "Changes to directors, shareholders or the office address are prepared as a notice of change, due within 30 days.", "bottom"],
];
function sysBox(id) { const b = SYS_BOXES.find(x => x[0] === id); const x = SYS_COL[b[1]] + 14, y = b[2]; return { x, y, cx: x + SYS_BW / 2, cy: y + SYS_BH / 2, r: x + SYS_BW, b: y + SYS_BH }; }
function sysPt(s) { const [id, side] = s.split(":"), b = sysBox(id); return side === "r" ? [b.r, b.cy] : side === "l" ? [b.x, b.cy] : side === "t" ? [b.cx, b.y] : [b.cx, b.b]; }
function sysPath(l) {
  if (l[2] === "top") { const a = sysBox("a1"), k = sysBox("k1"), y = 62, ax = a.r - 36, kx = k.r - 36; return { d: `M${ax},${a.y} V${y + 8} Q${ax},${y} ${ax + 8},${y} H${kx - 8} Q${kx},${y} ${kx},${y + 8} V${k.y}`, m: [(ax + kx) / 2, y] }; }
  if (l[0] === 4) { const a = sysBox("a4"), d = sysBox("d1"), x = a.r - 36; return { d: `M${x},${a.b} V${d.y}`, m: [x, 338] }; }
  if (l[2] === "bottom") { const x0 = SYS_COL[1] + SYS_CW / 2, m = sysBox("m4"), y = 556; return { d: `M${x0},540 V${y - 8} Q${x0},${y} ${x0 + 8},${y} H${m.cx - 8} Q${m.cx},${y} ${m.cx},${y - 8} V${m.b}`, m: [(x0 + m.cx) / 2, y] }; }
  const [x1, y1] = sysPt(l[2]), [x2, y2] = sysPt(l[3]);
  if (x1 === x2) return { d: `M${x1},${y1} V${y2}`, m: [x1, (y1 + y2) / 2] };
  const dx = Math.max(24, (x2 - x1) / 2); return { d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, m: [(x1 + x2) / 2, (y1 + y2) / 2] };
}
function sysDiagramHTML() {
  const T = (x, y, s, o = "") => `<text x="${x}" y="${y}" ${o}>${esc(s)}</text>`, on = k => pkgOn(k), w = canSection;
  const frame = (x, y, h, title, pkg) => { const [f, c] = SYS_THEME[pkg]; return `<g class="sfr${on(pkg) ? "" : " off"}"><rect x="${x}" y="${y}" width="${SYS_CW}" height="${h}" rx="12" fill="${f}" stroke="${c}" stroke-opacity=".35"/>${T(x + 14, y + 22, title, `class="sh" fill="${c}"`)}${on(pkg) ? "" : T(x + SYS_CW - 14, y + 22, "not in your plan", 'class="sn" text-anchor="end"')}</g>`; };
  const box = b => { const [id, , , t, d, s, pkg] = b, p = sysBox(id), c = SYS_THEME[pkg][1], ok = on(pkg) && w(s);
    return `<g class="sbx${ok ? "" : " off"} n-${id}" data-act="sys-go" data-s="${s}" role="button" tabindex="0" aria-label="${esc(t)}"><title>${esc(t)}: ${esc(d)}${ok ? " - click to open" : ""}</title><rect x="${p.x}" y="${p.y}" width="${SYS_BW}" height="${SYS_BH}" rx="8" fill="#fff" stroke="${c}"/><rect x="${p.x}" y="${p.y}" width="5" height="${SYS_BH}" rx="2" fill="${c}"/>${T(p.x + 14, p.y + 19, t, 'class="st"')}${T(p.x + 14, p.y + 35, d, 'class="sd"')}</g>`; };
  const cbw = (SYS_W - 40 - 28 - 6 * 10) / 7;
  const core = SYS_CORE.map(([t, s], i) => { const x = 34 + i * (cbw + 10), ai = s === "library", [f, c] = SYS_THEME[ai ? "ai" : "core"], ok = (!ai || on("ai")) && w(s);
    return `<g class="sbx${ok ? "" : " off"}" data-act="sys-go" data-s="${s}" role="button" tabindex="0" aria-label="${esc(t)}"><title>${esc(t)}${ok ? " - click to open" : ""}</title><rect x="${x}" y="634" width="${cbw}" height="40" rx="8" fill="${ai ? f : "#fff"}" stroke="${c}"/>${T(x + cbw / 2, 659, t, 'class="st" text-anchor="middle"')}</g>`; }).join("");
  const links = SYS_LINKS.map(l => { const p = sysPath(l); return `<g class="slk p-${l[0]}"><path d="${p.d}" marker-end="url(#sarr)"/><circle cx="${p.m[0]}" cy="${p.m[1]}" r="11"/>${T(p.m[0], p.m[1] + 4, String(l[0]), 'text-anchor="middle"')}</g>`; }).join("");
  const drops = [[SYS_COL[0] + SYS_CW / 2, 540], [SYS_COL[1] + SYS_CW / 2, 540], [SYS_COL[2] + SYS_CW / 2, 540], [SYS_COL[3] + SYS_CW / 2, 540]].map(([x, y]) => `<path class="sdrop" d="M${x},${y} V600"/>`).join("");
  const strip = (y, label, items, cls) => `<g class="${cls}"><rect x="20" y="${y}" width="${SYS_W - 40}" height="42" rx="10"/>${T(36, y + 26, label, 'class="sh"')}${T(SYS_W - 36, y + 26, items, 'class="sd2" text-anchor="end"')}</g>`;
  const svg = `<svg class="sysd-svg" viewBox="0 0 ${SYS_W} ${SYS_H}" role="img" aria-label="How Quayzen works: stages, the core workspace and how information moves between them">
    <defs><marker id="sarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6c5cf2"/></marker></defs>
    ${strip(8, "Comes in", "Typed in  ·  Excel import  ·  Uploaded files (PDF, images)  ·  The Commission's Word formats  ·  Acts, regulations and forms in the library", "sin")}
    ${frame(SYS_COL[0], 78, 252, "1 · Application", "apply")}${frame(SYS_COL[0], 346, 194, "2 · Development (Primary BSI)", "develop")}
    ${frame(SYS_COL[1], 78, 462, "3 · Operations", "operate")}${frame(SYS_COL[2], 78, 462, "4 · Compliance and reporting", "comply")}${frame(SYS_COL[3], 78, 462, "5 · Amendments", "change")}
    ${drops}<g class="sfr core"><rect x="20" y="600" width="${SYS_W - 40}" height="90" rx="12" fill="${SYS_THEME.core[0]}" stroke="${SYS_THEME.core[1]}" stroke-opacity=".35"/>${T(34, 622, "Core workspace · used by every stage, with 6 · AI and library", `class="sh" fill="${SYS_THEME.core[1]}"`)}${core}</g>
    ${SYS_BOXES.map(box).join("")}${links}
    ${strip(706, "Goes out", "Commission forms filled in (PDF, Word, Excel)  ·  Letters and drafts  ·  Reports  ·  Reminders  ·  Audit history", "sout")}
    ${T(SYS_W / 2, 760, "Nothing is submitted, signed or sent by Quayzen. People review, sign and submit.", 'class="sn" text-anchor="middle"')}</svg>`;
  return `<div class="card sysd"><h2>How Quayzen works</h2><p class="muted small">One product in stages. A company can start at the application, or at Operations if it already holds a licence. Each stage is a package that can be switched on or off; the core workspace is always included. Numbered lines show where information moves on its own. Click a box to open it.</p>
    <div class="sysd-wrap">${svg}</div>
    <div class="sysd-legend"><h3>Where information moves automatically</h3><ol>${SYS_LINKS.map(l => `<li class="lk-${l[0]}"><span class="num">${l[0]}</span>${esc(l[1])}</li>`).join("")}</ol>
    <h3>Shared by every stage</h3><ul class="sysd-shared small"><li><b>Company profile and people.</b> Entered once, used in every form and letter.</li><li><b>Documents register.</b> Every uploaded file, with versions, linked to the record it supports. Passport, UBO and visa files are restricted.</li>
    <li><b>Checklists and reminders.</b> Due dates from every stage appear on the dashboard.</li><li><b>Roles, second-person approval and audit history.</b> Who can see and change what, who approved it, and every change.</li>
    <li><b>Quayza (AI assistant).</b> Answers from the Acts, regulations, gazettes and forms, with the source. Answers are a starting point, not legal advice.</li></ul>
    <h3>What kind of information it is</h3><p class="small">Each record shows whether it was entered by hand, imported, copied from another part of Quayzen, calculated or reviewed. Commission form items, legal requirements, licence conditions, business plan projections and good-practice controls are kept apart, and projections are never treated as commitments.</p></div></div>`;
}
ACTIONS["sys-go"] = el => { const s = el.dataset.s; if (!canSection(s)) return toast("This part is not in your plan or your role cannot open it.", "info"); navTo(s); };

const _howtoSys = PAGES.howto;
PAGES.howto = () => {
  const tab = curTab("howto", "system");
  if (tab !== "system") return _howtoSys().replace(/<div class="tabs" role="tablist">/, `<div class="tabs" role="tablist"><button role="tab" class="tab" aria-selected="false" data-act="tab" data-section="howto" data-tab="system">System diagram</button>`);
  UI.tab.howto = "map"; const base = _howtoSys(); UI.tab.howto = "system";
  const i = base.indexOf('<div class="tabs" role="tablist">'), head = base.slice(0, i);
  const tabs = tabsHTML("howto", [["system", "System diagram"], ["map", "Product map"], ["routes", "Processes"], ["flow", "How it fits together"], ["guide", "Guide"]]);
  return head + tabs + sysDiagramHTML();
};

