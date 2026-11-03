/* ===== budget.js ===== */
/* Budget and actuals, capital inflow targets, currency view, and shared chart helpers (line chart, paired bars).
   The budget is a management tool chosen by the company. It is not a Commission requirement. */


/* ---------- currency view ---------- */
function perUSD(cur) {
  if (!cur || cur === "USD") return 1;
  const rs = Store.list("fx_rates").slice().sort((a, b) => b.rate_date.localeCompare(a.rate_date));
  const r = rs.find(x => x.currency === cur && Number(x.per_usd)); if (r) return Number(r.per_usd);
  if (cur === "LKR") { const u = rs.find(x => x.currency === "USD" && Number(x.lkr_per_unit)); if (u) return Number(u.lkr_per_unit); }
  return null;
}
function viewCurrencies() { const s = new Set(["USD", "LKR"]); Store.list("fx_rates").forEach(r => { if (perUSD(r.currency)) s.add(r.currency); }); return [...s].filter(c => perUSD(c)); }
function curChips(key, current) {
  const cs = viewCurrencies(), rates = cs.filter(c => c !== "USD").map(c => `1 USD = ${fmtNum(r2(perUSD(c)))} ${c}`);
  return `<div class="row ctl"><span class="small muted">View in:</span><span class="seg" role="group" aria-label="View currency">${cs.map(c => `<button class="${c === current ? "on" : ""}" data-act="vcur" data-k="${key}" data-cur="${c}" aria-pressed="${c === current}">${c}</button>`).join("")}</span>
   ${rates.map(r => `<span class="chip">${esc(r)}</span>`).join("")}${rates.length ? '<span class="small muted">latest rates in Setup > Exchange rates</span>' : '<span class="small muted">Add rates in Setup > Exchange rates to view other currencies</span>'}</div>`;
}
ACTIONS.vcur = el => { UI.params[el.dataset.k] = el.dataset.cur; render(); };
/* convert an amount from currency a to b using the latest table rates; null if no rate */
function convert(v, a, b) { if (v == null) return null; if (a === b) return v; const pa = perUSD(a), pb = perUSD(b); return pa && pb ? v / pa * pb : null; }
const fmtCurK = (v, c) => v == null ? "—" : `${c} ${fmtK(v)}`;

