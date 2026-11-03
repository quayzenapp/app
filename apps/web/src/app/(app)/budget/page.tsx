import Link from "next/link";
import { ActionForm } from "@/components/admin-ui";
import { Html } from "@/components/plan-pva";
import { addDays } from "@/lib/budget-engine";
import { budgetRow, defaultAsAt, loadBudgetEngine } from "@/lib/budget-store";
import { fmtK, lineChart, pairBars, pairCols } from "@/lib/charts";
import { withTenant } from "@/lib/db";
import { fmtDate, fmtDateTime, todayISO } from "@/lib/forms";
import { can, requirePermission } from "@/lib/tenant";
import { budgetApprove, budgetReady, budgetReopen, copyBudget, createBudgetAction } from "./actions";

type P = { b?: string; as_at?: string; cur?: string };
const TONE: Record<string, string> = { Draft: "info", "Ready for approval": "warn", Approved: "ok" };
const money = (v: number | null) => (v == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
type Cat = { cat: string; annual: number; ytdB: number; ytdA: number };
type Mon = { m: { label: string; p: string }; budget: number; actual: number; share: number };

export default async function BudgetPage({ searchParams }: { searchParams: Promise<P> }) {
  const p = await searchParams;
  const ctx = await requirePermission("budget");
  const today = todayISO(), y = Number(today.slice(0, 4)) - (today.slice(5, 7) < "04" ? 1 : 0);
  const data = await withTenant(ctx.org.id, async (tx) => {
    const bs = await tx.budget.findMany({ where: { organizationId: ctx.org.id }, orderBy: { fyStart: "desc" } });
    const eng = await loadBudgetEngine(tx, ctx.org.id);
    const b = bs.find((x) => x.id === p.b) ?? bs.find((x) => x.fyStart <= today && eng.addMonths(x.fyStart, 12) > today) ?? bs[0] ?? null;
    return { bs, eng, b, history: b && can(ctx, "audit") ? await tx.auditLog.findMany({ where: { organizationId: ctx.org.id, entityType: "budgets", entityId: b.id }, orderBy: { createdAt: "desc" }, take: 20 }) : [] };
  });
  const { bs, eng, b, history } = data, w = can(ctx, "budget", "write"), ap = can(ctx, "budget", "approve");
  const head = <div className="head"><div className="t"><h1>Budget and actuals</h1><p className="muted">Set the company&apos;s budget by month and compare it with the financial records. This is a management tool for your own use. It is not a Commission requirement, and budget figures are not commitments.</p></div>{b && w && <div className="acts"><ActionForm action={copyBudget.bind(null, b.id)} submit="Copy to the next year" /></div>}</div>;
  const newForm = w && (
    <details className="card" open={!b}><summary>New budget</summary>
      <ActionForm action={createBudgetAction} submit="Create"><div className="grid2">
        <div className="fld"><label htmlFor="b_t">Title</label><input id="b_t" name="title" defaultValue={`Budget ${y}/${String(y + 1).slice(2)}`} /></div>
        <div className="fld"><label htmlFor="b_f">Financial year starts</label><input id="b_f" type="date" name="fy_start" defaultValue={`${y}-04-01`} /><span className="help">The budget covers 12 months from this date.</span></div>
        <div className="fld"><label htmlFor="b_c">Budget currency</label><input id="b_c" name="currency" defaultValue="USD" maxLength={3} style={{ textTransform: "uppercase" }} /><span className="help">Figures are entered in this currency. You can view them in other currencies.</span></div>
      </div></ActionForm>
    </details>
  );
  if (!b) return <>{head}{newForm}{!w && <p className="muted">No budget yet.</p>}</>;
  const asAt = p.as_at && /^\d{4}-\d{2}-\d{2}$/.test(p.as_at) ? p.as_at : defaultAsAt(eng, b.fyStart);
  const cs = eng.viewCurrencies().includes(b.currency) ? eng.viewCurrencies() : [b.currency, ...eng.viewCurrencies()];
  const vcur = p.cur && cs.includes(p.cur) && eng.convert(1, b.currency, p.cur) != null ? p.cur : b.currency;
  const k = (v: number) => eng.convert(v, b.currency, vcur) as number;
  const f = (v: number | null) => (v == null ? "—" : `${vcur} ${fmtK(v)}`);
  const F = eng.budgetFigures(budgetRow(b), asAt) as { ms: { label: string }[]; cats: Cat[]; exp: Cat[]; rev: Cat; monthly: Mon[]; missing: unknown[]; annual: number; ytdB: number; ytdA: number };
  const used = F.annual ? (F.ytdA / F.annual) * 100 : 0, varY = F.ytdB - F.ytdA;
  const st = (bud: number, act: number): [string, string] => (!bud && act ? ["No budget", "warn"] : act > bud * 1.0001 && act > 0 ? ["Over budget", "bad"] : ["Within budget", "ok"]);
  const q = (o: Partial<P>) => { const s = new URLSearchParams({ b: b.id, as_at: asAt, cur: vcur, ...o } as Record<string, string>); return `/budget?${s}`; };
  const stat = (v: string, l: string, sub: string, kind = "") => <div className={`stat static ${kind}`} key={l}><b>{v}</b><span>{l}</span><em>{sub}</em></div>;
  let cA = 0, cB = 0;
  const cumA = F.monthly.map((x) => (x.share ? (cA += k(x.actual)) : null)), cumB = F.monthly.map((x) => (cB += k(x.budget)));
  return (
    <>
      {head}{newForm}
      <div className="card ctlcard">
        <form className="row ctl">
          <label className="small">Budget <select name="b" defaultValue={b.id}>{bs.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
          <label className="small">As at <input type="date" name="as_at" defaultValue={asAt} /></label>
          <input type="hidden" name="cur" value={vcur} /><button className="btn sm">Update</button>
          <span className={`badge ${TONE[b.status] ?? "info"}`}>{b.status}</span>
          <span className="small muted">Entered in {b.currency}. Financial year {fmtDate(b.fyStart)} to {fmtDate(addDays(eng.addMonths(b.fyStart, 12), -1))}.{b.approvedByName ? ` Approved by ${b.approvedByName}.` : ""}</span>
        </form>
        <div className="row ctl"><span className="small muted">View in:</span><span className="seg" role="group" aria-label="View currency">{cs.filter((c) => eng.convert(1, b.currency, c) != null).map((c) => <Link key={c} className={`btn sm ${c === vcur ? "p" : ""}`} href={q({ cur: c })}>{c}</Link>)}</span></div>
        <div className="row">
          {w && b.status === "Draft" && <><Link className="btn sm p" href={`/budget/${b.id}/edit`}>Enter or change budget figures</Link><ActionForm action={budgetReady.bind(null, b.id)} submit="Ask for approval" /></>}
          {ap && b.status === "Ready for approval" && <ActionForm action={budgetApprove.bind(null, b.id)} submit="Approve budget" />}
          {w && b.status !== "Draft" && <ActionForm action={budgetReopen.bind(null, b.id)} submit="Reopen for changes" />}
          {(["xlsx", "pdf", "docx"] as const).map((x) => <a key={x} className="btn sm" href={`/budget/${b.id}/export?format=${x}&as_at=${asAt}`}>{x === "xlsx" ? "Excel" : x === "pdf" ? "PDF" : "Word"}</a>)}
        </div>
      </div>
      <div className="stats hlc">
        {stat(f(k(F.annual)), "Annual spending budget", "full financial year")}
        {stat(f(k(F.ytdB)), "Budget to date", `pro rata to ${fmtDate(asAt)}`)}
        {stat(f(k(F.ytdA)), "Actual spending to date", "from financial records")}
        {stat(`${varY >= 0 ? "" : "−"}${f(k(Math.abs(varY)))}`, varY >= 0 ? "Under budget to date" : "Over budget to date", "budget to date minus actual", varY < 0 ? "bad" : "")}
        {stat(`${Math.round(used)}%`, "Annual budget used", "actual to date ÷ annual budget", used > 100 ? "bad" : "")}
        {stat(f(k(F.rev.ytdA)), "Revenue to date", F.rev.ytdB ? `${Math.round((F.rev.ytdA / F.rev.ytdB) * 100)}% of the ${f(k(F.rev.ytdB))} budgeted to date` : "no revenue budget")}
      </div>
      {F.missing.length > 0 && <p className="note warn small">{F.missing.length} financial record(s) in this year could not be converted to {b.currency} and are left out. Add a USD amount or an exchange rate to them.</p>}
      <div className="vgrid">
        <div className="card viz"><h3>Monthly spending: budget vs actual ({vcur})</h3><Html html={pairCols(F.monthly.map((x) => ({ label: x.m.label.slice(0, 3), tip: x.m.label, a: k(x.budget), b: x.share ? k(x.actual) : null, flag: x.share && x.actual > x.budget * 1.0001 && x.actual > 0 ? "over" : "" })), ["Budget", "Actual"], f)} /><p className="help">Months after the as-at date show the budget only.</p></div>
        <div className="card viz"><h3>Budget to date vs actual by category ({vcur})</h3><Html html={pairBars(F.exp.filter((c) => c.annual || c.ytdA).map((c) => ({ label: c.cat, a: k(c.ytdB), b: k(c.ytdA) })), ["Budget to date", "Actual"], f)} /></div>
        <div className="card viz"><h3>Cumulative spending ({vcur})</h3><Html html={lineChart(F.ms.map((m) => m.label), [{ name: "Actual", values: cumA }, { name: "Budget", dash: true, values: cumB }], (v: number) => fmtK(v), { label: "Cumulative budget and actual spending" })} /></div>
      </div>
      <div className="card qz-scroll"><h3>By category</h3>
        <table className="qz-table"><thead><tr><th>Category</th><th>Annual budget</th><th>Budget to date</th><th>Actual to date</th><th>Variance</th><th>Used</th><th>Status</th></tr></thead>
          <tbody>{F.cats.filter((c) => c.annual || c.ytdA).map((c) => { const rev = c.cat === "Revenue", v = rev ? c.ytdA - c.ytdB : c.ytdB - c.ytdA, s: [string, string] = rev ? (c.ytdA >= c.ytdB ? ["At or above budget", "ok"] : ["Below budget", "warn"]) : st(c.ytdB, c.ytdA); return <tr key={c.cat}><td>{c.cat}{rev && <> <span className="badge info">income</span></>}</td><td>{money(k(c.annual))}</td><td>{money(k(c.ytdB))}</td><td>{money(k(c.ytdA))}</td><td style={v < 0 ? { color: "var(--bad)" } : undefined}>{money(k(v))}</td><td>{c.annual ? `${Math.round((c.ytdA / c.annual) * 100)}%` : "—"}</td><td><span className={`badge ${s[1]}`}>{s[0]}</span></td></tr>; })}
            <tr><td><b>Total spending</b></td><td><b>{money(k(F.annual))}</b></td><td><b>{money(k(F.ytdB))}</b></td><td><b>{money(k(F.ytdA))}</b></td><td style={varY < 0 ? { color: "var(--bad)" } : undefined}><b>{money(k(varY))}</b></td><td><b>{Math.round(used)}%</b></td><td /></tr></tbody></table>
        <p className="help">Amounts in {vcur}. Variance for spending is budget minus actual; for revenue it is actual minus budget.</p>
      </div>
      <div className="card qz-scroll"><h3>Month by month (spending)</h3>
        <table className="qz-table"><thead><tr><th>Period</th><th>Month</th><th>Budget</th><th>Actual</th><th>Variance</th><th>Status</th></tr></thead>
          <tbody>{F.monthly.map((x) => { const s: [string, string] = !x.share ? ["Not yet due", ""] : x.share < 1 ? (x.actual > x.budget ? ["Over budget", "bad"] : ["Current month", "info"]) : st(x.budget, x.actual); return <tr key={x.m.p}><td>{x.m.p}</td><td>{x.m.label}</td><td>{money(k(x.budget))}</td><td>{x.share ? money(k(x.actual)) : "—"}</td><td style={x.share && x.budget - x.actual < 0 ? { color: "var(--bad)" } : undefined}>{x.share ? money(k(x.budget - x.actual)) : ""}</td><td>{s[1] ? <span className={`badge ${s[1]}`}>{s[0]}</span> : <span className="muted small">{s[0]}</span>}</td></tr>; })}</tbody></table>
      </div>
      {can(ctx, "audit") && <div className="card"><h3>History</h3>{history.map((a) => <div className="small" key={a.id}>{fmtDateTime(a.createdAt)} · {a.actorEmail ?? "System"} · {a.summary}</div>)}</div>}
    </>
  );
}
