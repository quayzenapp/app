/* ===== overviews.js ===== */
/* Overview screens for the remaining sections: same pattern everywhere —
   highlight cards, simple charts, the key items to act on, and a quick-entry panel. */


function ovHead(title, intro, acts = "") { return `<div class="head"><div class="t"><h1>${esc(title)}</h1><p class="muted">${esc(intro)}</p></div>${acts ? `<div class="acts">${acts}</div>` : ""}</div>`; }
const donutMany = (rows, center, fmt) => { rows = rows.filter(r => r.value > 0).sort((a, b) => b.value - a.value); if (rows.length > 4) rows = [...rows.slice(0, 3), { label: "Other", value: rows.slice(3).reduce((t, r) => t + r.value, 0) }]; return donut(rows, center, fmt); };

/* ---------- Company ---------- */
const PROFILE_KEYS = ["name", "licence_number", "register_address", "legal_form", "business_sector", "designation_type", "registration_no", "country_of_incorporation", "incorporation_date", "operations_commenced", "registered_address", "tin", "roc_filing_info", "main_licence_id", "contact_name", "contact_email", "contact_phone", "signatory_name"];
function companyOverview() {
  const c = Store.company(), miss = PROFILE_KEYS.filter(k => !c[k]), done = PROFILE_KEYS.length - miss.length;
  const people = Store.list("people").filter(p => !p.ceased_date), ubo = Store.list("ubo"), lic = c.main_licence_id ? Store.get("licences", c.main_licence_id) : null;
  const w = Store.can("company", "write");
  const sh = people.filter(p => p.shareholding_pct).map(p => ({ label: p.full_name, value: Number(p.shareholding_pct) }));
  return ovHead("Company profile", "The details used across Quayzen: in the annual return, in responses to the Commission and in reports.", (w ? '<button class="btn p" data-act="reg-paste">Paste from the public register</button><button class="btn" data-act="company-edit">Edit all details</button>' : ""))
  + registerCard(c, lic)
  + hlCards([{ value: pct(done, PROFILE_KEYS.length) + "%", label: "Profile complete", sub: `${done} of ${PROFILE_KEYS.length} key details`, kind: miss.length ? "warn" : "" },
    { value: lic ? `<span class="mono" style="font-size:15px">${esc(lic.number || "Recorded")}</span>` : "Not set", label: "Main licence", sub: lic ? `${lic.status}${lic.expiry_date ? ", expires " + fmtDate(lic.expiry_date) : ""}` : "set it below", kind: lic ? "" : "warn" },
    { value: people.filter(p => /Director/.test(p.role)).length, label: "Directors" }, { value: people.filter(p => /hareholder/.test(p.role)).length, label: "Shareholders" },
    { value: `${ubo.filter(u => u.declaration_status === "Signed copy on file").length} of ${ubo.length}`, label: "UBO declarations signed", kind: ubo.some(u => u.declaration_status !== "Signed copy on file") ? "warn" : "" }])
  + `<div class="vgrid">
    ${vizCard("Who owns the company (shareholding %)", sh.length ? donutMany(sh, [fmtNum(r2(sh.reduce((t, x) => t + x.value, 0))) + "%", "recorded"], v => fmtNum(r2(v)) + "%") : '<p class="muted small">No shareholdings recorded.</p>')}
    ${vizCard("Beneficial owners (ownership or control %)", hbars(ubo.map(u => ({ label: u.full_name, value: Number(u.ownership_pct) || 0, tip: u.declaration_status })), v => fmtNum(r2(v)) + "%", "No beneficial owners recorded."), "Form_UBO details are visible only to roles allowed to see them.")}
    ${vizCard("Key details", `<ul class="chk">${PROFILE_KEYS.map(k => `<li class="${c[k] ? "ok" : ""}">${c[k] ? "✓" : "○"} ${esc(COMPANY_DEF.fmap[k].label)}</li>`).join("")}</ul>`)}
   </div>
   <div class="card"><h3>Directors and shareholders</h3><div class="pgrid">${people.map(p => `<a href="#" class="pcard" data-act="open" data-type="people" data-id="${p.id}"><b>${esc(p.full_name)}</b><span>${esc(p.role)}</span><span class="muted small">${esc(p.nationality || "")}${p.shareholding_pct ? " · " + fmtNum(p.shareholding_pct) + "%" : ""}</span></a>`).join("") || '<p class="muted">None recorded.</p>'}</div></div>
   ${w && miss.length ? `<details class="card quick" open><summary><b>Complete the missing details</b> <span class="muted small">- only the ${miss.length} detail(s) still blank</span></summary><form class="f" data-form="company-quick" novalidate><div class="grid3f">${miss.map(k => { const f = COMPANY_DEF.fmap[k]; return `<div class="fld${f.type === "textarea" ? " wide" : ""}"><label for="f_${f.name}">${esc(f.label)}</label>${inputFor(f, null)}${f.help ? `<span class="help">${esc(f.help)}</span>` : ""}</div>`; }).join("")}</div><div class="row"><button class="btn p">Save</button></div></form></details>` : ""}
   ${quickForm("people", ["full_name", "person_type", "role", "nationality", "shareholding_pct", "appointed_date"], "Add a director or shareholder", false)}`;
}
FORMS["company-quick"] = async form => {
  const raw = readForm(form), c = Store.company(), patch = {}, errs = [];
  for (const [k, v] of Object.entries(raw)) { const f = COMPANY_DEF.fmap[k]; if (!f) continue; try { const x = cleanValue(f, v); if (x != null) patch[k] = x; } catch (e) { errs.push(e); } }
  if (errs.length) throw errs; if (!Object.keys(patch).length) throw ["Fill in at least one detail."];
  await Store.saveCompany(patch); await Store.audit("companies", Store.cid, "Updated", "Company profile", diff(COMPANY_DEF, c, Object.assign({}, c, patch))); UI.typing = false; toast("Saved."); render();
};