/* ---------- more chart helpers ---------- */
function lineChart(labels, series, fmt, opts = {}) {
  const W = 640, H = 230, L = 64, R = 14, T = 14, B = 30, n = labels.length;
  const vals = series.flatMap(s => s.values.filter(v => v != null)).concat(opts.target ? [opts.target] : []);
  if (!n || !vals.length || !vals.some(v => v)) return '<p class="muted small">Nothing to show yet.</p>';
  const max = Math.max(...vals) * 1.08 || 1, x = i => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)), y = v => T + (H - T - B) * (1 - v / max);
  const grid = [0, .25, .5, .75, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${y(max * f)}" y2="${y(max * f)}" class="gl"/><text x="${L - 6}" y="${y(max * f) + 4}" text-anchor="end" class="ax">${esc(fmt(max * f))}</text>`).join("");
  const step = Math.ceil(n / 8), xl = labels.map((l, i) => i % step === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="ax">${esc(l)}</text>` : "").join("");
  const tgt = opts.target ? `<line x1="${L}" x2="${W - R}" y1="${y(opts.target)}" y2="${y(opts.target)}" class="tg"/><text x="${W - R}" y="${y(opts.target) - 5}" text-anchor="end" class="ax">Target ${esc(fmt(opts.target))}</text>` : "";
  const paths = series.map((s, si) => { const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v), v, i]).filter(Boolean);
    return `<path d="${pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ")}" class="ln" style="stroke:var(--c${si + 1})${s.dash ? ";stroke-dasharray:5 4" : ""}"/>`
      + pts.map(p => `<g class="pt"><circle cx="${p[0]}" cy="${p[1]}" r="9" class="hit"/><circle cx="${p[0]}" cy="${p[1]}" r="3.5" style="fill:var(--c${si + 1})"/><title>${esc(s.name)} · ${esc(labels[p[3]])}: ${esc(fmt(p[2]))}</title></g>`).join(""); }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="lc" role="img" aria-label="${esc(opts.label || series.map(s => s.name).join(", "))}">${grid}${tgt}${paths}${xl}</svg>
   <ul class="lg row">${series.map((s, i) => `<li><i style="background:var(--c${i + 1})${s.dash ? ";opacity:.6" : ""}"></i>${esc(s.name)}${s.dash ? " (dashed)" : ""}</li>`).join("")}${opts.target ? '<li><i class="tgk"></i>Target</li>' : ""}</ul>`;
}
/* two series side by side per category (e.g. budget vs actual) */
function pairCols(rows, names, fmt) {
  if (!rows.length || !rows.some(r => r.a || r.b)) return '<p class="muted small">Nothing to show yet.</p>';
  const max = Math.max(...rows.flatMap(r => [Math.abs(r.a || 0), Math.abs(r.b || 0)]), 1);
  return `<div class="cc pc">${rows.map(r => `<div class="ccb" title="${esc(r.tip || r.label)}: ${esc(names[0])} ${esc(fmt(r.a))}, ${esc(names[1])} ${r.b == null ? "—" : esc(fmt(r.b))}"><span class="ccv">${r.flag ? `<span class="badge bad">${esc(r.flag)}</span>` : ""}</span><span class="cct two"><i style="height:${pct(Math.abs(r.a || 0), max)}%"></i><i class="b2" style="height:${r.b == null ? 0 : pct(Math.abs(r.b), max)}%"></i></span><span class="ccl">${esc(r.label)}</span></div>`).join("")}</div>
   <ul class="lg row"><li><i style="background:var(--c1)"></i>${esc(names[0])}</li><li><i style="background:var(--c2)"></i>${esc(names[1])}</li></ul>`;
}
function pairBars(rows, names, fmt) {
  rows = rows.filter(r => r.a || r.b); if (!rows.length) return '<p class="muted small">Nothing to show yet.</p>';
  const max = Math.max(...rows.flatMap(r => [Math.abs(r.a || 0), Math.abs(r.b || 0)]), 1);
  return `<div class="hb">${rows.map(r => `<div class="hbr two" title="${esc(r.label)}: ${esc(names[0])} ${esc(fmt(r.a))}, ${esc(names[1])} ${esc(fmt(r.b))}"><span class="hbl">${esc(r.label)}</span><span class="hbt2"><span class="hbt"><i style="width:${pct(Math.abs(r.a || 0), max)}%"></i></span><span class="hbt"><i style="width:${pct(Math.abs(r.b || 0), max)}%;background:var(--c2)"></i></span></span><span class="hbv">${esc(fmt(r.a))}<br>${esc(fmt(r.b))}</span></div>`).join("")}</div>
   <ul class="lg row"><li><i style="background:var(--c1)"></i>${esc(names[0])}</li><li><i style="background:var(--c2)"></i>${esc(names[1])}</li></ul>`;
}
function stepper(steps, current) {
  const i = steps.indexOf(current);
  return `<ol class="stepper">${steps.map((s, k) => `<li class="${k < i ? "done" : k === i ? "cur" : ""}"><span>${k < i ? "✓" : k + 1}</span>${esc(s)}</li>`).join("")}</ol>`;
}

/* ---------- months ---------- */
function addMonths(d, n) { const x = new Date(d.slice(0, 7) + "-01T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); }
function monthsBetween(start, count) {
  return Array.from({ length: count }, (_, i) => { const s = addMonths(start, i), e = addDays(addMonths(start, i + 1), -1);
    return { key: s.slice(0, 7), start: s, end: e, label: MONTHS[+s.slice(5, 7) - 1] + " " + s.slice(2, 4), p: "P" + String(i + 1).padStart(2, "0") }; });
}
function monthsInRange(a, b) { const out = []; let s = a.slice(0, 7) + "-01"; while (s <= b && out.length < 120) { out.push(s); s = addMonths(s, 1); } return monthsBetween(a.slice(0, 7) + "-01", out.length); }
function elapsedShare(m, asAt) { if (m.end <= asAt) return 1; if (m.start > asAt) return 0; const days = daysUntil(m.end) - daysUntil(m.start) + 1; return (daysUntil(asAt) - daysUntil(m.start) + 1) / days; }

/* ======================= BUDGET ======================= */
const BUDGET_EXP = LOOKUPS.ar_categories.filter(c => c !== "Revenue");
const BUDGET_ROWS = ["Revenue", ...BUDGET_EXP];
function entryIn(e, cur) {
  if ((e.original_currency || "").toUpperCase() === cur) return e.original_amount;
  if (cur === "USD") return e.usd_amount; if (cur === "LKR") return e.lkr_amount;
  return e.usd_amount != null && perUSD(cur) ? e.usd_amount * perUSD(cur) : null;
}
function budgetActuals(b, asAt) {
  const ms = monthsBetween(b.fy_start, 12), out = {}, missing = [];
  BUDGET_ROWS.forEach(c => out[c] = Array(12).fill(0));
  Store.list("fin_entries").forEach(e => {
    if (!BUDGET_ROWS.includes(e.category) || e.entry_date < ms[0].start || e.entry_date > ms[11].end || e.entry_date > asAt) return;
    const i = ms.findIndex(m => e.entry_date <= m.end), v = entryIn(e, b.currency);
    if (v == null) { missing.push(e); return; } out[e.category][i] += v;
  });
  return { ms, out, missing };
}
function budgetFigures(b, asAt) {
  const { ms, out, missing } = budgetActuals(b, asAt), L = b.lines || {}, row = c => (L[c] && L[c].months) || Array(12).fill(0);
  const share = ms.map(m => elapsedShare(m, asAt));
  const cats = BUDGET_ROWS.map(c => { const mb = row(c).map(Number), annual = mb.reduce((t, v) => t + (v || 0), 0), ytdB = mb.reduce((t, v, i) => t + (v || 0) * share[i], 0), ytdA = out[c].reduce((t, v) => t + v, 0);
    return { cat: c, annual, ytdB, ytdA, months: mb, actual: out[c] }; });
  const exp = cats.filter(c => c.cat !== "Revenue"), rev = cats.find(c => c.cat === "Revenue");
  const monthly = ms.map((m, i) => ({ m, budget: exp.reduce((t, c) => t + (c.months[i] || 0), 0), actual: exp.reduce((t, c) => t + c.actual[i], 0), share: share[i] }));
  const sum = (k) => exp.reduce((t, c) => t + c[k], 0);
  return { ms, cats, exp, rev, monthly, missing, annual: sum("annual"), ytdB: sum("ytdB"), ytdA: sum("ytdA") };
}
function currentBudget() {
  const bs = Store.list("budgets").sort((a, b) => b.fy_start.localeCompare(a.fy_start));
  return Store.get("budgets", UI.params.bud) || bs.find(b => b.fy_start <= today() && addMonths(b.fy_start, 12) > today()) || bs[0] || null;
}
PAGES.budget = () => {
  const bs = Store.list("budgets").sort((a, b) => b.fy_start.localeCompare(a.fy_start)), b = currentBudget(), w = Store.can("budget", "write"), ap = Store.can("budget", "approve");
  const head = `<div class="head"><div class="t"><h1>Budget and actuals</h1><p class="muted">Set the company's budget by month and compare it with the financial records. This is a management tool for your own use. It is not a Commission requirement, and budget figures are not commitments.</p></div>
   <div class="acts">${w ? '<button class="btn p" data-act="bud-new">New budget</button>' : ""}${b && w ? `<button class="btn" data-act="bud-copy" data-id="${b.id}">Copy to the next year</button>` : ""}</div></div>`;
  if (!b) return head + hlCards([{ value: "None", label: "Budgets", sub: "start one to compare spending with your plan" }]) + '<div class="card empty">No budget yet. Click <b>New budget</b> to set one up for a financial year.</div>';
  const asAt = UI.params.bud_as_at || (today() < addMonths(b.fy_start, 12) ? today() : addDays(addMonths(b.fy_start, 12), -1));
  const vcur = UI.params.bud_cur || b.currency, k = v => convert(v, b.currency, vcur), f = v => v == null ? "—" : `${vcur} ${fmtK(v)}`, fm = v => v == null ? "—" : fmtMoney(r2(v));
  if (convert(1, b.currency, vcur) == null) UI.params.bud_cur = b.currency;
  const F = budgetFigures(b, asAt), used = F.annual ? F.ytdA / F.annual * 100 : 0, varY = F.ytdB - F.ytdA;
  const st = (bud, act, past) => !bud && act ? ["No budget", "warn"] : act > bud * 1.0001 && act > 0 ? ["Over budget", "bad"] : past ? ["Within budget", "ok"] : ["On track", "info"];
  return head + `<div class="card ctlcard"><div class="row ctl"><label>Budget <select data-change="param" data-k="bud">${bs.map(x => `<option value="${x.id}"${x.id === b.id ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label>
     <label>As at <input type="date" value="${asAt}" data-change="param" data-k="bud_as_at"></label> ${badge(b.status)} <span class="small muted">Entered in ${esc(b.currency)}. Financial year ${fmtDate(b.fy_start)} to ${fmtDate(addDays(addMonths(b.fy_start, 12), -1))}.</span></div>${curChips("bud_cur", vcur)}
     <div class="row">${w && b.status === "Draft" ? `<button class="btn sm p" data-act="bud-edit" data-id="${b.id}">Enter or change budget figures</button><button class="btn sm" data-act="bud-ready" data-id="${b.id}">Ask for approval</button>` : ""}${ap && b.status === "Ready for approval" ? `<button class="btn sm ok" data-act="bud-approve" data-id="${b.id}">Approve budget</button>` : ""}${w && b.status !== "Draft" ? `<button class="btn sm" data-act="bud-reopen" data-id="${b.id}">Reopen for changes</button>` : ""}
     <button class="btn sm" data-act="bud-export" data-id="${b.id}">Download</button></div></div>`
  + hlCards([
    { value: f(k(F.annual)), label: "Annual spending budget", sub: "full financial year" },
    { value: f(k(F.ytdB)), label: "Budget to date", sub: `pro rata to ${fmtDate(asAt)}` },
    { value: f(k(F.ytdA)), label: "Actual spending to date", sub: "from financial records" },
    { value: (varY >= 0 ? "" : "−") + f(k(Math.abs(varY))), label: varY >= 0 ? "Under budget to date" : "Over budget to date", sub: "budget to date minus actual", kind: varY < 0 ? "bad" : "" },
    { value: Math.round(used) + "%", label: "Annual budget used", sub: "actual to date ÷ annual budget", kind: used > 100 ? "bad" : "" },
    { value: f(k(F.rev.ytdA)), label: "Revenue to date", sub: F.rev.ytdB ? `${Math.round(F.rev.ytdA / F.rev.ytdB * 100)}% of the ${f(k(F.rev.ytdB))} budgeted to date` : "no revenue budget" }])
  + (F.missing.length ? `<p class="note warn small">${F.missing.length} financial record(s) in this year could not be converted to ${esc(b.currency)} and are left out. Add a USD amount or an exchange rate to them.</p>` : "")
  + `<div class="vgrid">
    ${vizCard(`Monthly spending: budget vs actual (${vcur})`, pairCols(F.monthly.map(x => ({ label: x.m.label.slice(0, 3), tip: x.m.label, a: k(x.budget), b: x.share ? k(x.actual) : null, flag: x.share && x.actual > x.budget * 1.0001 && x.actual > 0 ? "over" : "" })), ["Budget", "Actual"], f), "Months after the as-at date show the budget only.")}
    ${vizCard(`Budget to date vs actual by category (${vcur})`, pairBars(F.exp.filter(c => c.annual || c.ytdA).map(c => ({ label: c.cat, a: k(c.ytdB), b: k(c.ytdA) })), ["Budget to date", "Actual"], f))}
    ${vizCard(`Cumulative spending (${vcur})`, lineChart(F.ms.map(m => m.label), [{ name: "Actual", values: (() => { let t = 0; return F.monthly.map(x => x.share ? (t += k(x.actual)) : null); })() }, { name: "Budget", dash: true, values: (() => { let t = 0; return F.monthly.map(x => (t += k(x.budget))); })() }], v => fmtK(v), { label: "Cumulative budget and actual spending" }))}
   </div>
   <div class="card"><h3>By category</h3><div class="tw"><table class="t"><thead><tr><th>Category</th><th class="num">Annual budget</th><th class="num">Budget to date</th><th class="num">Actual to date</th><th class="num">Variance</th><th class="num">Used</th><th>Status</th></tr></thead><tbody>
    ${F.cats.filter(c => c.annual || c.ytdA).map(c => { const v = c.ytdB - c.ytdA, s = c.cat === "Revenue" ? (c.ytdA >= c.ytdB ? ["At or above budget", "ok"] : ["Below budget", "warn"]) : st(c.ytdB, c.ytdA, true);
      return `<tr${c.cat === "Revenue" ? ' class="rev"' : ""}><td>${esc(c.cat)}${c.cat === "Revenue" ? ' <span class="badge info">income</span>' : ""}</td><td class="num">${fm(k(c.annual))}</td><td class="num">${fm(k(c.ytdB))}</td><td class="num">${fm(k(c.ytdA))}</td><td class="num ${(c.cat === "Revenue" ? -v : v) < 0 ? "neg" : ""}">${fm(k(c.cat === "Revenue" ? c.ytdA - c.ytdB : v))}</td><td class="num">${c.annual ? Math.round(c.ytdA / c.annual * 100) + "%" : "—"}</td><td><span class="badge ${s[1]}">${s[0]}</span></td></tr>`; }).join("") || '<tr><td colspan="7" class="empty">No budget figures yet.</td></tr>'}
    <tr class="tot"><td>Total spending</td><td class="num">${fm(k(F.annual))}</td><td class="num">${fm(k(F.ytdB))}</td><td class="num">${fm(k(F.ytdA))}</td><td class="num ${varY < 0 ? "neg" : ""}">${fm(k(varY))}</td><td class="num">${Math.round(used)}%</td><td></td></tr></tbody></table></div><p class="help">Amounts in ${esc(vcur)}. Variance for spending is budget minus actual; for revenue it is actual minus budget.</p></div>
   <div class="card"><h3>Month by month (spending)</h3><div class="tw"><table class="t"><thead><tr><th>Period</th><th>Month</th><th class="num">Budget</th><th class="num">Actual</th><th class="num">Variance</th><th>Status</th></tr></thead><tbody>
    ${F.monthly.map(x => { const s = !x.share ? ["Not yet due", ""] : x.share < 1 ? (x.actual > x.budget ? ["Over budget", "bad"] : ["Current month", "info"]) : st(x.budget, x.actual, true);
      return `<tr><td>${x.m.p}</td><td>${x.m.label}</td><td class="num">${fm(k(x.budget))}</td><td class="num">${x.share ? fm(k(x.actual)) : "—"}</td><td class="num ${x.share && x.budget - x.actual < 0 ? "neg" : ""}">${x.share ? fm(k(x.budget - x.actual)) : ""}</td><td>${s[1] || s[0] !== "Not yet due" ? `<span class="badge ${s[1]}">${s[0]}</span>` : `<span class="muted small">${s[0]}</span>`}</td></tr>`; }).join("")}</tbody></table></div></div>
   <div class="card"><h3>History</h3>${historyHTML(Store.history("budgets", b.id))}</div>`;
};
ACTIONS["bud-new"] = el => { const y = +today().slice(0, 4) - (today().slice(5, 7) < "04" ? 1 : 0);
  openModal(`<h2>New budget</h2><form class="f" data-form="bud-new"><div class="grid2">${fieldRow("Title", `<input name="title" value="Budget ${y}/${String(y + 1).slice(2)}" required>`)}${fieldRow("Financial year starts", `<input type="date" name="fy_start" value="${y}-04-01" required>`, "The budget covers 12 months from this date.")}
   ${fieldRow("Budget currency", `<input name="currency" value="USD" maxlength="3" list="currencies" style="text-transform:uppercase" required>`, "Figures are entered in this currency. You can view them in other currencies.")}</div>
   <datalist id="currencies">${["USD", "LKR", "GBP", "EUR", "SGD"].map(c => `<option>${c}</option>`).join("")}</datalist>
   <div class="row"><button class="btn p">Create</button><button type="button" class="btn" data-act="modal-close">Cancel</button></div></form>`); };
FORMS["bud-new"] = async form => { const o = readForm(form), cur = o.currency.trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(cur)) throw ["Use a three-letter currency code."];
  const id = await Store.save("budgets", { title: o.title.trim(), fy_start: o.fy_start.slice(0, 7) + "-01", currency: cur, status: "Draft", lines: {}, prepared_by: Store.uid });
  await Store.audit("budgets", id, "Created", o.title); closeModal(); UI.params.bud = id; go({ kind: "budedit", id }); };
