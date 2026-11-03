/* ===== insights.js ===== */
/* Highlight cards, small charts, interactive overview screens (Investment, Workforce, Office space)
   and the "how it all fits together" flow diagram. Charts are plain HTML/CSS, themed by tokens. */


const fmtK = v => { if (v == null) return "—"; const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : a >= 1e4 ? (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : fmtNum(r2(v)); };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const sumBy = (rows, f) => rows.reduce((t, r) => t + toC(f(r) || 0), 0) / 100;

/* ---------- building blocks ---------- */
function hlCards(cards) {
  return `<div class="stats hlc">${cards.map(c => `<div class="stat static ${c.kind || ""}" title="${esc(c.tip || c.label)}"><b>${c.value}</b><span>${esc(c.label)}</span>${c.sub ? `<em>${c.sub}</em>` : ""}</div>`).join("")}</div>`;
}
function vizCard(title, body, note) { return `<div class="card viz"><h3>${esc(title)}</h3>${body}${note ? `<p class="help">${esc(note)}</p>` : ""}</div>`; }
function hbars(rows, fmt = fmtNum, empty = "Nothing recorded yet.", o = {}) {
  rows = rows.filter(r => r.value || o.keepZero); if (!rows.length) return `<p class="muted small">${esc(empty)}</p>`;
  const max = Math.max(...rows.map(r => Math.abs(r.value)), o.max || 0, 1e-9);
  return `<div class="hb${o.wrap ? " wrap" : ""}" role="table">${rows.map(r => `<div class="hbr" role="row" title="${esc(r.label)}: ${esc(fmt(r.value))}${r.tip ? " · " + esc(r.tip) : ""}"><span class="hbl" role="cell">${esc(r.label)}</span><span class="hbt"><i style="width:${r.value ? Math.max(2, pct(Math.abs(r.value), max)) : 0}%${r.color ? ";background:" + r.color : ""}"></i></span><span class="hbv" role="cell">${esc(fmt(r.value))}</span></div>`).join("")}</div>`;
}
function donut(parts, center, fmt = fmtNum) {
  parts = parts.filter(p => p.value > 0); const tot = parts.reduce((t, p) => t + p.value, 0);
  if (!tot) return '<p class="muted small">Nothing recorded yet.</p>';
  let a = 0; const stops = parts.map((p, i) => { const s = a, e = a + p.value / tot * 360; a = e; const c = `var(--c${Math.min(i + 1, 4)})`; return `${c} ${s}deg ${Math.max(s, e - (parts.length > 1 ? 1.5 : 0))}deg, var(--panel) ${Math.max(s, e - (parts.length > 1 ? 1.5 : 0))}deg ${e}deg`; });
  return `<div class="dn"><div class="dnc" style="background:conic-gradient(${stops.join(",")})" role="img" aria-label="${esc(parts.map(p => `${p.label} ${fmt(p.value)}`).join(", "))}"><div><b>${esc(center[0])}</b><span>${esc(center[1])}</span></div></div>
   <ul class="lg">${parts.map((p, i) => `<li><i style="background:var(--c${Math.min(i + 1, 4)})"></i>${esc(p.label)} <b>${esc(fmt(p.value))}</b> <span class="muted">${pct(p.value, tot)}%</span></li>`).join("")}</ul></div>`;
}
function cols(rows, fmt = fmtNum) {
  if (!rows.length || !rows.some(r => r.value)) return '<p class="muted small">Nothing recorded yet.</p>';
  const max = Math.max(...rows.map(r => r.value), 1);
  return `<div class="cc">${rows.map(r => `<div class="ccb" title="${esc(r.tip || r.label)}: ${esc(fmt(r.value))}"><span class="ccv">${r.value ? esc(fmt(r.value)) : ""}</span><span class="cct"><i style="height:${r.value ? Math.max(2, pct(r.value, max)) : 0}%"></i></span><span class="ccl">${esc(r.label)}</span></div>`).join("")}</div>`;
}
/* Plan vs actual meter: actual bar with a plan marker */
function meter(label, actual, plan, fmt = fmtNum, src = "") {
  if (plan == null || plan === "") return `<div class="mt"><div class="mtl"><b>${esc(label)}</b><span>${esc(fmt(actual))} actual · no plan figure</span></div></div>`;
  const max = Math.max(actual || 0, plan, 1), p = pct(actual || 0, plan);
  return `<div class="mt" title="${esc(src)}"><div class="mtl"><b>${esc(label)}</b><span>${esc(fmt(actual))} of ${esc(fmt(plan))} planned · <b class="${p >= 100 ? "okt" : p >= 75 ? "" : "wt"}">${p}%</b></span></div>
   <div class="mtt"><i style="width:${pct(actual || 0, max)}%"></i><s style="left:${pct(plan, max)}%" title="Plan: ${esc(fmt(plan))}"></s></div></div>`;
}
function quickForm(type, names, title, open) {
  const def = REG[type]; if (!Store.can(def.module, "write")) return "";
  const fs = names.map(n => def.fmap[n]).filter(f => f && (!f.sensitive || Store.canSee(f.sensitive)));
  const money = names.includes("original_amount");
  return `<details class="card quick"${open ? " open" : ""}><summary><b>${esc(title)}</b> <span class="muted small">- fill in the main fields here; open the full form for everything else</span></summary>
   <form class="f" data-form="quick" data-type="${type}" novalidate>${money ? '<p class="help"><button type="button" class="btn sm" data-act="fill-rate">Fill rates from exchange rate table</button></p><div class="note small" id="conv-hint"></div>' : ""}
   <div class="grid3f">${fs.map(f => `<div class="fld${f.type === "textarea" ? " wide" : ""}"><label for="f_${f.name}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ""}</label>${inputFor(f, f.dflt ?? null)}${f.help ? `<span class="help">${esc(f.help)}</span>` : ""}</div>`).join("")}</div>
   <div class="row"><button class="btn p">Save</button><button type="button" class="btn" data-act="new" data-type="${type}">Open the full form</button></div></form></details>`;
}
FORMS.quick = async form => {
  const t = form.dataset.type; const { notes } = await saveRecord(t, readForm(form), null, "Manual");
  if (AFTER_SAVE[t]) await AFTER_SAVE[t](null, true);
  notes.forEach(n => toast(n, "warn")); toast(`${REG[t].label} saved.`); UI.typing = false; render();
};
function quarterOf(d) { return d.slice(0, 4) + " Q" + (Math.floor((+d.slice(5, 7) - 1) / 3) + 1); }
function monthEnds(n) { const out = [], t = new Date(today() + "T00:00:00Z"); for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - i + 1, 0)); out.push(i === 0 ? today() : d.toISOString().slice(0, 10)); } return out; }
function planYearNow(v) { const r = v ? comparePlan(v) : []; return r.length ? r[r.length - 1] : null; }

/* ======================= INVESTMENT OVERVIEW ======================= */
function investmentOverview() {
  const vcur = viewCurrencies().includes(UI.params.inv_cur) ? UI.params.inv_cur : "USD", K = perUSD(vcur) || 1;
  const all = Store.list("investments"), w = Store.can("investment", "write"), ap = Store.can("investment", "approve");
  const conf = all.filter(i => i.review_status === "Confirmed"), fdi = conf.filter(i => FDI.includes(i.classification) && i.usd_amount != null);
  const pend = all.filter(i => i.review_status !== "Confirmed"), noUsd = all.filter(i => i.usd_amount == null);
  const fdiUsd = sumBy(fdi, i => i.usd_amount), pendUsd = sumBy(pend.filter(i => i.usd_amount != null), i => i.usd_amount);
  const y = planYearNow(referencePlan()), cum = y && y.metrics.find(m => m.key === "investment_cum");
  const qs = {}; fdi.forEach(i => { const q = quarterOf(i.entry_date); qs[q] = (qs[q] || 0) + i.usd_amount; });
  const qrows = Object.keys(qs).sort().slice(-8).map(q => ({ label: q, value: r2(qs[q]) }));
  const ctry = {}; all.filter(i => i.usd_amount != null).forEach(i => { const k = i.source_country || "Not stated"; ctry[k] = (ctry[k] || 0) + i.usd_amount; });
  const cls = {}; all.filter(i => i.usd_amount != null).forEach(i => { const k = i.classification || "Pending review"; cls[k] = (cls[k] || 0) + i.usd_amount; });
  const usd = v => v == null ? "—" : vcur + " " + fmtK(v * K);
  return curChips("inv_cur", vcur) + hlCards([
    { value: usd(fdiUsd), label: "Confirmed FDI to date", sub: `${fdi.length} record(s)`, tip: "Confirmed equity, reinvested earnings and intra-company debt" },
    { value: pend.length, label: "Awaiting review", sub: pend.length ? usd(pendUsd) + " not yet counted" : "all reviewed", kind: pend.length ? "warn" : "" },
    { value: usd(sumBy(all.filter(i => i.usd_amount != null), i => i.usd_amount)), label: "All receipts recorded (USD)", sub: `${all.length} record(s), FDI and non-FDI` },
    cum && cum.plan != null ? { value: pct(cum.actual, cum.plan) + "%", label: `of planned cumulative FDI (plan year ${y.year})`, sub: `${usd(cum.actual)} of ${usd(cum.plan)}`, kind: pct(cum.actual, cum.plan) < 75 ? "warn" : "" }
      : { value: "—", label: "Plan comparison", sub: "Lock a business plan reference to compare" },
    { value: noUsd.length, label: "Records with no USD figure", sub: noUsd.length ? "add a rate or USD amount" : "all converted", kind: noUsd.length ? "bad" : "" }])
  + `<div class="vgrid">
    ${vizCard("Confirmed FDI by type", hbars(FDI.map(c => ({ label: c, value: r2(sumBy(fdi.filter(i => i.classification === c), i => i.usd_amount)) })), usd, "No confirmed FDI yet."))}
    ${vizCard("Confirmed FDI by quarter received", cols(qrows, usd), "By date received. Only reviewer-confirmed records.")}
    ${vizCard("All receipts by source country", hbars(Object.entries(ctry).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ label: k, value: r2(v) })), usd), "Includes records still awaiting review.")}
    ${vizCard("All receipts by classification", hbars(Object.entries(cls).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: r2(v), color: FDI.includes(k) ? "" : "var(--c2)" })), usd), "Blue bars count as FDI once confirmed; orange bars are not FDI.")}
   </div>
   ${inflowHTML(vcur)}
   <div class="card"><h3>Review queue ${pend.length ? `<span class="badge warn">${pend.length}</span>` : ""}</h3><p class="small muted">Check the classification of each receipt. Only confirmed records count in FDI totals. Whether a receipt is FDI can need accounting or legal advice.</p>
   ${pend.length ? `<div class="tw"><table class="t"><thead><tr><th>Date</th><th>Source</th><th>Country / relationship</th><th class="num">Original</th><th class="num">Rate (per USD)</th><th class="num">USD</th><th>From outside Sri Lanka?</th><th>Proposed classification</th><th></th></tr></thead><tbody>
    ${pend.map(i => `<tr><td class="nowrap">${fmtDate(i.entry_date)}</td><td><a href="#" data-act="open" data-type="investments" data-id="${i.id}">${esc(i.source_name)}</a></td><td class="small">${esc(i.source_country || "")}<br>${esc(i.relationship || "")}</td>
     <td class="num">${esc(i.original_currency)} ${fmtMoney(i.original_amount)}</td><td class="num">${esc(i.usd_rate ?? "")}<div class="help">${esc(i.rate_date || "")} ${esc(i.rate_source || "")}</div></td><td class="num">${i.usd_amount != null ? fmtMoney(i.usd_amount) : '<span class="badge bad">none</span>'}</td>
     <td>${esc(i.from_outside_sl || "—")}</td>
     <td>${w ? `<select data-change="inv-class" data-id="${i.id}" aria-label="Classification">${LOOKUPS.fund_classes.map(o => `<option${o === i.classification ? " selected" : ""}>${o}</option>`).join("")}</select>` : esc(i.classification)}${i.review_status === "Queried" ? ' <span class="badge bad">queried</span>' : ""}</td>
     <td class="nowrap">${ap ? `<button class="btn sm ok" data-act="review" data-type="investments" data-id="${i.id}" data-status="Confirmed">Confirm</button> <button class="btn sm bad" data-act="review" data-type="investments" data-id="${i.id}" data-status="Queried">Query</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">Nothing waiting for review.</p>'}</div>
   ${quickForm("investments", ["entry_date", "source_name", "source_country", "relationship", "original_amount", "original_currency", "usd_rate", "usd_amount", "lkr_rate", "rate_date", "rate_source", "from_outside_sl", "classification"], "Record a new receipt", !all.length)}`;
}
CHANGES["inv-class"] = async el => { await saveRecord("investments", { classification: el.value }, el.dataset.id); toast("Classification updated. It still needs a reviewer to confirm it."); };

/* ======================= WORKFORCE OVERVIEW ======================= */
function workforceOverview() {
  const d = UI.params.wf_as_at || today();
  const active = at => Store.list("employees").filter(e => e.start_date && e.start_date <= at && (!e.end_date || e.end_date >= at) && e.status !== "Offer accepted - not started");
  const act = active(d), emp = act.filter(e => e.worker_type === "Employee"), con = act.length - emp.length;
  const sl = emp.filter(e => e.nationality_group === "Sri Lankan").length, nsl = emp.length - sl;
  const yAgo = addDays(d, -365), all = Store.list("employees").filter(e => e.worker_type === "Employee");
  const joined = all.filter(e => e.start_date > yAgo && e.start_date <= d).length, left = all.filter(e => e.end_date && e.end_date > yAgo && e.end_date <= d).length;
  const upcoming = all.filter(e => e.start_date > d).length;
  const pos = Store.list("positions"), openPos = pos.filter(p => p.status === "Open - recruiting");
  const y = planYearNow(referencePlan()), pm = k => y && y.metrics.find(m => m.key === k);
  const posCat = e => e.staff_category || (Store.get("positions", e.position_id) || {}).staff_category;
  const grp = (f) => { const g = {}; emp.forEach(e => { const k = f(e) || "Not recorded"; g[k] = (g[k] || 0) + 1; }); return Object.entries(g).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })); };
  const offName = id => { const o = Store.get("offices", id); return o ? o.name : "No office assigned"; };
  const trend = monthEnds(12).map((m, i) => ({ label: i % 2 === 11 % 2 ? MONTHS[+m.slice(5, 7) - 1] : "", tip: MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4), value: active(m).filter(e => e.worker_type === "Employee").length }));
  const filled = p => emp.filter(e => e.position_id === p.id).length;
  return `<div class="row"><label>As at <input type="date" value="${d}" data-change="param" data-k="wf_as_at"></label><span class="small muted">Counts employees only; independent contractors are shown separately.</span></div>`
  + hlCards([
    { value: emp.length, label: "Employees", sub: `as at ${fmtDate(d)}` },
    { value: sl, label: "Sri Lankan", sub: `${pct(sl, emp.length)}% of employees` },
    { value: nsl, label: "Non-Sri Lankan", sub: `${pct(nsl, emp.length)}% of employees` },
    { value: con, label: "Independent contractors", sub: "not counted as employees" },
    { value: `+${joined} / −${left}`, label: "Joined / left in the last 12 months", sub: upcoming ? `${upcoming} more due to start` : "" },
    { value: openPos.length, label: "Positions being recruited", sub: `${pos.length} position(s) defined`, kind: openPos.length ? "warn" : "" }])
  + `<div class="vgrid">
    ${vizCard("Sri Lankan and non-Sri Lankan employees", donut([{ label: "Sri Lankan", value: sl }, { label: "Non-Sri Lankan", value: nsl }], [String(emp.length), "employees"]), "The annual return reports these two groups separately.")}
    ${y ? vizCard(`Business plan vs actual - plan year ${y.year}`, [["employees", "All employees"], ["local", "Local employees"], ["foreign", "Foreign employees"]].map(([k, l]) => { const m = pm(k); return meter(l, m.actual, m.plan, fmtNum, m.source); }).join(""), "The plan figure is a projection, not a commitment. The marker shows the plan.")
      : vizCard("Business plan vs actual", '<p class="muted small">Lock a business plan reference to compare headcount with the plan.</p>')}
    ${vizCard("Employees over the last 12 months", cols(trend), "Month-end headcount, employees only. Hover a bar for the month.")}
    ${vizCard("By staff category", hbars(grp(posCat)))}
    ${vizCard("By nationality", hbars(grp(e => e.nationality).slice(0, 8)))}
    ${vizCard("By office", hbars(grp(e => e.office_id ? offName(e.office_id) : "No office assigned")))}
   </div>
   <div class="card"><h3>Positions: planned and filled</h3><div class="tw"><table class="t"><thead><tr><th>Position</th><th>Category</th><th>Minimum experience</th><th>Languages</th><th class="num">Planned</th><th class="num">Filled</th><th>Status</th></tr></thead><tbody>
    ${pos.map(p => { const f = filled(p); return `<tr><td><a href="#" data-act="open" data-type="positions" data-id="${p.id}">${esc(p.title)}</a></td><td>${esc(p.staff_category || "")}</td><td>${p.min_experience_years != null ? esc(p.min_experience_years) + " yrs" : ""}</td><td>${esc(p.languages || "")}</td><td class="num">${p.planned_headcount ?? ""}</td><td class="num">${f}${p.planned_headcount && f < p.planned_headcount ? ` <span class="badge warn">${p.planned_headcount - f} open</span>` : ""}</td><td>${badge(p.status)}</td></tr>`; }).join("") || '<tr><td colspan="7" class="empty">No positions yet.</td></tr>'}</tbody></table></div></div>
   ${quickForm("employees", ["ref", "full_name", "position_id", "job_title", "staff_category", "nationality", "worker_type", "employment_type", "start_date", "office_id"], "Add a person", !all.length)}`;
}

