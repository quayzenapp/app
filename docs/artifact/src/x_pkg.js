/* ===== x_pkg.js ===== */
/* One integrated product, sold in packages. Core is always included; the six packages follow the life of a Port City company:
   1 Application -> 2 Development (Primary BSI / developers) -> 3 Operations -> 4 Compliance and reporting -> 5 Amendments, with 6 AI and library alongside.
   Which packages a company has is set in Setup > Product plan. In this browser version that is a screen setting, not a licence check. */

const PACKAGES = [
  { k: "core", n: "Core workspace", always: true, sections: ["dashboard", "company", "checklists", "documents", "reports", "howto", "setup"], d: "Dashboard, company profile, documents, checklists, reports, roles and audit history. Included in every plan." },
  { k: "apply", n: "1. Application", sections: ["apply"], d: "Licence application for an Authorised Person or BSI: Schedule I and the Commission's other forms filled for you, business plan builder, supporting documents checklist, second-person approval and the submission record." },
  { k: "develop", n: "2. Development", sections: ["develop"], d: "For Primary BSI developers and plot lessees: planning clearance, development permit and certificate of conformity, DCR Schedule I and Supplementary Forms 01-06, CAA height clearance, and the fee calculator." },
  { k: "operate", n: "3. Operations", sections: ["workforce", "visas", "offices", "investment", "budget", "bplan"], d: "Workforce, visas under the Commission's visa procedure, offices, investment and funding, budget, and progress against the business plan." },
  { k: "comply", n: "4. Compliance and reporting", sections: ["obligations", "requests", "returns"], d: "Licence conditions and obligations, Commission requests and responses, and the annual return on the Commission's form." },
  { k: "change", n: "5. Amendments", sections: ["changes"], d: "Notices of change (Schedule III and Form III), renewal (Schedule V), the Schedule IV annual return and surrender (Schedule VI and Form V)." },
  { k: "ai", n: "6. AI and library", sections: ["library"], d: "The Port City library of Acts, regulations, gazettes and forms, and questions answered from it with sources." },
];
const pkgOf = s => (PACKAGES.find(p => p.sections.includes(s)) || PACKAGES[0]).k;
const pkgOn = k => { const p = PACKAGES.find(x => x.k === k); if (!p || p.always) return true; const set = Store.setting("packages", null); return !set || set[k] !== false; };
const _canSection = canSection;
canSection = function (s) { return _canSection(s) && pkgOn(pkgOf(s)); };

/* Setup > Product plan */
const _setup = PAGES.setup;
PAGES.setup = () => {
  const admin = Store.role() === "admin" && !Store.preview, set = Store.setting("packages", null) || {};
  const card = `<div class="card"><h3>Product plan</h3><p class="small muted">Quayzen is one product sold in packages. Areas outside the plan are hidden from the menu; their data is kept. In this browser version this is a screen setting for packaging, not a licence check.</p>
   <div class="ogrid">${PACKAGES.map(p => `<label class="card tile pkg${pkgOn(p.k) ? " on" : ""}"><span class="row"><input type="checkbox" data-change="pkg-set" data-k="${p.k}"${pkgOn(p.k) ? " checked" : ""}${p.always || !admin ? " disabled" : ""}> <b>${esc(p.n)}</b>${p.always ? ' <span class="chip">always included</span>' : ""}</span><span class="small muted">${esc(p.d)}</span><span class="small">${p.sections.map(s => esc((SECTIONS.find(x => x[0] === s) || [])[1] || s)).join(" · ")}</span></label>`).join("")}</div>
   ${admin ? "" : '<p class="small muted">Only an administrator can change the plan.</p>'}</div>`;
  return _setup().replace('<div class="card">', card + '<div class="card">');
};
CHANGES["pkg-set"] = async el => { const c = Store.company(), s = Object.assign({}, c.settings || {}), p = Object.assign({}, s.packages || {}); p[el.dataset.k] = el.checked; s.packages = p; await Store.saveCompany({ settings: s }); await Store.audit("companies", c.id, "Updated", `Product plan: ${PACKAGES.find(x => x.k === el.dataset.k).n} ${el.checked ? "on" : "off"}`); toast("Plan updated."); render(); };
MODULE_LABELS.development = "Development approvals"; MODULE_LABELS.checklists = "Checklists";