ACTIONS["bud-copy"] = async el => { const b = Store.get("budgets", el.dataset.id), fy = addMonths(b.fy_start, 12), y = fy.slice(0, 4);
  if (Store.list("budgets").some(x => x.fy_start === fy)) throw [`There is already a budget starting ${fmtDate(fy)}.`];
  const id = await Store.save("budgets", { title: `Budget ${y}/${String(+y + 1).slice(2)}`, fy_start: fy, currency: b.currency, status: "Draft", lines: clone(b.lines || {}), prepared_by: Store.uid, copied_from: b.id });
  await Store.audit("budgets", id, "Created", `Copied from ${b.title}`); UI.params.bud = id; toast("Copied. Change the figures as needed."); render(); };
ACTIONS["bud-edit"] = el => go({ kind: "budedit", id: el.dataset.id });
ACTIONS["bud-ready"] = async el => { const b = Store.get("budgets", el.dataset.id); await Store.save("budgets", { status: "Ready for approval", ready_by: Store.uid }, b.id); await Store.audit("budgets", b.id, "Sent for approval", b.title); toast("Sent for approval."); };
ACTIONS["bud-approve"] = async el => { const b = Store.get("budgets", el.dataset.id); needDifferentPerson(b.ready_by || b.prepared_by, "approve this budget");
  await Store.save("budgets", { status: "Approved", approved_by: Store.uid, approved_at: nowIso() }, b.id); await Store.audit("budgets", b.id, "Approved", b.title); toast("Budget approved."); };
