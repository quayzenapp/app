/* ===== x_flow.js ===== */
/* Flow diagrams in How It Works: the product map (packages), the process routes, and the "how it fits together" diagram. */

/* New boxes in the "how it all fits together" diagram */
(() => {
  const ins = (row, at) => { const i = FLOW.findIndex(n => n[0] === at); FLOW.splice(i + 1, 0, row); };
  ins(["application", 1, "Licence application", "Schedule I details, people, projections, business plan and supporting documents, entered once and used in every Commission form.", "apply", ["fill", "review", "remind"]], "circulars");
  ins(["devproj", 1, "Development projects", "Plots, qualified persons, conceptual plan, floor areas and stage records for planning clearance and development permit.", "develop", ["fill", "calc", "remind"]], "application");
  ins(["checks", 1, "Checklists", "Process checklists with a status and stored document for each item, one-off or by period.", "checklists", ["remind", "dash"]], "docs");
  ins(["fill", 2, "Form filling", "Fills the Commission's own PDF, Word and Excel forms field by field, reads every value back, and makes Word and PDF copies.", "apply", ["forms"]], "calc");
  ins(["forms", 3, "Commission forms and packs", "Schedule I, the Technical Evaluation Form, declarations, DCR forms, CAA, visa and licence-change forms, and the business plan.", "apply", ["sign"]], "dash");
  const v = FLOW.find(n => n[0] === "visas"); v[3] = "Each person's progress through the Commission's visa procedure, with SOP deadlines, dependents, the request form and the monthly report."; v[5] = ["remind", "fill", "reports"];
  FLOW.find(n => n[0] === "papers")[5].push("application"); FLOW.find(n => n[0] === "manual")[5].push("application", "devproj", "checks");
  const ch = ["changes", 1, "Licence changes", "Notices of change, renewal, the Schedule IV return and surrender, each with its own approval.", "changes", ["fill", "review", "remind"]]; ins(ch, "requests");
})();

function productMapHTML() {
  return `<div class="card"><h3>The product: one workspace, six packages</h3><p class="small muted">Packages follow the life of a Port City company. Core is always included. Click a module to open it.</p>
   <div class="pmap">${PACKAGES.map(p => `<div class="pcol${pkgOn(p.k) ? "" : " off"}"><div class="ph">${esc(p.n)}${pkgOn(p.k) ? "" : ' <span class="chip">not in plan</span>'}</div><p class="small muted">${esc(p.d)}</p>${p.sections.map(s => { const l = (SECTIONS.find(x => x[0] === s) || [])[1] || s; return canSection(s) ? `<button class="fn" data-act="nav" data-section="${s}">${esc(l)}</button>` : `<span class="fn dim">${esc(l)}</span>`; }).join("")}</div>`).join("")}</div></div>`;
}
const ROUTES = {
  licence: { t: "Licence application (AP and BSI)", src: "Application process page; Schedule I; required documents list", s: [["Prepare the application", "You", "Schedule I, Technical Evaluation Form, business plan, declarations, profile forms, supporting documents, fee"], ["Second-person approval", "You", "A fixed copy is kept"], ["Apply online for preliminary review", "You", "Submit through the portal or applications@portcity.gov.lk"], ["Approval in Principle", "Commission", "At its discretion"], ["Regulatory clearances", "Commission", "Single window with other regulators"], ["Licence issued", "Commission", "12 months; Investor Agreement; Certificate of Registration for offshore companies"], ["Set up compliance records", "You", "Profile, licence, people, office, business plan reference, obligations"]] },
  develop: { t: "Development approvals (Primary BSI and plot lessees)", src: "Development Approvals page; DCR Regulations No. 01 of 2023", s: [["Planning clearance", "You", "DCR Schedule I; Forms 01 (if not lessee), 02, 03, 04; CAA if high-rise; fee 20%"], ["Planning clearance issued", "Commission", ""], ["Development permit", "You", "Drawings and third-party review; Forms 05, 06; fee 50%"], ["Development permit issued", "Commission", ""], ["Construction and supervision", "You", "Qualified persons supervise until the certificate of conformity"], ["Certificate of conformity", "Commission", "Fee 30%; process not in the supplied documents"]] },
  lifecycle: { t: "Licence life cycle", src: "Schedules III-VI; Offshore Forms III and V; Fees Regulations", s: [["Operate and keep records", "You", "Workforce, visas, offices, investment, budget"], ["Report", "You", "Annual return; monthly visa report; Commission requests"], ["Notify changes within 30 days", "You", "Schedule III (+ Form III for offshore companies)"], ["Renew every year", "You", "Schedule V; fee two months before expiry"], ["Surrender (if leaving)", "You", "Schedule VI (+ Form V)"]] },
};
function routeHTML(r) { return `<div class="card"><h3>${esc(r.t)}</h3><p class="small muted">${esc(r.src)}</p><div class="route compact">${r.s.map(([t, who, d], i) => `<div class="rstep ${who === "You" ? "you" : "them"}"><div class="rh"><span class="rn">${i + 1}</span><b>${esc(t)}</b><span class="chip">${esc(who)}</span></div>${d ? `<div class="small">${esc(d)}</div>` : ""}</div>`).join("")}</div></div>`; }
const _howto2 = PAGES.howto;
PAGES.howto = () => {
  const tab = curTab("howto", "map"), tabs = tabsHTML("howto", [["map", "Product map"], ["routes", "Processes"], ["flow", "How it fits together"], ["guide", "Guide"]]);
  const full = _howto2(), i = full.indexOf('<div class="cols">'), head = full.slice(0, full.indexOf("</div></div>") + 12), guide = full.slice(i).replace(flowHTML(), "");
  const body = tab === "map" ? productMapHTML() : tab === "routes" ? routeHTML(ROUTES.licence) + routeHTML(ROUTES.develop) + `<div class="card"><h3>Visas for foreign staff</h3><p class="small muted">Visa SOP</p>${visaFlow()}</div>` + routeHTML(ROUTES.lifecycle) : tab === "flow" ? flowHTML() : guide;
  return head + tabs + body;
};