/* ======================= OFFICE SPACE OVERVIEW ======================= */
function officeOverview() {
  const d = UI.params.off_as_at || today(), offs = activeOffices(Store, d), off = actualOffice(d);
  const emps = Store.list("employees").filter(e => e.worker_type === "Employee" && e.start_date <= d && (!e.end_date || e.end_date >= d) && e.status !== "Offer accepted - not started");
  const seats = offs.reduce((t, o) => t + (o.seats || 0), 0), assigned = emps.filter(e => offs.some(o => o.id === e.office_id)).length;
  const plans = Store.list("office_plans").filter(p => p.effective_date >= d).sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  const y = planYearNow(referencePlan()), om = y && y.metrics.find(m => m.key === "office");
  const sq = v => fmtNum(r2(v)) + " sqm";
  return `<div class="row"><label>As at <input type="date" value="${d}" data-change="param" data-k="off_as_at"></label></div>`
  + hlCards([
    { value: sq(off.inside), label: "Inside Colombo Port City", sub: `${offs.filter(o => o.location === "Inside Colombo Port City").length} office(s)` },
    { value: sq(off.outside), label: "Outside Colombo Port City", sub: `${offs.filter(o => o.location !== "Inside Colombo Port City").length} office(s)` },
    { value: seats, label: "Seats", sub: `${assigned} employees assigned` },
    { value: seats ? pct(assigned, seats) + "%" : "—", label: "Seat use", sub: "employees assigned ÷ seats", kind: seats && assigned > seats ? "bad" : "" },
    { value: emps.length ? fmtNum(r2(off.total / emps.length)) : "—", label: "sqm per employee", sub: `${emps.length} employees in total` },
    { value: plans.length ? sq(plans[0].required_sqm) : "—", label: "Next planned requirement", sub: plans.length ? `from ${fmtDate(plans[0].effective_date)} (projection)` : "none recorded" }])
  + `<div class="ogrid">${offs.map(o => { const a = emps.filter(e => e.office_id === o.id).length, le = o.lease_end ? daysUntil(o.lease_end) : null;
      return `<div class="card oc"><div class="row" style="margin:0 0 6px"><b><a href="#" data-act="open" data-type="offices" data-id="${o.id}">${esc(o.name)}</a></b></div>
       <div class="row" style="margin:0 0 8px"><span class="badge ${o.location === "Inside Colombo Port City" ? "info" : ""}">${o.location === "Inside Colombo Port City" ? "Inside Port City" : "Outside Port City"}</span>${o.designated_status && o.designated_status !== "Not applicable" ? `<span class="badge ${o.designated_status.includes("approved") ? "ok" : "warn"}">${esc(o.designated_status)}</span>` : ""}${o.measurement_basis === "Approximate" ? '<span class="badge">approx. area</span>' : ""}</div>
       <dl class="kv sm"><dt>Area</dt><dd><b>${fmtNum(o.area_sqm)} sqm</b> <span class="muted">(${fmtNum(o.area_sqft)} sqft)</span></dd><dt>Seats</dt><dd>${o.seats ?? "—"}</dd>
       <dt>Rent</dt><dd>${o.rent_amount ? `${esc(o.rent_currency || "")} ${fmtMoney(o.rent_amount)} per ${esc((o.rent_frequency || "").toLowerCase())}` : "—"}</dd><dt>Lease ends</dt><dd>${o.lease_end ? fmtDate(o.lease_end) + (le <= 90 ? ` <span class="badge ${le < 0 ? "bad" : "warn"}">${le < 0 ? "ended" : le + " days"}</span>` : "") : "—"}</dd>
       <dt>People present</dt><dd>${o.present_count != null ? `${o.present_count} on ${fmtDate(o.present_date)}` : "not counted"}</dd></dl>
       ${o.seats ? `<div class="mt"><div class="mtl"><span>Employees assigned</span><span>${a} of ${o.seats} seats</span></div><div class="mtt"><i style="width:${Math.min(100, pct(a, o.seats))}%${a > o.seats ? ";background:var(--bad)" : ""}"></i></div></div>` : `<p class="small muted">${a} employee(s) assigned</p>`}</div>`; }).join("") || '<div class="card empty">No offices in use on this date.</div>'}</div>
   <div class="vgrid">
    ${vizCard("Floor area by office (sqm)", hbars(offs.map(o => ({ label: o.name, value: o.area_sqm, color: o.location === "Inside Colombo Port City" ? "" : "var(--c2)" })), sq), "Blue: inside Port City. Orange: outside.")}
    ${y ? vizCard(`Business plan vs actual - plan year ${y.year}`, meter("Office space (sqm)", om.actual, om.plan, sq, om.source), "The plan figure is a projection, not a commitment.") : vizCard("Business plan vs actual", '<p class="muted small">Lock a business plan reference to compare.</p>')}
    ${vizCard("Planned office requirements (projections)", plans.length ? `<ul class="tl">${plans.map(p => `<li><b>${fmtDate(p.effective_date)}</b> ${sq(p.required_sqm)}${p.required_seats ? `, ${p.required_seats} seats` : ""} <span class="badge">${p.location === "Inside Colombo Port City" ? "Inside Port City" : "Outside"}</span><div class="help">${esc(p.basis || "")}</div></li>`).join("")}</ul>` : '<p class="muted small">None recorded. The 2026 annual return asks for projected space inside Port City from 2028.</p>')}
   </div>
   ${quickForm("offices", ["name", "address", "location", "designated_status", "floor_area", "area_unit", "measurement_basis", "seats", "status", "in_use_from", "lease_end", "rent_amount", "rent_currency", "rent_frequency"], "Add an office", !Store.list("offices").length)}`;
}

