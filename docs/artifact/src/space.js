/* ===== space.js ===== */
/* Office space forecast (from headcount and the hiring plan) and rent comparison of premises options.
   Both are management planning tools. Forecasts are estimates, not commitments. */


/* ======================= SPACE FORECAST ======================= */
const FC_DEFAULTS = { quarters: 12, sqm_per_seat: 8, seat_ratio: 1, buffer_pct: 20, include_contractors: "No", hires: {}, leavers: {} };
function fcSettings() {
  const s = Object.assign({}, FC_DEFAULTS, Store.get("space", "forecast") || {});
  if (!s.start) { const t = today(); s.start = t.slice(0, 5) + String(Math.floor((+t.slice(5, 7) - 1) / 3) * 3 + 1).padStart(2, "0") + "-01"; }
  return s;
}
function fcQuarters(s) { return Array.from({ length: s.quarters }, (_, i) => { const st = addMonths(s.start, i * 3), en = addDays(addMonths(s.start, i * 3 + 3), -1); return { i, start: st, end: en, label: quarterOf(st), key: st.slice(0, 7) }; }); }
function capacityAt(d) {
  const os = Store.list("offices").filter(o => !o.archived && (o.in_use_from ? o.in_use_from <= d : o.status === "In use") && (!o.in_use_to || o.in_use_to >= d));
  return { sqm: r2(os.reduce((t, o) => t + (o.area_sqm || 0), 0)), seats: os.reduce((t, o) => t + (o.seats || 0), 0), offices: os };
}
function headAt(d, contractors) {
  return Store.list("employees").filter(e => e.start_date && e.start_date <= d && (!e.end_date || e.end_date >= d) && e.status !== "Offer accepted - not started" && (contractors || e.worker_type === "Employee")).length;
}
function planHeadAt(v, d) {
  if (!v || !v.year1_start || d < v.year1_start) return null;
  for (let y = 0; y < (v.years || []).length; y++) { const s = addYears(v.year1_start, y), e = addDays(addYears(v.year1_start, y + 1), -1);
    if (d >= s && d <= e) { const p = v.years[y] || {}; return p.local_employees == null && p.foreign_employees == null ? null : (p.local_employees || 0) + (p.foreign_employees || 0); } }
  return null;
}
function fcCompute(s) {
  const qs = fcQuarters(s), inc = s.include_contractors === "Yes", ref = referencePlan();
  const all = Store.list("employees").filter(e => inc || e.worker_type === "Employee");
  let head = headAt(addDays(s.start, -1), inc);
  return qs.map(q => {
    const known = all.filter(e => e.start_date >= q.start && e.start_date <= q.end).length - all.filter(e => e.end_date && e.end_date >= q.start && e.end_date <= q.end).length;
    const hires = Number(s.hires[q.key]) || 0, leavers = Number(s.leavers[q.key]) || 0, open = head;
    head = Math.max(0, head + known + hires - leavers);
    const seats = Math.ceil(head * s.seat_ratio), need = r2(seats * s.sqm_per_seat * (1 + s.buffer_pct / 100)), cap = capacityAt(q.end);
    const status = !cap.sqm ? ["No office", "bad"] : need > cap.sqm ? ["Short of space", "bad"] : need > cap.sqm * 0.9 ? ["Nearly full", "warn"] : ["Enough space", "ok"];
    return Object.assign(q, { open, known, hires, leavers, head, seats, need, cap, gap: r2(cap.sqm - need), seatGap: cap.seats - seats, plan: planHeadAt(ref, q.end), status });
  });
}
function forecastHTML() {
  const s = fcSettings(), rows = fcCompute(s), w = Store.can("offices", "write"), last = rows[rows.length - 1];
  const firstShort = rows.find(r => r.need > r.cap.sqm), peakNeed = Math.max(...rows.map(r => r.need));
  const sq = v => fmtNum(r2(v)) + " sqm";
  const in2028 = rows.find(r => r.start.startsWith(AR_TEMPLATE.projectionYear));
  return `<div class="head"><div class="t"><h1>Office space forecast</h1><p class="muted">How much space the company will need, quarter by quarter, based on people today, known joiners and leavers in the workforce register, and your hiring plan. This is an estimate for planning, not a commitment.</p></div></div>`
  + hlCards([{ value: rows[0] ? rows[0].open : 0, label: "People today", sub: s.include_contractors === "Yes" ? "employees and contractors" : "employees only" },
    { value: last ? last.head : 0, label: `People by ${last ? last.label : ""}`, sub: `after ${rows.reduce((t, r) => t + r.hires, 0)} planned hire(s)` },
    { value: sq(peakNeed), label: "Most space needed", sub: `${s.sqm_per_seat} sqm per seat + ${s.buffer_pct}% shared space` },
    { value: sq(capacityAt(today()).sqm), label: "Space available today", sub: `${capacityAt(today()).seats} seats` },
    { value: firstShort ? firstShort.label : "None", label: "First quarter short of space", sub: firstShort ? `short by ${sq(-firstShort.gap)}` : "within the forecast period", kind: firstShort ? "bad" : "" }])
  + `<div class="vgrid">${vizCard("Space needed vs space available (sqm)", lineChart(rows.map(r => r.label), [{ name: "Space needed", values: rows.map(r => r.need) }, { name: "Space available", values: rows.map(r => r.cap.sqm), dash: true }], v => fmtNum(Math.round(v)), { label: "Space needed and available by quarter" }), "Available space counts offices in the register in use on each quarter end, including planned offices with an 'in use from' date.")}
    ${vizCard("People at each quarter end", pairCols(rows.map(r => ({ label: r.label.replace(/^20(\d\d) /, "$1 "), tip: r.label, a: r.head, b: r.plan })), ["Forecast", "Business plan (projection)"], fmtNum))}</div>
   <form class="card f" data-form="space-fc" novalidate><h3>Assumptions</h3><div class="grid3f">
    ${fieldRow("Forecast starts (quarter)", `<input type="date" name="start" value="${s.start}"${w ? "" : " disabled"}>`)}${fieldRow("Number of quarters", `<input name="quarters" type="number" min="4" max="20" value="${s.quarters}"${w ? "" : " disabled"}>`)}
    ${fieldRow("Space per seat (sqm)", `<input name="sqm_per_seat" inputmode="decimal" value="${s.sqm_per_seat}"${w ? "" : " disabled"}>`, "Desk area per person. 6-10 sqm is common for open-plan offices.")}
    ${fieldRow("Seats per person", `<input name="seat_ratio" inputmode="decimal" value="${s.seat_ratio}"${w ? "" : " disabled"}>`, "1 = a desk each. 0.8 = shared desks with hybrid working.")}
    ${fieldRow("Extra for meeting rooms and shared areas (%)", `<input name="buffer_pct" inputmode="decimal" value="${s.buffer_pct}"${w ? "" : " disabled"}>`)}
    ${fieldRow("Count contractors who work on site?", `<select name="include_contractors"${w ? "" : " disabled"}>${YES_NO.map(o => `<option${o === s.include_contractors ? " selected" : ""}>${o}</option>`).join("")}</select>`)}</div>
   <h3 style="margin-top:14px">Forecast and hiring plan</h3><p class="small muted">Type planned hires and leavers for each quarter. "Known changes" come from start and end dates already in the workforce register, so don't enter those again.</p>
   <div class="tw"><table class="t fc"><thead><tr><th>Quarter</th><th class="num">People at start</th><th class="num">Known changes</th><th class="num">Planned hires</th><th class="num">Planned leavers</th><th class="num">People at end</th><th class="num">Business plan</th><th class="num">Seats needed</th><th class="num">Space needed</th><th class="num">Available</th><th class="num">Surplus / shortfall</th><th>Status</th></tr></thead><tbody>
   ${rows.map(r => `<tr><td class="nowrap"><b>${r.label}</b></td><td class="num">${r.open}</td><td class="num">${r.known ? (r.known > 0 ? "+" : "") + r.known : ""}</td>
     <td class="num">${w ? `<input class="num sm" name="h_${r.key}" value="${r.hires || ""}" inputmode="numeric" aria-label="Planned hires ${r.label}">` : r.hires}</td><td class="num">${w ? `<input class="num sm" name="l_${r.key}" value="${r.leavers || ""}" inputmode="numeric" aria-label="Planned leavers ${r.label}">` : r.leavers}</td>
     <td class="num"><b>${r.head}</b></td><td class="num muted">${r.plan ?? "—"}</td><td class="num">${r.seats}<div class="help">${r.cap.seats} available</div></td><td class="num">${fmtNum(r.need)}</td><td class="num">${fmtNum(r.cap.sqm)}</td><td class="num ${r.gap < 0 ? "neg" : ""}">${r.gap > 0 ? "+" : ""}${fmtNum(r.gap)}</td><td><span class="badge ${r.status[1]}">${r.status[0]}</span></td></tr>`).join("")}</tbody></table></div>
   ${w ? `<div class="row"><button class="btn p">Save and update the forecast</button><button type="button" class="btn" data-act="fc-plan">Fill hires from the business plan</button><button type="button" class="btn" data-act="fc-clear">Clear planned hires and leavers</button>
     ${in2028 ? `<button type="button" class="btn" data-act="fc-2028" data-k="${in2028.key}">Save the ${AR_TEMPLATE.projectionYear} need as a planned requirement</button>` : ""}</div>` : ""}
   <p class="help">Space needed = people × seats per person (rounded up) × space per seat × (1 + shared-space %). The 2026 annual return asks for projected space inside Port City from ${AR_TEMPLATE.projectionYear}; you can save this forecast's figure as a planned requirement for that line.</p></form>`;
}
function fcRead(form) {
  const o = readForm(form), s = fcSettings(), n = (k, lo, hi) => { const v = Number(String(o[k] ?? s[k]).replace(/,/g, "")); if (!Number.isFinite(v) || v < lo || v > hi) throw [`Check "${k.replace(/_/g, " ")}": enter a number from ${lo} to ${hi}.`]; return v; };
  const hires = {}, leavers = {};
  Object.entries(o).forEach(([k, v]) => { const x = parseInt(String(v).trim() || "0", 10); if (!x) return; if (k.startsWith("h_")) hires[k.slice(2)] = x; if (k.startsWith("l_")) leavers[k.slice(2)] = x; });
  return { start: (o.start || s.start).slice(0, 7) + "-01", quarters: Math.round(n("quarters", 4, 20)), sqm_per_seat: n("sqm_per_seat", 1, 50), seat_ratio: n("seat_ratio", 0.1, 2), buffer_pct: n("buffer_pct", 0, 200), include_contractors: o.include_contractors || "No", hires, leavers };
}
FORMS["space-fc"] = async form => { const v = fcRead(form); await Store.save("space", v, "forecast"); await Store.audit("space", "forecast", "Forecast updated", `${v.quarters} quarters from ${v.start}; ${Object.values(v.hires).reduce((a, b) => a + b, 0)} planned hire(s)`); UI.typing = false; toast("Forecast updated."); render(); };
ACTIONS["fc-clear"] = async el => { const v = fcRead(el.closest("form")); v.hires = {}; v.leavers = {}; await Store.save("space", v, "forecast"); await Store.audit("space", "forecast", "Hiring plan cleared", ""); render(); };
function planYearIdx(v, d) { if (!v || !v.year1_start || d < v.year1_start) return -1; for (let y = 0; y < (v.years || []).length; y++) if (d < addYears(v.year1_start, y + 1)) return y; return -1; }
ACTIONS["fc-plan"] = async el => {
  const ref = referencePlan(); if (!ref) throw ["Lock a business plan reference first (Business Plan Reference)."];
  const v = fcRead(el.closest("form")), keep = {};
  fcQuarters(v).forEach(q => { if (planHeadAt(ref, q.end) == null && v.hires[q.key]) keep[q.key] = v.hires[q.key]; });
  const rows = fcCompute(Object.assign({}, v, { hires: keep })); v.hires = Object.assign({}, keep);
  let extra = 0, missing = 0, groupY = null, groupStart = 0;
  rows.forEach((r, i) => {
    const target = planHeadAt(ref, r.end), y = planYearIdx(ref, r.end); if (target == null) { missing++; return; }
    const group = rows.filter(x => planYearIdx(ref, x.end) === y), idx = group.indexOf(r);
    if (y !== groupY) { groupY = y; groupStart = r.open + extra; }
    const goal = Math.round(groupStart + (target - groupStart) * (idx + 1) / group.length), without = r.head + extra, h = Math.max(0, goal - without);
    if (h) { v.hires[r.key] = h; extra += h; }
  });
  await Store.save("space", v, "forecast"); await Store.audit("space", "forecast", "Hires filled from business plan", `${extra} hire(s) from ${ref.title} v${ref.version_no}`);
  toast(`${extra} planned hire(s) added, spread across each plan year to reach the business plan headcount${missing ? `. ${missing} quarter(s) fall outside the plan years and were left as they were` : ""}. Check and adjust them.`); render();
};
ACTIONS["fc-2028"] = async el => {
  const r = fcCompute(fcSettings()).find(x => x.key === el.dataset.k); if (!r) return;
  const d = r.start, ex = Store.list("office_plans").find(p => p.effective_date === d && p.location === "Inside Colombo Port City");
  await saveRecord("office_plans", { effective_date: d, location: "Inside Colombo Port City", required_sqm: r.need, required_seats: r.seats, basis: `Office space forecast saved ${today()}: ${r.head} people, ${fcSettings().sqm_per_seat} sqm per seat + ${fcSettings().buffer_pct}%` }, ex ? ex.id : null, "Calculated");
  toast(`${ex ? "Updated" : "Saved"} planned requirement from ${fmtDate(d)}: ${fmtNum(r.need)} sqm, ${r.seats} seats. Rent figures can be added on the Planned requirements tab.`);
};