/* ---------- the route for this applicant, by type of business ---------- */
function routeFor(a) {
  const q = a.q || {}, sec = getPath(a, "p2.sectors") || [], T = tefTotals(a), mp = getPath(a, "p6.mp") || {};
  const foreignStaff = T.some(y => y.foreign) || Object.values(mp).some(r => Number((r || {}).nonlocal) > 0);
  const st = [], warn = [];
  st.push({ t: "Licence application", who: "You", pkg: "apply", nav: "apply", forms: ["Schedule I application form", `Technical Evaluation Form (${tefSheet(a) === "primary" ? "Primary BSI sheet" : "AP / Secondary BSI sheet"})`, "Business plan (max 4 pages)", "AP Declaration" + (q.group_sl === "Yes" ? " + Annexure I (parent)" : ""), "UBO Declaration", "Directors and Shareholders form", "Business Profile and KMP form", "Section 64 designation request", ...(isCo(a) ? ["Offshore Company Registration Form (Form I)"] : []), "Supporting documents and processing fee"] });
  st.push({ t: "Approval in Principle", who: "Commission", forms: ["Letter of Approval in Principle (at the Commission's discretion)"] });
  st.push({ t: "Regulatory clearances", who: "Commission", forms: ["The Commission obtains clearances from other regulators", ...(q.regulated !== "No" ? ["Your own licences from the relevant regulator (AP Declaration, clause (f))"] : [])] });
  st.push({ t: "Licence issued", who: "Commission", forms: ["AP licence (valid 12 months)", "Investor Agreement", ...(isCo(a) && a.origin === "Foreign" ? ["Certificate of Registration (offshore company)"] : [])] });
  if (a.app_type === "Primary BSI") st.push({ t: "Development approvals, for each plot", who: "You", pkg: "develop", nav: "develop", forms: ["Planning clearance: DCR Schedule I, Supplementary Forms 01 (if not the lessee), 02, 03, 04, CAA height clearance (high-rise), fee 20% of USD 1.50 x GFA", "Development permit: drawings with third-party review, Supplementary Forms 05 and 06, fee 50%", "Certificate of conformity: fee 30% (process not in the supplied documents)"] });
  if (foreignStaff) st.push({ t: "Visas for foreign staff", who: "You", pkg: "operate", nav: "visas", forms: ["Register the AP with the Department of Immigration and Emigration", "Landing endorsement request through the Commission", "Resident visa within 30 days of arrival", "Monthly visa report to the Commission"] });
  st.push({ t: "Operate and report", who: "You", pkg: "comply", nav: "returns", forms: ["Annual return", "Monthly visa report, EPF/ETF and quarterly tax receipts (visa procedure)", "Notices of change within 30 days; renewal two months before expiry"] });
  if (a.app_type === "Duty Free BSI") warn.push("Duty Free BSI: the Duty Free BSI regulations and guidelines (Gazettes 2381/24 and 2475/28) also apply. They are in the library; their forms were not supplied.");
  if (sec.includes("Banking") || sec.includes("Non-banking financial business")) warn.push("Banking or financial business: the Offshore Banking Regulations (Gazettes 2394/66 and 2394/67) may apply. Name the services under section 46 of the Act in Schedule I Part VI(b), and give the home regulator in Part II(h).");
  if (sec.includes("Gaming")) warn.push("You ticked 'Gaming' as a sector. The AP Declaration (clause (g)) says the applicant will not carry on gambling, betting, wagering or casino operations. Take legal advice before going further.");
  if (q.regulated === "To be confirmed") warn.push("Whether an activity is regulated is still 'to be confirmed'. Confirm with your legal adviser; regulated activities need the regulator's licence as well.");
  return { st, warn };
}
function routeCard(a) {
  const R = routeFor(a);
  return `<div class="card"><h3>Your route, based on what you have entered</h3><p class="small muted">The steps and forms change with the application type, sectors, staff plans and your answers. Grey steps are done by the Commission.</p>
   <div class="route">${R.st.map((s, i) => `<div class="rstep ${s.who === "You" ? "you" : "them"}"><div class="rh"><span class="rn">${i + 1}</span><b>${esc(s.t)}</b><span class="chip">${esc(s.who)}</span>${s.pkg && !pkgOn(s.pkg) ? '<span class="chip">not in your plan</span>' : ""}</div><ul class="small">${s.forms.map(f => `<li>${esc(f)}</li>`).join("")}</ul>${s.nav && canSection(s.nav) && s.nav !== "apply" ? `<button class="link small" data-act="nav" data-section="${s.nav}">Open</button>` : ""}</div>`).join("")}</div>
   ${R.warn.map(w => `<p class="note small">${esc(w)}</p>`).join("")}</div>`;
}