/* ======================= HIGHLIGHT CARDS FOR EVERY REGISTER ======================= */
const HL = {
  people: () => { const p = Store.list("people").filter(x => !x.ceased_date); return [{ value: p.filter(x => /Director/.test(x.role)).length, label: "Directors" }, { value: p.filter(x => /hareholder/.test(x.role)).length, label: "Shareholders" }, { value: p.filter(x => x.person_type === "Corporate").length, label: "Corporate shareholders" }, { value: fmtNum(r2(sumBy(p, x => x.shareholding_pct))) + "%", label: "Shareholding recorded", kind: p.length && Math.abs(sumBy(p, x => x.shareholding_pct) - 100) > 0.01 ? "warn" : "", sub: "should add up to 100%" }]; },
  ubo: () => { const u = Store.list("ubo"); return [{ value: u.length, label: "Beneficial owners" }, { value: u.filter(x => x.declaration_status === "Signed copy on file").length, label: "Signed declarations on file" }, { value: u.filter(x => x.declaration_status !== "Signed copy on file").length, label: "Declarations still to sign", kind: u.some(x => x.declaration_status !== "Signed copy on file") ? "warn" : "" }, { value: fmtNum(r2(sumBy(u, x => x.ownership_pct))) + "%", label: "Ownership recorded" }]; },
  requests: () => { const r = Store.list("requests"), open = r.filter(x => !["Submitted", "Closed"].includes(x.status)); return [{ value: open.length, label: "Open requests" }, { value: open.filter(x => x.deadline && daysUntil(x.deadline) >= 0 && daysUntil(x.deadline) <= 7).length, label: "Due in the next 7 days", kind: "warn" }, { value: open.filter(x => x.deadline && daysUntil(x.deadline) < 0).length, label: "Past the deadline", kind: open.some(x => x.deadline && daysUntil(x.deadline) < 0) ? "bad" : "" }, { value: r.filter(x => x.submitted_at && x.submitted_at.slice(0, 4) === today().slice(0, 4)).length, label: "Responses sent this year" }]; },
  templates: () => [{ value: Store.list("templates").length, label: "Response templates" }],
  positions: () => { const p = Store.list("positions"); return [{ value: p.length, label: "Positions" }, { value: p.filter(x => x.status === "Open - recruiting").length, label: "Being recruited" }, { value: sumBy(p, x => x.planned_headcount), label: "Planned headcount" }, { value: p.filter(x => !x.min_qualifications || x.min_experience_years == null || !x.languages).length, label: "Missing requirement details", sub: "the Commission may ask for these", kind: "warn" }]; },
  employees: () => { const h = actualHeadcount(today()); return [{ value: h.total, label: "Employees today" }, { value: h.local, label: "Sri Lankan" }, { value: h.foreign, label: "Non-Sri Lankan" }, { value: h.contractors, label: "Contractors" }]; },
  policies: () => { const p = Store.list("policies"); return ["Accommodation", "Health insurance", "Travel and relocation"].map(t => ({ value: p.filter(x => x.policy_type === t).length ? "Yes" : "None", label: t + " policy", kind: p.some(x => x.policy_type === t) ? "" : "warn", sub: "asked about in employee information requests" })).concat([{ value: p.length, label: "Policies in total" }]); },
  investments: () => { const a = Store.list("investments"); return [{ value: "USD " + fmtK(actualInvestment("1900-01-01", today()).usd), label: "Confirmed FDI to date" }, { value: a.filter(x => x.review_status !== "Confirmed").length, label: "Awaiting review", kind: "warn" }, { value: a.length, label: "Records" }]; },
  offices: () => { const o = actualOffice(today()); return [{ value: fmtNum(o.inside) + " sqm", label: "Inside Port City" }, { value: fmtNum(o.outside) + " sqm", label: "Outside Port City" }, { value: o.offices, label: "Offices in use" }]; },
  office_plans: () => { const p = Store.list("office_plans"); return [{ value: p.length, label: "Planned requirements" }, { value: p.filter(x => (x.effective_date || "").startsWith(AR_TEMPLATE.projectionYear) && x.location === "Inside Colombo Port City").length ? "Recorded" : "Missing", label: `Port City requirement from ${AR_TEMPLATE.projectionYear}`, sub: "asked for in the 2026 annual return", kind: p.some(x => (x.effective_date || "").startsWith(AR_TEMPLATE.projectionYear)) ? "" : "warn" }]; },
  fin_entries: () => { const p = AR_TEMPLATE.period, f = Store.list("fin_entries"), inP = f.filter(x => x.entry_date >= p.start && x.entry_date <= p.end);
    return [{ value: inP.length, label: "Records in the 2025/26 return period" }, { value: "USD " + fmtK(sumBy(inP.filter(x => x.category === "Revenue" && x.usd_amount != null), x => x.usd_amount)), label: "Revenue in the period (USD)", sub: "all currencies converted" }, { value: f.filter(x => x.review_status !== "Reviewed").length, label: "Not yet reviewed", kind: "warn" }, { value: f.filter(x => x.usd_amount == null).length, label: "No USD figure", kind: f.some(x => x.usd_amount == null) ? "bad" : "" }, { value: f.filter(x => x.category !== "Revenue" && x.category !== "Capital expenditure" && x.category !== "Office rent" && x.category !== "Other operational expenditure" && x.staff_group === "Not applicable").length, label: "Staff costs with no staff group", kind: "warn" }]; },
  housing: () => { const h = Store.list("housing").filter(x => !x.to_date || x.to_date >= today()); return [{ value: h.length, label: "Units in use today" }, { value: h.filter(x => x.staff_group === "Sri Lankan").length, label: "For Sri Lankan staff" }, { value: h.filter(x => x.staff_group !== "Sri Lankan").length, label: "For non-Sri Lankan staff" }]; },
  licences: () => { const l = Store.list("licences"); return [{ value: l.filter(x => x.status === "Active").length, label: "Active" }, { value: l.filter(x => x.expiry_date && daysUntil(x.expiry_date) >= 0 && daysUntil(x.expiry_date) <= 90).length, label: "Expiring within 90 days", kind: "warn" }, { value: l.filter(x => x.expiry_date && daysUntil(x.expiry_date) < 0 && x.status === "Active").length, label: "Past expiry but marked active", kind: "bad" }]; },
  obligations: () => { const o = Store.list("obligations"), c = s => o.filter(x => x.status === s).length; return [{ value: c("Not started") + c("In progress"), label: "Open", sub: `${c("Not started")} not started, ${c("In progress")} in progress` }, { value: o.filter(x => x.deadline && daysUntil(x.deadline) < 0 && !["Met", "Not applicable"].includes(x.status)).length, label: "Past deadline", kind: "bad" }, { value: c("Met"), label: "Recorded as met" }, { value: o.filter(x => x.needs_review === "Yes").length, label: "Need adviser review", kind: "warn" }, { value: o.filter(x => x.basis === "Stated in our licence, approval or agreement").length, label: "From our own licence or agreement" }]; },
  visas: () => { const v = Store.list("visas").filter(x => !["Cancelled", "Rejected"].includes(x.application_status)); return [{ value: v.filter(x => x.application_status === "Approved" && (!x.expiry_date || daysUntil(x.expiry_date) >= 0)).length, label: "Valid visas and permits" }, { value: v.filter(x => x.expiry_date && daysUntil(x.expiry_date) >= 0 && daysUntil(x.expiry_date) <= 90).length, label: "Expiring within 90 days", kind: "warn" }, { value: v.filter(x => !["Approved", "Expired"].includes(x.application_status)).length, label: "Applications in progress" }, ...(Store.canSee("id") ? [{ value: v.filter(x => x.passport_expiry && daysUntil(x.passport_expiry) <= 180).length, label: "Passports expiring within 180 days", kind: "warn" }] : [])]; },
  fx_rates: () => { const f = Store.list("fx_rates").sort((a, b) => b.rate_date.localeCompare(a.rate_date)); return [{ value: f.length, label: "Rates recorded" }, { value: new Set(f.map(x => x.currency)).size, label: "Currencies" }, { value: f[0] ? fmtDate(f[0].rate_date) : "—", label: "Latest rate date" }]; },
};
function hlFor(type) { try { return HL[type] ? hlCards(HL[type]().map(c => (c.kind === "warn" || c.kind === "bad") && !c.value ? Object.assign({}, c, { kind: "" }) : c)) : ""; } catch (e) { console.warn(e); return ""; } }

