import { planHashBody } from "../src/lib/bplan";
import { createBudget } from "../src/lib/budget-engine";
import { assertDifferentPerson } from "../src/lib/controls";
import { todayISO } from "../src/lib/forms";
import { createReports } from "../src/lib/reports/engine";

/** Expected values are worked out by hand. No database needed. */
let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`); if (!ok) failed++; };
const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

/* ---------- budget ---------- */
const fin = (entry_date: string, category: string, cur: string, amt: number, usd: number | null, lkr: number | null = null) => ({ entry_date, category, original_currency: cur, original_amount: amt, usd_amount: usd, lkr_amount: lkr });
const records: Record<string, unknown[]> = {
  fin_entries: [
    fin("2026-04-10", "Office rent", "USD", 100, 100, 30000),
    fin("2026-05-10", "Office rent", "LKR", 30000, 100, 30000), // USD budget uses its USD figure
    fin("2026-05-20", "Office rent", "USD", 999, 999), // after the as-at date
    fin("2026-03-31", "Office rent", "USD", 999, 999), // before the year
    fin("2026-05-01", "Office rent", "EUR", 50, null), // can't be converted: reported, not guessed
    fin("2026-04-15", "Revenue", "USD", 500, 500),
    fin("2026-04-16", "Not a budget category", "USD", 999, 999),
  ],
  fx_rates: [{ rate_date: "2026-01-01", currency: "LKR", per_usd: 250 }, { rate_date: "2026-04-01", currency: "LKR", per_usd: 300 }, { rate_date: "2026-04-01", currency: "GBP", per_usd: 0.8 }],
};
const E = createBudget({ list: (t: string) => records[t] ?? [] });
const flat = (n: number) => Array(12).fill(n);
const b = { fy_start: "2026-04-01", currency: "USD", lines: { "Office rent": { months: flat(100) }, Revenue: { months: flat(1000) } } };
const F = E.budgetFigures(b, "2026-05-16");
const rent = F.cats.find((c: { cat: string }) => c.cat === "Office rent");
eq("annual budget adds 12 months, spending only", F.annual, 1200);
eq("budget to date is pro rata: all of April plus 16/31 of May", near(F.ytdB, 100 + (100 * 16) / 31), true);
eq("actual counts only this year, up to the as-at date", F.ytdA, 200);
eq("rent actual, in USD", rent.ytdA, 200);
eq("revenue stays out of spending", [F.rev.ytdA, F.ytdA], [500, 200]);
eq("a record that can't be converted is reported, not guessed", F.missing.length, 1);
eq("categories not budgeted for are ignored", F.cats.some((c: { cat: string }) => c.cat === "Not a budget category"), false);
eq("months line up with the financial year", [F.ms[0].key, F.ms[11].key, F.ms[0].p], ["2026-04", "2027-03", "P01"]);
eq("month shares: past 1, part-way, future 0", [F.monthly[0].share, near(F.monthly[1].share, 16 / 31), F.monthly[2].share], [1, true, 0]);
const Fl = E.budgetFigures({ ...b, currency: "LKR" }, "2026-05-16");
eq("an LKR budget uses original LKR, then converts USD through the latest rate", Fl.cats.find((c: { cat: string }) => c.cat === "Office rent").ytdA, 60000);
eq("the latest rate is used", E.perUSD("LKR"), 300);
eq("view currency converts through USD", [E.convert(300, "USD", "LKR"), E.convert(90000, "LKR", "USD"), E.convert(100, "GBP", "LKR")], [90000, 300, 37500]);
eq("no rate means no conversion", E.convert(100, "USD", "JPY"), null);
eq("view currencies are those with a rate", E.viewCurrencies().sort(), ["GBP", "LKR", "USD"]);

/* ---------- plan vs actual ---------- */
const yrs = (n: number) => `${Number(todayISO().slice(0, 4)) - n}-01-01`;
const y1 = yrs(1), y1End = `${y1.slice(0, 4)}-12-31`;
const plan = { id: "v1", title: "P", version_no: 1, status: "Locked", is_reference: true, year1_start: y1, years: [{ fdi_usd: 1000, local_employees: 4, foreign_employees: 1, office_sqm: 100, revenue_usd: 500 }, { fdi_usd: 500, local_employees: 8, foreign_employees: 2 }], notes: { "1:employees": "Hiring was slower" }, milestones: [] };
const data: Record<string, unknown[]> = {
  bplans: [plan, { id: "v0", version_no: 2, status: "Draft", is_reference: false }],
  investments: [
    { entry_date: `${y1.slice(0, 4)}-03-01`, classification: "Equity investment", review_status: "Confirmed", usd_amount: 600 },
    { entry_date: `${y1.slice(0, 4)}-04-01`, classification: "Equity investment", review_status: "Pending", usd_amount: 9999 },
    { entry_date: `${y1.slice(0, 4)}-05-01`, classification: "Service revenue or customer receipt", review_status: "Confirmed", usd_amount: 9999 },
  ],
  employees: [{ start_date: `${y1.slice(0, 4)}-02-01`, status: "Active", worker_type: "Employee", nationality_group: "Sri Lankan" }, { start_date: `${y1.slice(0, 4)}-02-01`, status: "Active", worker_type: "Independent contractor", nationality_group: "Sri Lankan" }],
  offices: [{ id: "o", location: "Inside Colombo Port City", area_sqm: 80, status: "In use" }],
  fin_entries: [{ entry_date: `${y1.slice(0, 4)}-06-01`, category: "Revenue", usd_amount: 300 }, { entry_date: `${y1.slice(0, 4)}-06-02`, category: "Revenue", usd_amount: null }],
};
const R = createReports({ list: (t: string) => data[t] ?? [], get: (t: string, id: string) => (data[t] as { id: string }[] ?? []).find((x) => x.id === id) ?? null, can: () => true, canSee: () => true, company: () => ({ name: "T" }), name: (x: unknown) => x, setting: () => 0 }, () => true);
eq("the reference is the locked version marked for comparison, never a draft", R.referencePlan()?.id, "v1");
const c = R.comparePlan(plan), Y1 = c[0], m = (k: string) => Y1.metrics.find((x: { key: string }) => x.key === k);
eq("plan years stop at today", c.length, 2);
eq("year 1 runs its full twelve months", [Y1.start, Y1.end, Y1.complete], [y1, y1End, true]);
eq("investment counts only confirmed FDI", [m("investment").plan, m("investment").actual, m("investment").diff], [1000, 600, -400]);
eq("the source says records are awaiting review", m("investment").source.includes("awaiting review"), true);
eq("employees: employees only, plan adds local and foreign", [m("employees").plan, m("employees").actual, m("employees").diff], [5, 1, -4]);
eq("the source says contractors are excluded", m("employees").source.includes("1 contractor(s) excluded"), true);
eq("office space", [m("office").plan, m("office").actual], [100, 80]);
eq("revenue says when a record has no USD figure", [m("revenue").actual, m("revenue").source.includes("1 without a USD figure")], [300, true]);
eq("an explanation stays with its year and measure", m("employees").note, "Hiring was slower");
const y2 = c[1], cum = y2.metrics.find((x: { key: string }) => x.key === "investment_cum");
eq("cumulative adds plan years and actuals", [cum.plan, cum.actual], [1500, 600]);
const noPlan = createReports({ list: () => [], get: () => null, can: () => true, canSee: () => true, company: () => ({ name: "T" }), name: (x: unknown) => x, setting: () => 0 }, () => true);
eq("with no locked plan there's no reference", noPlan.referencePlan() ?? null, null);
eq("plan years don't start before Year 1", noPlan.comparePlan({ year1_start: "2999-01-01", years: [] }).length, 0);

/* ---------- fingerprint and second-person rule ---------- */
const body = { title: "P", year1Start: "2025-01-01", sections: { a: "x", b: "y" }, years: [{ a: 1, b: 2 }], milestones: [{ milestone: "M", target_date: "2026-01-01" }] };
const h = planHashBody(body);
eq("fingerprint doesn't depend on key order", planHashBody({ ...body, sections: { b: "y", a: "x" }, years: [{ b: 2, a: 1 }] }), h);
eq("fingerprint changes with a figure", planHashBody({ ...body, years: [{ a: 1, b: 3 }] }) === h, false);
eq("fingerprint changes with a milestone target", planHashBody({ ...body, milestones: [{ milestone: "M", target_date: "2026-02-01" }] }) === h, false);
eq("progress on a milestone doesn't change the fingerprint", planHashBody({ ...body, milestones: [{ milestone: "M", target_date: "2026-01-01", actual_status: "Achieved" } as never] }), h);
const blocked = (req: boolean, by: string | null, u: string) => { try { assertDifferentPerson(req, by, u, "approve"); return false; } catch { return true; } };
eq("second-person rule: same person blocked when on", blocked(true, "a", "a"), true);
eq("second-person rule: a different person passes", blocked(true, "a", "b"), false);
eq("second-person rule: same person allowed when off", blocked(false, "a", "a"), false);
console.log(failed ? `\n${failed} FAILED` : "\nAll plan and budget checks passed");
process.exit(failed ? 1 : 0);