/* ---------- Public register entry ---------- */
function registerChecks(c, lic) {
  const out = [], bsiRec = Store.list("licences").filter(l => l.licence_type === "BSI designation" && l.status === "Active");
  if (!c.licence_number && !lic) out.push(["warn", "No licence number recorded."]);
  if (c.licence_number && lic && lic.number && lic.number !== c.licence_number) out.push(["bad", `The register shows licence ${c.licence_number}, but the main licence record says ${lic.number}.`]);
  if (c.licence_number && !lic) out.push(["warn", "Add the licence as a record under Licences and Obligations, with its expiry date, so renewal reminders work."]);
  if (c.designation_type && c.designation_type !== "Authorised Person only" && !c.bsi_gazette_no) out.push(["warn", "BSI designation recorded without its gazette number."]);
  if (c.designation_type && c.designation_type !== "Authorised Person only" && !bsiRec.length) out.push(["warn", "No active BSI designation record under Licences and Obligations. Add one to track its conditions and KPIs."]);
  if (c.designation_type === "Authorised Person only" && c.bsi_gazette_no) out.push(["warn", "A BSI gazette is recorded but the designation says Authorised Person only."]);
  if (c.register_checked && daysUntil(c.register_checked) < -180) out.push(["info", `The register entry was last checked on ${fmtDate(c.register_checked)}. Check it again.`]);
  return out;
}
function registerCard(c, lic) {
  const ck = registerChecks(c, lic), bsi = { "Primary BSI": "Primary Business of Strategic Importance", "Secondary BSI": "Secondary Business of Strategic Importance", "Duty Free BSI": "Duty Free Business of Strategic Importance", "Authorised Person only": "Not designated (Authorised Person only)" }[c.designation_type] || "—";
  const row = (l, v) => `<div class="rg-row"><dt>${esc(l)}</dt><dd>${v || '<span class="muted">Not recorded</span>'}</dd></div>`;
  return `<div class="card register"><div class="rg-head"><span class="small muted">Public register entry</span>${c.register_checked ? `<span class="small muted">checked ${fmtDate(c.register_checked)}</span>` : ""}</div>
   <div class="rg-name">${esc((c.name || "").toUpperCase())}</div><dl class="rg">
   ${row("Licence number", c.licence_number ? `<span class="mono">${esc(c.licence_number)}</span>` : "")}${row("Address", esc(c.register_address || "").replace(/\n/g, "<br>"))}${row("Legal form", esc(c.legal_form || ""))}${row("Business sector", esc(c.business_sector || ""))}
   ${row("BSI designation", c.designation_type ? esc(bsi) + (c.bsi_gazette_no ? ` (Gazette No. ${c.bsi_gazette_url ? `<a href="${esc(c.bsi_gazette_url)}" target="_blank" rel="noopener">${esc(c.bsi_gazette_no)}</a>` : esc(c.bsi_gazette_no)})` : "") : "")}</dl>
   ${ck.length ? `<div class="rg-checks">${ck.map(([k, t]) => `<div><span class="badge ${k}">${k === "bad" ? "Mismatch" : k === "warn" ? "Check" : "Note"}</span> ${esc(t)}</div>`).join("")}</div>` : '<div class="rg-checks"><div><span class="badge ok">Consistent</span> <span class="small muted">The register entry matches your licence records.</span></div></div>'}</div>`;
}
function parseRegister(text) {
  const lines = String(text).replace(/\r/g, "").split("\n").map(l => l.trim()).filter(Boolean), out = {};
  const get = re => { const l = lines.find(x => re.test(x)); return l ? l.replace(re, "").trim() : null; };
  const name = lines.find(l => !/:/.test(l)); if (name) out.name = name.replace(/^[-•*\s]+/, "");
  const lic = get(/^licen[cs]e\s*(number|no\.?)\s*:\s*/i); if (lic) out.licence_number = lic;
  const addr = get(/^address\s*:\s*/i); if (addr) out.register_address = addr.replace(/\s*,\s*/g, ", ");
  const lf = get(/^legal\s*form\s*:\s*/i); if (lf) out.legal_form = lf;
  const bs = get(/^business\s*sector\s*:\s*/i); if (bs) out.business_sector = bs;
  const bsi = get(/^bsi\s*(designation)?\s*:\s*/i);
  if (bsi != null) {
    out.designation_type = /duty\s*free/i.test(bsi) ? "Duty Free BSI" : /secondary/i.test(bsi) ? "Secondary BSI" : /primary/i.test(bsi) ? "Primary BSI" : /^(none|no|n\/?a|-|not)/i.test(bsi) || !bsi ? "Authorised Person only" : null;
    const g = bsi.match(/(\d{3,5})\s*\/\s*(\d{1,3})/); if (g) out.bsi_gazette_no = `${g[1]}/${g[2]}`;
    const u = bsi.match(/https?:\/\/[^\s)\]]+/); if (u) out.bsi_gazette_url = u[0];
    if (!out.designation_type) out._bsi_text = bsi;
  }
  return out;
}
ACTIONS["reg-paste"] = () => openModal(`<h2>Paste from the public register</h2><p class="muted">Copy your company's entry from the Port City public register and paste it here. You'll see what was read before anything is saved.</p>
  <form class="f" data-form="reg-read"><textarea name="text" rows="9" aria-label="Register entry" placeholder="START TECH LIMITED&#10;Licence Number: CPCEC/2026/0171&#10;Address: ...&#10;Legal Form: Private Company with Limited Liability&#10;Business Sector: Information Technology&#10;BSI Designation: Secondary Business of Strategic Importance (Gazette No. 2483/51)"></textarea>
  <div class="row"><button class="btn p">Read the details</button><button type="button" class="btn" data-act="modal-close">Cancel</button></div></form>`, "wide");