/* ======================= HOW IT ALL FITS TOGETHER ======================= */
const FLOW_COLS = ["Where information comes from", "Records kept in the system", "What the system does", "What you get", "What you do outside the system"];
const FLOW = [
  ["manual", 0, "Typing it in", "Most records are entered on screen by your team, with each field labelled.", null, ["company", "licence", "bplan", "workforce", "invest", "office", "fin", "visas", "requests"]],
  ["excel", 0, "Excel import", "Download a template, fill it in, check the preview and import. Rows with problems are skipped and shown.", null, ["workforce", "invest", "office", "fin", "fx"]],
  ["erp", 0, "Your ERP (later)", "For now, export payroll, HR and accounts data from your ERP to Excel and import it here. A direct link can be added later.", null, ["excel"]],
  ["letters", 0, "Commission letters and emails", "Each request from the Commission is logged with its deadline and the original wording.", "requests", ["requests"]],
  ["papers", 0, "Licence and plan documents", "Your licence, approvals and submitted business plan are recorded and attached.", "documents", ["licence", "bplan", "docs"]],
  ["circulars", 0, "Acts, regulations and circulars", "The Port City Acts, gazettes, Commission forms and any circulars your administrator adds.", "library", ["lib"]],
  ["company", 1, "Company, directors and owners", "Company profile, directors, shareholders and beneficial owners (Form_UBO fields).", "company", ["calc"]],
  ["licence", 1, "Licence and conditions", "AP licence or BSI designation, expiry dates, and each condition tracked as an obligation.", "obligations", ["remind", "calc"]],
  ["bplan", 1, "Business plan reference", "The figures from the plan you gave the Commission, checked and locked.", "bplan", ["pva"]],
  ["workforce", 1, "Workforce and positions", "Employees and contractors kept apart, positions with their requirements, staff benefits.", "workforce", ["calc", "pva", "remind", "plans"]],
  ["invest", 1, "Investment and funding", "Every receipt with its original currency and rate. Counts as FDI only once a reviewer confirms it.", "investment", ["review", "calc", "pva", "plans"]],
  ["office", 1, "Office space", "Offices inside and outside Port City, area, seats, leases and planned needs.", "offices", ["calc", "pva", "plans"]],
  ["fin", 1, "Financial records", "Revenue, costs and staff payments by annual return category.", "returns", ["review", "calc", "plans"]],
  ["budgetrec", 1, "Budget", "Monthly budget by category for each financial year.", "budget", ["plans"]],
  ["premises", 1, "Premises options", "Offices you are considering, with rent, deposits and lease terms.", "offices", ["plans"]],
  ["lib", 1, "Port City Library", "The text of every document, split into sections and pages so it can be searched and cited.", "library", ["ask"]],
  ["fx", 1, "Exchange rates", "A rate table used to suggest rates. Each record keeps its own rate, date and source.", "setup", ["calc"]],
  ["visas", 1, "Visas and permits", "Visa and passport expiry for staff, directors and dependants.", "visas", ["remind"]],
  ["requests", 1, "Commission requests", "Each request with its deadline, owner, draft response and status.", "requests", ["review", "remind"]],
  ["docs", 1, "Documents", "Files with versions and expiry dates. Restricted files are hidden from roles that can't see them.", "documents", ["remind"]],
  ["calc", 2, "Calculations", "Converts currencies, adds up figures for each annual return line and explains how each figure was worked out.", null, ["ar", "reports", "dash"]],
  ["review", 2, "Review and approval", "A second person confirms records, approves responses and approves the annual return.", null, ["ar", "resp"]],
  ["remind", 2, "Reminders", "Flags deadlines and expiry dates before they are due.", "dashboard", ["dash"]],
  ["pva", 2, "Plan vs actual", "Compares actual investment, staff, office space and revenue with the business plan reference.", "bplan", ["reports", "dash"]],
  ["plans", 2, "Forecasts and comparisons", "Budget vs actual, capital inflow targets, office space forecast and rent comparison.", "budget", ["dash", "reports"]],
  ["ask", 2, "Quayza (AI assistant)", "Claude answers questions using only the library documents, and shows the source of each point.", "library", ["answers"]],
  ["audit", 2, "Audit history", "Every change, approval, export and recorded submission is logged with who and when.", "setup", ["reports"]],
  ["dash", 3, "Dashboard", "What needs attention today, with the main figures.", "dashboard", []],
  ["ar", 3, "Annual return", "Each line checked, an approved snapshot kept, and the Commission's own PDF filled for you.", "returns", ["sign"]],
  ["resp", 3, "Responses to the Commission", "Draft responses from templates, approved before they go out.", "requests", ["submit"]],
  ["answers", 3, "Answers with sources", "Plain-English answers, each point linked to the section and page it came from.", "library", []],
  ["reports", 3, "Reports", "Ten reports in Excel, PDF or Word, each stating its date and sources.", "reports", ["submit"]],
  ["sign", 4, "Check, tick and sign", "You complete the declarations and sign. The system never signs or ticks declarations.", null, ["submit"]],
  ["submit", 4, "Submit to the Commission", "You send the return, response or report yourself.", null, ["record"]],
  ["record", 4, "Record what you sent", "Back in the system, you record the date, method and reference, which is kept in the history.", null, ["audit"]],
];
function flowLinks(id) {
  const down = new Set([id]), up = new Set([id]), out = id2 => (FLOW.find(n => n[0] === id2) || [])[5] || [];
  let ch = true; while (ch) { ch = false; FLOW.forEach(n => { if (down.has(n[0])) out(n[0]).forEach(x => { if (!down.has(x)) { down.add(x); ch = true; } }); if (out(n[0]).some(x => up.has(x)) && !up.has(n[0])) { up.add(n[0]); ch = true; } }); }
  return new Set([...down, ...up]);
}
function flowHTML() {
  const sel = UI.params.flow, on = sel ? flowLinks(sel) : null, n = sel && FLOW.find(x => x[0] === sel);
  return `<div class="card"><h3>How it all fits together</h3><p class="small muted">Click any box to see what it does and what it connects to. Click it again to clear.</p>
   <div class="flow">${FLOW_COLS.map((c, i) => `<div class="fcol"><div class="fh">${i + 1}. ${esc(c)}</div>${FLOW.filter(x => x[1] === i).map(x => `<button class="fn${i === 4 ? " ext" : ""}${on ? (on.has(x[0]) ? " on" : " dim") : ""}${sel === x[0] ? " sel" : ""}" data-act="flow" data-id="${x[0]}" aria-pressed="${sel === x[0]}">${esc(x[2])}</button>`).join("")}</div>${i < 4 ? '<div class="farrow" aria-hidden="true">→</div>' : ""}`).join("")}</div>
   ${n ? `<div class="fdetail"><b>${esc(n[2])}</b><p>${esc(n[3])}</p><p class="small muted">Feeds into: ${(n[5].map(x => FLOW.find(y => y[0] === x)[2]).join(", ")) || "nothing further"}</p>${n[4] && canSection(n[4]) ? `<button class="btn sm p" data-act="nav" data-section="${n[4]}">Open ${esc(SECTIONS.find(s => s[0] === n[4])[1])}</button>` : ""}</div>` : ""}
   <p class="small muted">Every change is also written to the audit history. Nothing leaves the system on its own: the last column is always done by you.</p></div>`;
}
ACTIONS.flow = el => { UI.params.flow = UI.params.flow === el.dataset.id ? null : el.dataset.id; render(); };