ACTIONS["bud-reopen"] = async el => { const b = Store.get("budgets", el.dataset.id); await Store.save("budgets", { status: "Draft" }, b.id); await Store.audit("budgets", b.id, "Reopened", b.title); };
VIEWS.budedit = ({ id }) => {
  const b = Store.get("budgets", id); if (!b) return '<p class="empty">Not found.</p>';
  const ms = monthsBetween(b.fy_start, 12), L = b.lines || {};
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Budget</button><h1>${esc(b.title)}: budget figures</h1><p class="muted">Amounts in ${esc(b.currency)}. Type an annual figure and click <b>Spread</b> to divide it evenly across the months, or type each month. Revenue is income; all other lines are spending. Leave lines you don't budget for blank.</p></div></div>
   <form class="f" data-form="budedit" data-id="${b.id}" novalidate><div class="tw bgrid"><table class="t"><thead><tr><th>Category</th><th class="num">Annual</th><th></th>${ms.map(m => `<th class="num">${m.p}<div class="help">${m.label}</div></th>`).join("")}</tr></thead><tbody>
   ${BUDGET_ROWS.map((c, r) => { const mv = (L[c] && L[c].months) || []; const tot = mv.reduce((t, v) => t + (Number(v) || 0), 0);
     return `<tr${c === "Revenue" ? ' class="rev"' : ""}><td>${esc(c)}</td><td><input class="num" name="a_${r}" value="${tot ? r2(tot) : ""}" inputmode="decimal" aria-label="${esc(c)} annual" data-row="${r}"></td><td><button type="button" class="btn sm" data-act="bud-spread" data-row="${r}">Spread</button></td>
     ${ms.map((m, i) => `<td><input class="num" name="m_${r}_${i}" value="${mv[i] != null && mv[i] !== 0 ? mv[i] : ""}" inputmode="decimal" aria-label="${esc(c)} ${m.label}" data-row="${r}"></td>`).join("")}</tr>`; }).join("")}
   <tr class="tot"><td>Total spending</td><td class="num" id="bud-tot"></td><td></td>${ms.map((m, i) => `<td class="num" id="bud-tot-${i}"></td>`).join("")}</tr></tbody></table></div>
   <div class="row"><button class="btn p">Save budget</button><button type="button" class="btn" data-act="back">Cancel</button></div></form>`;
};
function budTotals(form) {
  const n = s => Number(String(s || "").replace(/,/g, "")) || 0; let all = 0;
  for (let i = 0; i < 12; i++) { let t = 0; BUDGET_ROWS.forEach((c, r) => { if (c !== "Revenue") t += n(form[`m_${r}_${i}`].value); }); all += t; const el = document.getElementById("bud-tot-" + i); if (el) el.textContent = fmtK(t); }
  BUDGET_ROWS.forEach((c, r) => { let t = 0; for (let i = 0; i < 12; i++) t += n(form[`m_${r}_${i}`].value); if (document.activeElement !== form["a_" + r] && t) form["a_" + r].value = r2(t); });
  const el = document.getElementById("bud-tot"); if (el) el.textContent = fmtK(all);
}
ACTIONS["bud-spread"] = el => { const f = el.closest("form"), r = el.dataset.row, a = Number(String(f["a_" + r].value).replace(/,/g, "")) || 0;
  const each = Math.floor(a / 12 * 100) / 100; for (let i = 0; i < 12; i++) f[`m_${r}_${i}`].value = i < 11 ? each : r2(a - each * 11); budTotals(f); };
FORMS.budedit = async form => {
  const b = Store.get("budgets", form.dataset.id), o = readForm(form), lines = {}, errs = [];
  BUDGET_ROWS.forEach((c, r) => { const months = []; for (let i = 0; i < 12; i++) { const s = String(o[`m_${r}_${i}`] || "").replace(/,/g, "").trim(); if (s === "") { months.push(0); continue; } const v = Number(s); if (!Number.isFinite(v)) { errs.push(`${c}, month ${i + 1}: please enter a number.`); months.push(0); } else months.push(v); }
    if (months.some(v => v)) lines[c] = { months }; });
  if (errs.length) throw errs;
  await Store.save("budgets", { lines, prepared_by: Store.uid }, b.id); await Store.audit("budgets", b.id, "Figures saved", `${b.title}: ${Object.keys(lines).length} line(s)`);
  toast("Budget saved."); back();
};
ACTIONS["bud-export"] = async el => {
  const b = Store.get("budgets", el.dataset.id), asAt = UI.params.bud_as_at || today(), F = budgetFigures(b, asAt), c = Store.company();
  chooseFormat({ title: b.title + " - budget and actuals", subtitle: `${c.name} · ${b.currency} · as at ${fmtDate(asAt)} · ${b.status}`, demo: !!c.is_demo, notes: ["Management information. Not a Commission requirement. Actuals come from the financial records in the system."],
    sections: [{ heading: "By category", columns: ["Category", "Annual budget", "Budget to date", "Actual to date", "Variance"], rows: F.cats.filter(x => x.annual || x.ytdA).map(x => [x.cat, r2(x.annual), r2(x.ytdB), r2(x.ytdA), r2(x.cat === "Revenue" ? x.ytdA - x.ytdB : x.ytdB - x.ytdA)]) },
      { heading: "Monthly budget by category", columns: ["Category", ...F.ms.map(m => m.label)], rows: F.cats.filter(x => x.annual).map(x => [x.cat, ...x.months.map(r2)]) },
      { heading: "Month by month (spending)", columns: ["Month", "Budget", "Actual", "Variance"], rows: F.monthly.map(x => [x.m.label, r2(x.budget), x.share ? r2(x.actual) : "", x.share ? r2(x.budget - x.actual) : ""]) }] }, (c.is_demo ? "DEMO_" : "") + b.title.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_" + today());
};
document.addEventListener("input", ev => { const f = ev.target.closest && ev.target.closest('form[data-form="budedit"]'); if (f && ev.target.name && ev.target.name.startsWith("m_")) budTotals(f); });

/* ======================= CAPITAL INFLOW TARGETS (Investment) ======================= */
const INFLOW_BASIS = ["Business plan projection (not a commitment)", "Condition in our licence, approval or agreement", "Internal target"];
function inflowActual(t) {
  return Store.list("investments").filter(i => i.entry_date >= t.start && i.entry_date <= t.end && i.usd_amount != null && (t.counts === "All receipts" || (i.review_status === "Confirmed" && FDI.includes(i.classification))));
}
function inflowHTML(vcur) {
  const ts = Store.list("inflows").sort((a, b) => b.start.localeCompare(a.start)), w = Store.can("investment", "write");
  const t = Store.get("inflows", UI.params.inflow) || ts[0];
  const k = v => v == null ? null : v * (perUSD(vcur) || 1), f = v => fmtCurK(k(v), vcur);
  const top = `<div class="card ctlcard"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Capital inflow targets</h3><div class="row" style="margin:0">${ts.length ? `<select data-change="param" data-k="inflow" aria-label="Target">${ts.map(x => `<option value="${x.id}"${t && x.id === t.id ? " selected" : ""}>${esc(x.title)} (${fmtDate(x.start)} - ${fmtDate(x.end)})</option>`).join("")}</select>` : ""}${w ? '<button class="btn sm p" data-act="inflow-new">New target</button>' : ""}${t && w ? `<button class="btn sm" data-act="inflow-edit" data-id="${t.id}">Edit target</button>` : ""}</div></div>
   <p class="small muted">Set an investment target for a period and the amounts you expect each month. Actual inflows come from the investment and funding register, so nothing is entered twice.</p></div>`;
  if (!t) return top;
  const ms = monthsInRange(t.start, t.end), rows = inflowActual(t), today_ = today();
  const act = ms.map(m => rows.filter(i => i.entry_date >= m.start && i.entry_date <= m.end).reduce((s, i) => s + i.usd_amount, 0));
  const exp = ms.map(m => Number((t.expected || {})[m.key]) || 0);
  const recv = act.reduce((s, v) => s + v, 0), left = Math.max(0, t.target_usd - recv), met = t.target_usd ? recv / t.target_usd * 100 : 0;
  const expToDate = ms.reduce((s, m, i) => s + exp[i] * (m.start <= today_ ? 1 : 0), 0);
  let ca = 0, ce = 0; const cumA = ms.map((m, i) => m.start <= today_ ? (ca += act[i], k(ca)) : null), cumE = ms.map((m, i) => (ce += exp[i], k(ce)));
  return top + hlCards([
    { value: f(t.target_usd), label: "Target", sub: `${fmtDate(t.start)} to ${fmtDate(t.end)}` },
    { value: f(recv), label: "Received so far", sub: t.counts === "All receipts" ? "all receipts in the register" : "confirmed FDI only" },
    { value: f(left), label: "Still to receive", kind: left && t.end < today_ ? "bad" : "" },
    { value: Math.round(met) + "%", label: "Of target met", kind: met >= 100 ? "" : "warn" },
    { value: expToDate ? Math.round(recv / expToDate * 100) + "%" : "—", label: "Of the amount expected by now", sub: expToDate ? `${f(expToDate)} expected to date` : "no monthly schedule entered" }])
  + `<p class="small muted">Why this target applies: <b>${esc(t.basis)}</b>${t.source_ref ? " · " + esc(t.source_ref) : ""}</p>
   <div class="vgrid">${vizCard(`Cumulative inflow vs target (${vcur})`, lineChart(ms.map(m => m.label), [{ name: "Received (cumulative)", values: cumA }, { name: "Expected (cumulative)", values: cumE, dash: true }], v => fmtK(v), { target: k(t.target_usd), label: "Cumulative inflows against target" }))}
    ${vizCard(`Received each month (${vcur})`, cols(ms.map((m, i) => ({ label: i % Math.ceil(ms.length / 8) === 0 ? m.label : "", tip: m.label, value: r2(k(act[i])) })), v => fmtK(v)))}</div>
   <details class="card quick"${Object.keys(t.expected || {}).length ? "" : " open"}><summary><b>Monthly schedule</b> <span class="muted small">- enter the amount you expect each month (USD); "Received" is worked out from the register</span></summary>
    <form data-form="inflow-exp" data-id="${t.id}"><div class="tw"><table class="t"><thead><tr><th>Period</th><th>Dates</th><th class="num">Expected (USD)</th><th class="num">Received (USD)</th><th class="num">Difference</th></tr></thead><tbody>
    ${ms.map((m, i) => `<tr><td><b>${esc(m.label)}</b></td><td class="small muted">${fmtDate(m.start)} - ${fmtDate(m.end)}</td><td class="num">${w ? `<input class="num" name="e_${m.key}" value="${exp[i] || ""}" inputmode="decimal" aria-label="Expected ${m.label}" style="width:120px">` : fmtMoney(exp[i])}</td><td class="num">${m.start <= today_ ? fmtMoney(r2(act[i])) : "—"}</td><td class="num ${act[i] - exp[i] < 0 && m.start <= today_ ? "neg" : ""}">${m.start <= today_ ? fmtMoney(r2(act[i] - exp[i])) : ""}</td></tr>`).join("")}
    <tr class="tot"><td>Total</td><td></td><td class="num">${fmtMoney(r2(exp.reduce((s, v) => s + v, 0)))}</td><td class="num">${fmtMoney(r2(recv))}</td><td></td></tr></tbody></table></div>${w ? '<div class="row"><button class="btn p sm">Save schedule</button></div>' : ""}</form></details>`;
}
function inflowModal(t) {
  return `<h2>${t ? "Edit" : "New"} inflow target</h2><form class="f" data-form="inflow" data-id="${t ? t.id : ""}"><div class="grid2">
   ${fieldRow("Name", `<input name="title" value="${esc(t ? t.title : "Initial investment")}" required>`)}${fieldRow("Target (USD)", `<input name="target_usd" inputmode="decimal" value="${t ? t.target_usd : ""}" required>`)}
   ${fieldRow("From", `<input type="date" name="start" value="${t ? t.start : today().slice(0, 7) + "-01"}" required>`)}${fieldRow("To", `<input type="date" name="end" value="${t ? t.end : ""}" required>`)}
   ${fieldRow("What counts", `<select name="counts">${["Confirmed FDI only", "All receipts"].map(o => `<option${t && t.counts === o ? " selected" : ""}>${o}</option>`).join("")}</select>`)}
   ${fieldRow("Why this target applies", `<select name="basis">${INFLOW_BASIS.map(o => `<option${t && t.basis === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`, "Only treat it as a commitment if your licence, approval or an agreement says so.")}
   ${fieldRow("Source (document and clause, or plan version)", `<input name="source_ref" value="${esc(t ? t.source_ref || "" : "")}">`)}</div>
   <div class="row"><button class="btn p">Save</button><button type="button" class="btn" data-act="modal-close">Cancel</button></div></form>`;
}
ACTIONS["inflow-new"] = () => openModal(inflowModal(null));
ACTIONS["inflow-edit"] = el => openModal(inflowModal(Store.get("inflows", el.dataset.id)));
FORMS.inflow = async form => { const o = readForm(form), n = Number(String(o.target_usd).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) throw ["Enter the target as a number above zero."]; if (!o.end || o.end < o.start) throw ["The end date must be after the start date."];
  const id = await Store.save("inflows", { title: o.title.trim(), target_usd: n, start: o.start, end: o.end, counts: o.counts, basis: o.basis, source_ref: o.source_ref.trim() || null }, form.dataset.id || null);
  await Store.audit("inflows", id, form.dataset.id ? "Updated" : "Created", `Inflow target ${o.title}: USD ${fmtMoney(n)}`); UI.params.inflow = id; closeModal(); toast("Target saved."); };
FORMS["inflow-exp"] = async form => { const t = Store.get("inflows", form.dataset.id), o = readForm(form), expected = {}, errs = [];
  Object.entries(o).forEach(([kk, v]) => { const s = String(v).replace(/,/g, "").trim(); if (!s) return; const n = Number(s); if (!Number.isFinite(n)) errs.push(`${kk.slice(2)}: please enter a number.`); else expected[kk.slice(2)] = n; });
  if (errs.length) throw errs; await Store.save("inflows", { expected }, t.id); await Store.audit("inflows", t.id, "Schedule saved", t.title); toast("Schedule saved."); };