/* ======================= RENT COMPARISON ======================= */
function rentCalc(o, vcur, needs) {
  const sqm = o.area_sqm || 0, sqft = o.area_sqft || 0, rate = Number(o.rent_rate) || 0;
  const rent = o.rent_basis === "Per sqm per month" ? rate * sqm : o.rent_basis === "Per sqft per month" ? rate * sqft : rate;
  const svc = Number(o.service_charge) || 0, month = rent + svc, yrs = Number(o.lease_years) || 1, esc = (Number(o.escalation_pct) || 0) / 100;
  const deposit = o.deposit_amount != null && o.deposit_amount !== "" ? Number(o.deposit_amount) : (Number(o.deposit_months) || 0) * rent;
  const advance = (Number(o.advance_months) || 0) * rent, fit = Number(o.fitout_cost) || 0;
  let term = 0; for (let y = 0; y < Math.ceil(yrs); y++) term += month * 12 * Math.pow(1 + esc, y) * Math.min(1, yrs - y);
  const k = v => convert(v, o.currency, vcur), ok = convert(1, o.currency, vcur) != null;
  const fit_ = needs && needs.length ? (() => { const bad = needs.find(r => r.need > sqm || r.seats > (o.seats || Infinity)); return bad ? (bad === needs[0] ? ["Too small now", "bad"] : [`Fits until ${needs[needs.indexOf(bad) - 1].label}`, "warn"]) : ["Fits the whole forecast", "ok"]; })() : null;
  return { o, ok, cur: ok ? vcur : o.currency, rent: ok ? k(rent) : rent, svc: ok ? k(svc) : svc, month: ok ? k(month) : month, perSqm: sqm ? (ok ? k(month) : month) / sqm : null, perSeat: o.seats ? (ok ? k(month) : month) / o.seats : null,
    year1: ok ? k(month * 12) : month * 12, term: ok ? k(term + fit) : term + fit, deposit: ok ? k(deposit) : deposit, advance: ok ? k(advance) : advance, fit: ok ? k(fit) : fit, upfront: ok ? k(deposit + advance + fit) : deposit + advance + fit, effMonth: ok ? k((term + fit) / (yrs * 12)) : (term + fit) / (yrs * 12), yrs, fitStatus: fit_ };
}
function rentHTML() {
  const opts = Store.list("rent_options"), vcur = viewCurrencies().includes(UI.params.rent_cur) ? UI.params.rent_cur : "USD", w = Store.can("offices", "write");
  const needs = fcCompute(fcSettings()), cs = opts.map(o => rentCalc(o, vcur, needs)), f = v => v == null ? "—" : fmtMoney(r2(v)), fk = (v, c) => v == null ? "—" : `${c} ${fmtK(v)}`;
  const comparable = cs.filter(c => c.ok), newOpts = comparable.filter(c => c.o.x_current !== "Yes"), min = (key, pool = comparable) => pool.length ? pool.reduce((a, b) => (b[key] != null && (a[key] == null || b[key] < a[key])) ? b : a) : null;
  const best = { perSqm: min("perSqm"), upfront: min("upfront", newOpts), effMonth: min("effMonth"), perSeat: min("perSeat") };
  const locBadge = o => (o.x_current === "Yes" ? '<span class="badge">Current office</span> ' : "") + (o.location === "Inside Colombo Port City" ? '<span class="badge info">Inside Port City</span>' : o.location.startsWith("Designated") ? '<span class="badge warn">Designated location</span>' : '<span class="badge">Outside, not designated</span>');
  const head = `<div class="head"><div class="t"><h1>Rent comparison</h1><p class="muted">Compare premises inside Colombo Port City with designated office locations. Refundable deposits are shown separately: they tie up cash but are not a cost, subject to the lease terms. Amounts exclude taxes such as VAT; check those with your adviser.</p></div>
    <div class="acts">${w ? '<button class="btn p" data-act="new" data-type="rent_options">Add a premises option</button>' : ""}${w && Store.list("offices").length ? '<button class="btn" data-act="rent-from-offices">Add current offices for comparison</button>' : ""}</div></div>`;
  if (!opts.length) return head + '<div class="card empty">No premises options yet. Add the premises you are considering, including your current office if you want to compare it.</div>';
  const desig = opts.filter(o => o.location === "Designated location outside Port City");
  const metric = (label, key, fmt, help, bestKey) => `<tr><th>${esc(label)}${help ? `<div class="help">${esc(help)}</div>` : ""}</th>${cs.map(c => `<td class="num${bestKey && best[bestKey] === c && comparable.length > 1 ? " best" : ""}">${fmt(c)}${bestKey && best[bestKey] === c && comparable.length > 1 ? ' <span class="badge ok">lowest</span>' : ""}</td>`).join("")}</tr>`;
  const sel = needs.length ? needs[needs.length - 1] : null;
  return head + curChips("rent_cur", vcur)
  + hlCards([{ value: best.perSqm ? `${vcur} ${fmtMoney(r2(best.perSqm.perSqm))}` : "—", label: "Lowest cost per sqm per month", sub: best.perSqm ? best.perSqm.o.name : "", tip: "Rent plus service charge" },
    { value: best.effMonth ? fk(best.effMonth.effMonth, vcur) : "—", label: "Lowest average monthly cost over the lease", sub: best.effMonth ? best.effMonth.o.name + " (incl. increases and fit-out)" : "" },
    { value: best.upfront ? fk(best.upfront.upfront, vcur) : "—", label: "Least cash needed upfront", sub: best.upfront ? best.upfront.o.name + " (new premises only)" : "" },
    { value: comparable.length ? fk(Math.max(...comparable.map(c => c.deposit)), vcur) : "—", label: "Largest refundable deposit", sub: comparable.length ? comparable.reduce((a, b) => b.deposit > a.deposit ? b : a).o.name : "" },
    { value: sel ? fmtNum(sel.need) + " sqm" : "—", label: `Space needed by ${sel ? sel.label : ""}`, sub: "from the space forecast" }])
  + (desig.length ? `<p class="note warn small"><b>Designated locations:</b> Regulation 15 of the AP Engaged in Business Regulations No. 1 of 2023 (Gazette 2339/31) allowed designated locations outside Port City up to 26 May 2026. Confirm with the Commission whether a designated location is still available to your company before relying on these options.</p>` : "")
  + (cs.some(c => !c.ok) ? `<p class="note small">Some options are shown in their own currency because there is no ${vcur} rate for them. Add rates in Setup > Exchange rates.</p>` : "")
  + `<div class="vgrid">${vizCard(`Cost per sqm per month (${vcur})`, hbars(comparable.map(c => ({ label: c.o.name, value: r2(c.perSqm), color: c.o.location === "Inside Colombo Port City" ? "" : "var(--c2)" })), v => fmtMoney(v)), "Rent plus service charge. Blue: inside Port City. Orange: outside.")}
    ${vizCard(`Cash needed upfront (${vcur})`, hbars(comparable.map(c => ({ label: c.o.name, value: r2(c.upfront), tip: `deposit ${fmtK(c.deposit)}, advance ${fmtK(c.advance)}, fit-out ${fmtK(c.fit)}`, color: c.o.location === "Inside Colombo Port City" ? "" : "var(--c2)" })), v => fmtK(v)), "Refundable deposit + advance rent + fit-out. Hover for the split.")}
    ${vizCard(`Total cost over the lease (${vcur})`, hbars(comparable.map(c => ({ label: `${c.o.name} (${c.yrs} yrs)`, value: r2(c.term), color: c.o.location === "Inside Colombo Port City" ? "" : "var(--c2)" })), v => fmtK(v)), "Rent, service charge, yearly increases and fit-out. Excludes the refundable deposit. Leases of different lengths are not directly comparable: see the average monthly cost.")}</div>
   <div class="card"><h3>Side-by-side comparison</h3><div class="tw"><table class="t cmp"><thead><tr><th></th>${cs.map(c => `<th><a href="#" data-act="open" data-type="rent_options" data-id="${c.o.id}">${esc(c.o.name)}</a><div>${locBadge(c.o)}</div></th>`).join("")}</tr></thead><tbody>
    <tr class="grp"><td colspan="${cs.length + 1}">Space</td></tr>
    ${metric("Floor area", "", c => `${fmtNum(c.o.area_sqm)} sqm<div class="help">${fmtNum(c.o.area_sqft)} sqft</div>`)}
    ${metric("Seats", "", c => c.o.seats ?? "—")}
    ${metric("Against the space forecast", "", c => c.fitStatus ? `<span class="badge ${c.fitStatus[1]}">${esc(c.fitStatus[0])}</span>` : "—", "This option on its own")}
    ${metric("Available from", "", c => fmtDate(c.o.available_from) || "—")}
    <tr class="grp"><td colspan="${cs.length + 1}">Monthly cost${comparable.length === cs.length ? ` (${vcur})` : ""}</td></tr>
    ${metric("Rent", "", c => `${c.ok ? "" : c.cur + " "}${f(c.rent)}<div class="help">${esc(c.o.currency)} ${fmtMoney(c.o.rent_rate)} ${esc((c.o.rent_basis || "").toLowerCase())}</div>`)}
    ${metric("Service charge", "", c => f(c.svc))}
    ${metric("Total per month", "", c => `<b>${f(c.month)}</b>`)}
    ${metric("Per sqm per month", "", c => f(c.perSqm), "", "perSqm")}
    ${metric("Per seat per month", "", c => f(c.perSeat), "", "perSeat")}
    <tr class="grp"><td colspan="${cs.length + 1}">Deposits and upfront cash</td></tr>
    ${metric("Refundable deposit", "", c => `${f(c.deposit)}${c.o.deposit_amount == null && c.o.deposit_months ? `<div class="help">${c.o.deposit_months} months of rent</div>` : ""}`, "Returned at the end of the lease, subject to its terms")}
    ${metric("Advance rent", "", c => `${f(c.advance)}${c.o.advance_months ? `<div class="help">${c.o.advance_months} months</div>` : ""}`, "Prepaid rent: part of the cost")}
    ${metric("Fit-out and set-up", "", c => f(c.fit))}
    ${metric("Cash needed upfront", "", c => `<b>${f(c.upfront)}</b>`, "", "upfront")}
    <tr class="grp"><td colspan="${cs.length + 1}">Over the lease</td></tr>
    ${metric("Lease term", "", c => `${c.yrs} year${c.yrs === 1 ? "" : "s"}${c.o.escalation_pct ? `<div class="help">+${c.o.escalation_pct}% a year</div>` : ""}`)}
    ${metric("First-year cost", "", c => f(c.year1))}
    ${metric("Total cost over the lease", "", c => f(c.term), "Excludes the refundable deposit. Not marked lowest because lease lengths differ")}
    ${metric("Average monthly cost over the lease", "", c => `<b>${f(c.effMonth)}</b>`, "Includes yearly increases and fit-out", "effMonth")}
    ${desig.length ? metric("Designation position", "", c => c.o.location.startsWith("Designated") ? esc(c.o.designation_note || "Confirm with the Commission") : "—") : ""}
   </tbody></table></div><p class="help">"Lowest" marks the lowest figure across options that can be shown in ${vcur}. Your current offices are left out of "cash needed upfront", because you have already paid it. Price is only one factor: location, lease terms and whether a designated location is still allowed also matter.</p></div>
   <p><button class="btn" data-act="rent-export">Download comparison</button></p>`;
}
ACTIONS["rent-from-offices"] = async () => {
  let n = 0;
  for (const o of Store.list("offices").filter(x => x.status !== "Vacated")) {
    if (Store.list("rent_options").some(r => r.name === o.name + " (current)")) continue;
    await saveRecord("rent_options", { name: o.name + " (current)", location: o.location === "Inside Colombo Port City" ? "Inside Colombo Port City" : o.designated_status === "Designated location (approved)" ? "Designated location outside Port City" : "Outside Port City (not designated)",
      address: o.address, floor_area: o.floor_area, area_unit: o.area_unit, seats: o.seats, currency: o.rent_currency || "USD", rent_basis: "Total per month",
      x_current: "Yes", rent_rate: o.rent_amount ? (o.rent_frequency === "Year" ? o.rent_amount / 12 : o.rent_frequency === "Quarter" ? o.rent_amount / 3 : o.rent_amount) : 0, lease_years: 1, notes: "Copied from the office register. Add deposit, service charge and lease details." }, null, "Manual"); n++;
  }
  toast(n ? `${n} current office(s) added. Add their deposits and service charges to complete the comparison.` : "Current offices are already in the comparison.");
};
ACTIONS["rent-export"] = () => {
  const vcur = viewCurrencies().includes(UI.params.rent_cur) ? UI.params.rent_cur : "USD", cs = Store.list("rent_options").map(o => rentCalc(o, vcur, fcCompute(fcSettings()))), c = Store.company();
  const R = (l, fn) => [l, ...cs.map(fn)];
  chooseFormat({ title: "Rent comparison", subtitle: `${c.name} · ${fmtDate(today())} · amounts in ${vcur} where a rate is available`, demo: !!c.is_demo,
    notes: ["Refundable deposits are not a cost and are shown separately. Amounts exclude taxes such as VAT.", "Regulation 15 of Regulations No. 1 of 2023 allowed designated locations outside Port City up to 26 May 2026. Confirm the current position with the Commission."],
    sections: [{ heading: "Side-by-side comparison", columns: ["Item", ...cs.map(x => x.o.name)], rows: [R("Location", x => x.o.location), R("Floor area (sqm)", x => x.o.area_sqm), R("Seats", x => x.o.seats), R("Currency shown", x => x.cur), R("Total per month", x => r2(x.month)), R("Per sqm per month", x => x.perSqm == null ? "" : r2(x.perSqm)),
      R("Refundable deposit", x => r2(x.deposit)), R("Advance rent", x => r2(x.advance)), R("Fit-out", x => r2(x.fit)), R("Cash needed upfront", x => r2(x.upfront)), R("Lease term (years)", x => x.yrs), R("Total cost over lease (excl. deposit)", x => r2(x.term)), R("Average monthly cost over lease", x => r2(x.effMonth)), R("Against the space forecast", x => x.fitStatus ? x.fitStatus[0] : "")] }] },
    (c.is_demo ? "DEMO_" : "") + "Rent_comparison_" + today());
};
HL.rent_options = () => { const o = Store.list("rent_options"); return [{ value: o.length, label: "Premises options" }, { value: o.filter(x => x.location === "Inside Colombo Port City").length, label: "Inside Port City" }, { value: o.filter(x => x.location !== "Inside Colombo Port City").length, label: "Outside Port City" }]; };