FORMS["reg-read"] = async form => {
  const p = parseRegister(form.text.value), c = Store.company(), keys = ["name", "licence_number", "register_address", "legal_form", "business_sector", "designation_type", "bsi_gazette_no", "bsi_gazette_url"];
  if (!keys.some(k => p[k])) throw ["Nothing could be read. Paste the entry with its labels (Licence Number:, Address:, Legal Form:, ...)."];
  UI.regParsed = p; const lic = c.main_licence_id ? Store.get("licences", c.main_licence_id) : null;
  openModal(`<h2>Check the details</h2><p class="muted">Tick the details to save to the company profile.</p><form class="f" data-form="reg-save"><div class="tw"><table class="t"><thead><tr><th></th><th>Detail</th><th>From the register</th><th>Now in Quayzen</th></tr></thead><tbody>
   ${keys.filter(k => p[k]).map(k => { const same = String(c[k] || "") === String(p[k]); return `<tr><td><input type="checkbox" name="k_${k}"${same ? "" : " checked"} aria-label="Save ${esc(COMPANY_DEF.fmap[k].label)}"></td><td>${esc(COMPANY_DEF.fmap[k].label)}</td><td><b>${esc(p[k])}</b></td><td class="${same ? "muted" : ""}">${same ? "Same" : esc(c[k] || "—")}</td></tr>`; }).join("")}</tbody></table></div>
   ${p._bsi_text ? `<p class="note warn small">The BSI designation "${esc(p._bsi_text)}" was not recognised. Choose it in the profile.</p>` : ""}
   ${p.licence_number && !lic ? `<label class="small"><input type="checkbox" name="mk_lic" checked> Also add licence ${esc(p.licence_number)} under Licences and Obligations and set it as the main licence (add its dates there)</label>` : ""}
   ${p.designation_type && p.designation_type !== "Authorised Person only" && !Store.list("licences").some(l => l.licence_type === "BSI designation") ? `<label class="small"><input type="checkbox" name="mk_bsi" checked> Also add a BSI designation record${p.bsi_gazette_no ? ` (Gazette ${esc(p.bsi_gazette_no)})` : ""}, so its conditions and KPIs can be tracked</label>` : ""}
   <label class="small"><input type="checkbox" name="mk_checked" checked> Record today as the date the register entry was checked</label>
   <div class="row"><button class="btn p">Save</button><button type="button" class="btn" data-act="reg-paste">Back</button></div></form>`, "wide");
};
FORMS["reg-save"] = async form => {
  const p = UI.regParsed || {}, o = readForm(form), c = Store.company(), patch = {};
  Object.keys(o).filter(k => k.startsWith("k_")).forEach(k => { const key = k.slice(2); if (p[key] != null) patch[key] = p[key]; });
  if (o.mk_checked) patch.register_checked = today();
  if (o.mk_lic && p.licence_number) patch.main_licence_id = (await saveRecord("licences", { licence_type: p.designation_type && p.designation_type !== "Authorised Person only" ? "Authorised Person licence" : "Authorised Person licence", title: "Authorised Person licence", number: p.licence_number, status: "Active", approved_activities: p.business_sector || null, notes: "Added from the public register entry. Add the issue and expiry dates." }, null, "Manual")).id;
  if (o.mk_bsi) await saveRecord("licences", { licence_type: "BSI designation", title: { "Primary BSI": "Primary Business of Strategic Importance", "Secondary BSI": "Secondary Business of Strategic Importance", "Duty Free BSI": "Duty Free Business of Strategic Importance" }[p.designation_type] || "BSI designation", number: p.bsi_gazette_no ? "Gazette " + p.bsi_gazette_no : null, status: "Active", designation_category: p.designation_type, notes: p.bsi_gazette_url ? "Gazette: " + p.bsi_gazette_url : null }, null, "Manual");
  if (!Object.keys(patch).length && !o.mk_bsi) throw ["Nothing selected to save."];
  const changes = diff(COMPANY_DEF, c, Object.assign({}, c, patch));
  await Store.saveCompany(patch); await Store.audit("companies", Store.cid, "Updated from public register", "Company profile: details pasted from the public register entry", changes.length ? changes : null);
  UI.regParsed = null; closeModal(); toast("Company profile updated from the register entry."); render();
};

