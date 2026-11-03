// @ts-nocheck
/* Reviewed port of the calculation part of docs/artifact/src/budget.js, kept verbatim so it stays comparable with the source.
   `Store` needs list(type); fin_entries and fx_rates are the only records read. */
import { daysUntil } from "@/lib/forms";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const BUDGET_EXP = ["Capital expenditure", "Basic remuneration", "Allowance payments", "Bonus payments", "Staff accommodation", "Health insurance", "Transportation", "Office rent", "Other staff benefits", "Other operational expenditure", "EPF payment", "ETF payment", "Gratuity payment"];
export const BUDGET_ROWS = ["Revenue", ...BUDGET_EXP];
const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export { addDays };

export function createBudget(Store): { perUSD: (c: string) => number | null; viewCurrencies: () => string[]; convert: (v: number, a: string, b: string) => number | null; addMonths: (d: string, n: number) => string; monthsBetween: (s: string, n: number) => any[]; budgetFigures: (b: any, asAt: string) => any } {
function perUSD(cur) {
  if (!cur || cur === "USD") return 1;
  const rs = Store.list("fx_rates").slice().sort((a, b) => b.rate_date.localeCompare(a.rate_date));
  const r = rs.find(x => x.currency === cur && Number(x.per_usd)); if (r) return Number(r.per_usd);
  if (cur === "LKR") { const u = rs.find(x => x.currency === "USD" && Number(x.lkr_per_unit)); if (u) return Number(u.lkr_per_unit); }
  return null;
}
function viewCurrencies() { const s = new Set(["USD", "LKR"]); Store.list("fx_rates").forEach(r => { if (perUSD(r.currency)) s.add(r.currency); }); return [...s].filter(c => perUSD(c)); }
function convert(v, a, b) { if (v == null) return null; if (a === b) return v; const pa = perUSD(a), pb = perUSD(b); return pa && pb ? v / pa * pb : null; }
function addMonths(d, n) { const x = new Date(d.slice(0, 7) + "-01T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); }
function monthsBetween(start, count) {
  return Array.from({ length: count }, (_, i) => { const s = addMonths(start, i), e = addDays(addMonths(start, i + 1), -1);
    return { key: s.slice(0, 7), start: s, end: e, label: MONTHS[+s.slice(5, 7) - 1] + " " + s.slice(2, 4), p: "P" + String(i + 1).padStart(2, "0") }; });
}
function elapsedShare(m, asAt) { if (m.end <= asAt) return 1; if (m.start > asAt) return 0; const days = daysUntil(m.end) - daysUntil(m.start) + 1; return (daysUntil(asAt) - daysUntil(m.start) + 1) / days; }
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
  return { perUSD, viewCurrencies, convert, addMonths, monthsBetween, budgetFigures };
}