/* ---------- Commission requests ---------- */
function requestsOverview() {
  const r = Store.list("requests"), open = r.filter(x => !["Submitted", "Closed"].includes(x.status));
  const cats = {}; r.forEach(x => cats[x.category || "Not set"] = (cats[x.category || "Not set"] || 0) + 1);
  const due = open.filter(x => x.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const dl = x => { if (!x.deadline) return ""; const d = daysUntil(x.deadline); return `<span class="badge ${d < 0 ? "bad" : d <= 7 ? "warn" : "info"}">${d < 0 ? -d + " days late" : d === 0 ? "due today" : "due in " + d + " days"}</span>`; };
  return ovHead("Commission requests", "Each request from the Commission, from the day it arrives until you record that the response was sent. The system never sends anything itself.")
  + hlFor("requests")
  + `<div class="card"><h3>Where each request is</h3><div class="kanban">${LOOKUPS.request_statuses.map(s => { const xs = r.filter(x => x.status === s); return `<div class="kcol"><div class="kh">${esc(s)} <span class="badge">${xs.length}</span></div>${xs.slice(0, 6).map(x => `<a href="#" class="kcard" data-act="open" data-type="requests" data-id="${x.id}"><b>${esc(x.title)}</b><span class="small muted">${esc(x.category || "")}</span>${["Submitted", "Closed"].includes(s) ? `<span class="small muted">${x.submitted_at ? "sent " + fmtDate(x.submitted_at) : ""}</span>` : dl(x)}<span class="small">${esc(Store.name(x.responsible))}</span></a>`).join("")}${xs.length > 6 ? `<span class="small muted">and ${xs.length - 6} more</span>` : ""}</div>`; }).join("")}</div></div>
   <div class="vgrid">${vizCard("Next deadlines", due.length ? `<ul class="tl">${due.slice(0, 6).map(x => `<li><b>${fmtDate(x.deadline)}</b> ${dl(x)}<div><a href="#" data-act="open" data-type="requests" data-id="${x.id}">${esc(x.title)}</a></div></li>`).join("")}</ul>` : '<p class="muted small">No open deadlines.</p>')}
    ${vizCard("Requests by subject", hbars(Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))))}</div>
   ${quickForm("requests", ["title", "category", "received_date", "deadline", "responsible", "period_or_date", "contact_name", "required_info"], "Log a new request", !r.length)}`;
}

/* ---------- Annual returns ---------- */
function returnsOverview() {
  const rs = Store.list("returns").sort((a, b) => b.period_end.localeCompare(a.period_end)), r = Store.get("returns", UI.params.ar_ov) || rs[0], w = Store.can("returns", "write");
  if (!r) return ovHead("Annual returns", "Prepare the Annual Return from your records, check each line, approve it, and fill the Commission's own PDF.", w ? '<button class="btn p" data-act="ar-new">Start an annual return</button>' : "") + '<div class="card empty">No annual return yet.</div>' + quickForm("fin_entries", ["entry_date", "category", "description", "country_region", "staff_group", "office_id", "original_amount", "original_currency", "usd_rate", "lkr_rate", "rate_date", "rate_source"], "Add a financial record", true);
  const L = r.lines || {}, calc = arCompute(Store, r, Store.company()), tot = AR_TEMPLATE.lines.length;
  const cnt = { v: 0, n: 0, m: 0 }; AR_TEMPLATE.lines.forEach(l => { const s = L[l.key]; if (!s || s.status === "missing") cnt.m++; else if (s.status === "value") cnt.v++; else cnt.n++; });
  const secs = {}; AR_TEMPLATE.lines.forEach(l => { secs[l.section] = secs[l.section] || [0, 0]; secs[l.section][1]++; if (L[l.key] && L[l.key].status !== "missing") secs[l.section][0]++; });
  const val = key => { const s = L[key] && L[key].status === "value" ? L[key] : calc[key]; return s && s.status === "value" ? s.num : null; };
  const revRows = calc.r_revenue && calc.r_revenue.text ? JSON.parse(calc.r_revenue.text) : [];
  const fe = Store.list("fin_entries").filter(x => x.entry_date >= r.period_start && x.entry_date <= r.period_end), byCat = {};
  fe.forEach(x => { if (x.usd_amount != null) byCat[x.category] = (byCat[x.category] || 0) + x.usd_amount; });
  return ovHead("Annual returns", `${r.title}: ${fmtDate(r.period_start)} to ${fmtDate(r.period_end)}.`, `${rs.length > 1 ? `<select data-change="param" data-k="ar_ov" aria-label="Return">${rs.map(x => `<option value="${x.id}"${x.id === r.id ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select>` : ""}<button class="btn p" data-act="ar-open" data-id="${r.id}">Open the return</button>`)
  + `<div class="card">${stepper(["Draft", "Ready for review", "Approved", "Submitted"], r.status)}</div>`
  + hlCards([{ value: pct(tot - cnt.m, tot) + "%", label: "Lines set", sub: `${tot - cnt.m} of ${tot}`, kind: cnt.m ? "warn" : "" },
    { value: "USD " + fmtK(revRows.filter(x => x.currency === "USD").reduce((t, x) => t + x.amount, 0)) + (revRows.some(x => x.currency === "LKR") ? " + LKR " + fmtK(revRows.filter(x => x.currency === "LKR").reduce((t, x) => t + x.amount, 0)) : ""), label: "Revenue (worked out)", sub: `${revRows.length} country row(s)` },
    { value: "USD " + fmtK(val("b_fdi_total")), label: "Confirmed FDI in the period" },
    { value: `${val("m_emp_sl") ?? "—"} / ${val("m_emp_nsl") ?? "—"}`, label: "Employees: Sri Lankan / non-Sri Lankan", sub: `as at ${fmtDate(r.headcount_as_at)}` },
    { value: fmtNum(val("o_in_sqm") ?? 0) + " sqm", label: "Office space in Port City", sub: `as at ${fmtDate(r.office_as_at)}` }])
  + `<div class="vgrid">${vizCard("Progress of the return's lines", donut([{ label: "Has a value", value: cnt.v }, { label: "Nil / not applicable / not available", value: cnt.n }, { label: "Not set or missing", value: cnt.m }], [pct(tot - cnt.m, tot) + "%", "set"]))}
    ${vizCard("Lines set by section", hbars(Object.entries(secs).map(([s, [a, b]]) => ({ label: s.replace(/^\S+\s/, ""), value: pct(a, b), tip: `${a} of ${b}` })), v => v + "%", "", { keepZero: true, max: 100, wrap: true }))}
    ${vizCard("Financial records in the period (USD)", hbars(Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value: r2(value) })), v => "USD " + fmtK(v), "No financial records in this period."), `${fe.length} record(s); ${fe.filter(x => x.review_status !== "Reviewed").length} not yet reviewed.`)}</div>
   ${quickForm("fin_entries", ["entry_date", "category", "description", "country_region", "staff_group", "office_id", "original_amount", "original_currency", "usd_rate", "lkr_rate", "rate_date", "rate_source"], "Add a financial record", false)}`;
}

/* ---------- Licences and obligations ---------- */
function obligationsOverview() {
  const lic = Store.list("licences"), ob = Store.list("obligations"), w = Store.can("obligations", "write");
  const st = s => ob.filter(x => x.status === s).length;
  const basis = {}; ob.forEach(x => basis[x.basis || "Not stated"] = (basis[x.basis || "Not stated"] || 0) + 1);
  const next = ob.filter(x => x.deadline && !["Met", "Not applicable"].includes(x.status)).sort((a, b) => a.deadline.localeCompare(b.deadline));
  return ovHead("Licences and obligations", "Your licence and designations, and each obligation with the reason it applies to your company. The system tracks status you record; it does not decide whether you are compliant.")
  + hlFor("obligations")
  + `<div class="ogrid">${lic.map(l => { const tot = l.issue_date && l.expiry_date ? daysUntil(l.expiry_date) - daysUntil(l.issue_date) : 0, gone = l.issue_date ? -daysUntil(l.issue_date) : 0, left = l.expiry_date ? daysUntil(l.expiry_date) : null;
      return `<div class="card oc"><div class="row" style="margin:0 0 6px;justify-content:space-between"><b><a href="#" data-act="open" data-type="licences" data-id="${l.id}">${esc(l.title)}</a></b>${badge(l.status)}</div>
       <div class="small muted">${esc(l.licence_type)}${l.number ? " · " + esc(l.number) : ""}</div>
       ${tot > 0 ? `<div class="mt"><div class="mtl"><span>${fmtDate(l.issue_date)}</span><span>${fmtDate(l.expiry_date)}</span></div><div class="mtt"><i style="width:${Math.min(100, Math.max(0, pct(gone, tot)))}%${left <= (l.renewal_notice_days || 60) ? ";background:var(--warn)" : ""}"></i></div></div>` : ""}
       <p class="small">${left == null ? "No expiry date recorded." : left < 0 ? `<span class="badge bad">Expired ${-left} days ago</span>` : `<b>${left}</b> days until expiry${left <= (l.renewal_notice_days || 60) ? ' <span class="badge warn">renewal due</span>' : ""}`}</p>
       ${l.conditions ? `<p class="small muted">Conditions: ${esc(l.conditions.slice(0, 140))}${l.conditions.length > 140 ? "…" : ""}</p>` : ""}</div>`; }).join("") || `<div class="card empty">No licence recorded. ${w ? '<button class="btn sm p" data-act="new" data-type="licences">Add your licence</button>' : ""}</div>`}</div>
   <div class="vgrid">${vizCard("Obligations by status", donut([{ label: "Open (not started or in progress)", value: st("Not started") + st("In progress") }, { label: "Met", value: st("Met") }, { label: "Not met", value: st("Not met") }, { label: "Under review or not applicable", value: st("Under review") + st("Not applicable") }], [String(ob.length), "obligations"]))}
    ${vizCard("Why each obligation applies", hbars(Object.entries(basis).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), fmtNum, "Nothing recorded yet.", { wrap: true }), "Keeps your own licence conditions separate from general law, Commission requests and business plan projections.")}
    ${vizCard("Next deadlines", next.length ? `<ul class="tl">${next.slice(0, 6).map(x => { const d = daysUntil(x.deadline); return `<li><b>${fmtDate(x.deadline)}</b> <span class="badge ${d < 0 ? "bad" : d <= 30 ? "warn" : "info"}">${d < 0 ? -d + " days late" : "in " + d + " days"}</span><div><a href="#" data-act="open" data-type="obligations" data-id="${x.id}">${esc(x.title)}</a></div></li>`; }).join("")}</ul>` : '<p class="muted small">No open deadlines.</p>')}</div>
   ${quickForm("obligations", ["title", "obligation_type", "basis", "source_document", "target", "deadline", "recurrence", "responsible", "status", "needs_review"], "Add an obligation or condition", !ob.length)}`;
}

/* ---------- Visas ---------- */
function visasOverview() {
  const v = Store.list("visas").filter(x => !["Cancelled", "Rejected"].includes(x.application_status)), who = x => Store.canSee("personal") ? x.person_name : x.role || x.nationality || "Visa record";
  const b = [["Expired", -1e9, -1], ["0-30 days", 0, 30], ["31-90 days", 31, 90], ["91-180 days", 91, 180], ["Over 180 days", 181, 1e9]].map(([label, a, c]) => ({ label, value: v.filter(x => x.expiry_date && daysUntil(x.expiry_date) >= a && daysUntil(x.expiry_date) <= c).length }));
  const grp = f => { const g = {}; v.forEach(x => { const k = f(x) || "Not recorded"; g[k] = (g[k] || 0) + 1; }); return Object.entries(g).sort((a, c) => c[1] - a[1]).map(([label, value]) => ({ label, value })); };
  const next = v.filter(x => x.expiry_date).sort((a, c) => a.expiry_date.localeCompare(c.expiry_date)).slice(0, 6);
  return ovHead("Visas and permits", "Visa, permit and passport dates for staff, directors and dependants. Tracking only: the system does not apply for or grant visas.")
  + hlFor("visas")
  + `<div class="vgrid">${vizCard("When visas and permits expire", cols(b), "Count of visas and permits by time left.")}
    ${vizCard("Next to expire", next.length ? `<ul class="tl">${next.map(x => { const d = daysUntil(x.expiry_date); return `<li><b>${fmtDate(x.expiry_date)}</b> <span class="badge ${d < 0 ? "bad" : d <= 90 ? "warn" : "info"}">${d < 0 ? "expired" : d + " days"}</span><div><a href="#" data-act="open" data-type="visas" data-id="${x.id}">${esc(who(x))}</a> <span class="small muted">${esc(x.visa_category)}</span></div></li>`; }).join("")}</ul>` : '<p class="muted small">No expiry dates recorded.</p>')}
    ${vizCard("By application status", hbars(grp(x => x.application_status)))}
    ${vizCard("By visa or permit type", hbars(grp(x => x.visa_category)))}
    ${vizCard("By nationality", hbars(grp(x => x.nationality)))}</div>
   ${quickForm("visas", ["person_name", "person_type", "nationality", "role", "visa_category", "application_status", "expiry_date", "passport_expiry", "responsible"], "Add a visa or permit", !v.length)}`;
}

/* ---------- Documents ---------- */
function documentsOverview() {
  const v = Store.list("docs").filter(docVisible), w = Store.can("documents", "write"), cats = {};
  v.forEach(d => cats[d.category] = (cats[d.category] || 0) + 1);
  const exp = v.filter(d => d.expiry_date).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)).slice(0, 6);
  const recent = v.flatMap(d => (d.versions || []).map(x => ({ d, x }))).sort((a, b) => b.x.uploaded_at.localeCompare(a.x.uploaded_at)).slice(0, 6);
  return ovHead("Documents", "Licences, approvals, returns, letters and evidence, with versions and expiry dates.")
  + hlCards([{ value: v.length, label: "Documents" }, { value: v.filter(d => !(d.versions || []).length).length, label: "Without a file", kind: v.some(d => !(d.versions || []).length) ? "warn" : "" }, { value: v.filter(d => d.expiry_date && daysUntil(d.expiry_date) <= 60).length, label: "Expired or expiring within 60 days", kind: v.some(d => d.expiry_date && daysUntil(d.expiry_date) <= 60) ? "warn" : "" }, { value: v.filter(d => d.access === "Restricted").length, label: "Restricted" }])
  + `<div class="vgrid">${vizCard("By category", hbars(Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))))}
    ${vizCard("Expiry dates", exp.length ? `<ul class="tl">${exp.map(d => { const n = daysUntil(d.expiry_date); return `<li><b>${fmtDate(d.expiry_date)}</b> <span class="badge ${n < 0 ? "bad" : n <= 60 ? "warn" : "info"}">${n < 0 ? "expired" : n + " days"}</span><div><a href="#" data-act="doc-open" data-id="${d.id}">${esc(d.title)}</a></div></li>`; }).join("")}</ul>` : '<p class="muted small">No expiry dates recorded.</p>')}
    ${vizCard("Recently uploaded", recent.length ? `<ul class="tl">${recent.map(({ d, x }) => `<li><a href="#" data-act="doc-open" data-id="${d.id}">${esc(d.title)}</a><div class="help">${esc(x.name)} · ${esc(x.uploaded_at.slice(0, 10))}</div></li>`).join("")}</ul>` : '<p class="muted small">No files uploaded yet.</p>')}</div>
   ${w ? `<details class="card quick"${v.length ? "" : " open"}><summary><b>Add a document</b> <span class="muted small">- details and the file together</span></summary><form class="f" data-form="doc-quick" novalidate><div class="grid3f">${DOC_FIELDS.map(f => `<div class="fld${f.type === "textarea" ? " wide" : ""}"><label for="f_${f.name}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ""}</label>${inputFor(f, f.dflt ?? null)}</div>`).join("")}
     <div class="fld"><label for="dq_file">File (optional)</label><input type="file" id="dq_file" name="file" accept="${DOC_ACCEPT}"><span class="help">PDF, image, CSV, text or JSON, up to 20 MB.</span></div></div><div class="row"><button class="btn p">Save</button></div></form></details>` : ""}`;
}
FORMS["doc-quick"] = async form => {
  const file = form.file.files[0];
  const raw = readForm(form), rec = {}, errs = [];
  for (const f of DOC_FIELDS) try { rec[f.name] = cleanValue(f, raw[f.name]); } catch (e) { errs.push(e); }
  if (!rec.title) errs.push("Document title is required."); if (!rec.category) errs.push("Category is required."); if (errs.length) throw errs;
  if (RESTRICTED_DOC_CATS.includes(rec.category)) rec.access = "Restricted";
  if (rec.access === "Restricted" && !canRestrictedDocs()) throw ["Your role cannot add restricted documents."];
  rec.versions = []; const id = await Store.save("docs", rec); await Store.audit("docs", id, "Created", `Document: ${rec.title}`);
  if (file) await CHANGES["doc-upload"]({ files: [file], dataset: { id } });
  UI.typing = false; toast("Document saved."); render();
};

/* ---------- Business plan charts ---------- */
function bpCharts(v) {
  const rows = comparePlan(v); if (!rows.length) return "";
  const m = key => rows.map(y => { const x = y.metrics.find(z => z.key === key); return { label: "Year " + y.year, a: x.plan, b: x.actual }; });
  return `<div class="vgrid">${vizCard("Cumulative investment (USD)", pairCols(m("investment_cum"), ["Plan", "Actual"], v => fmtK(v)))}${vizCard("Employees", pairCols(m("employees"), ["Plan", "Actual"], fmtNum))}${vizCard("Office space (sqm)", pairCols(m("office"), ["Plan", "Actual"], fmtNum))}${vizCard("Revenue (USD)", pairCols(m("revenue"), ["Plan", "Actual"], v => fmtK(v)))}</div>`;
}

/* ---------- Reports: short descriptions ---------- */
const REPORT_DESC = { plan_vs_actual: "Each plan year: investment, staff, office space and revenue against the business plan reference.", employees: "The seven areas the Commission asks about in employee information requests.", office_headcount: "Office space inside and outside Port City, seats and employees, on a date.", investment: "Every receipt with original currency and rate, and confirmed FDI totals.", annual_return: "Every line of the return with how it was worked out, for checking.", requests: "Every request, its deadline, approval and when it was sent.", obligations: "Licences and obligations with status and why each applies.", visas: "Visas and passports expiring within a period you choose.", missing_docs: "Documents and annual return items still outstanding." };

