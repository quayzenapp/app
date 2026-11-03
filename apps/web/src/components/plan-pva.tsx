import { ActionForm } from "@/components/admin-ui";
import { fmtDate } from "@/lib/forms";
import { fmtNum, fmtK, pairCols, pct } from "@/lib/charts";
import { saveExplanations } from "@/app/(app)/bplan/actions";

type Metric = { key: string; label: string; plan: number | null; actual: number | null; diff: number | null; source: string; note: string };
export type PlanYear = { year: number; start: string; end: string; asAt: string; complete: boolean; metrics: Metric[] };
export const Html = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />;

export function PlanCharts({ rows }: { rows: PlanYear[] }) {
  if (!rows.length) return null;
  const m = (key: string) => rows.map((y) => { const x = y.metrics.find((z) => z.key === key)!; return { label: `Year ${y.year}`, a: x.plan, b: x.actual }; });
  const card = (t: string, key: string, f: (v: number | null) => string) => <div className="card viz"><h3>{t}</h3><Html html={pairCols(m(key), ["Plan", "Actual"], f)} /></div>;
  return <div className="vgrid">{card("Cumulative investment (USD)", "investment_cum", fmtK)}{card("Employees", "employees", fmtNum)}{card("Office space (sqm)", "office", fmtNum)}{card("Revenue (USD)", "revenue", fmtK)}</div>;
}

export function PlanHighlights({ rows }: { rows: PlanYear[] }) {
  const y = rows[rows.length - 1];
  if (!y) return null;
  const card = (k: string, l: string, f: (v: number | null) => string) => { const x = y.metrics.find((z) => z.key === k)!, p = x.plan ? pct(x.actual ?? 0, x.plan) : null; return <div className={`stat static ${p != null && p < 75 ? "warn" : ""}`}><b>{p != null ? `${p}%` : "—"}</b><span>{l}</span><em>{f(x.actual)} of {x.plan != null ? f(x.plan) : "—"} planned</em></div>; };
  const usd = (v: number | null) => (v == null ? "—" : `USD ${fmtK(v)}`);
  return <div className="stats hlc"><div className="stat static"><b>Year {y.year}</b><span>Current plan year</span><em>{fmtDate(y.start)} to {fmtDate(y.end)}</em></div>{card("investment_cum", "Cumulative investment vs plan", usd)}{card("employees", "Employees vs plan", fmtNum)}{card("office", "Office space vs plan", (v) => (v == null ? "—" : `${fmtNum(v)} sqm`))}{card("revenue", "Revenue vs plan (this year)", usd)}</div>;
}

export function PlanVsActual({ id, rows, writable }: { id: string; rows: PlanYear[]; writable: boolean }) {
  if (!rows.length) return <p className="muted">Year 1 has not started yet.</p>;
  const tables = rows.map((y) => (
    <div className="card qz-scroll" key={y.year}>
      <h3>Year {y.year}: {fmtDate(y.start)} to {fmtDate(y.end)} {!y.complete && <span className="badge info">in progress, actuals to {fmtDate(y.asAt)}</span>}</h3>
      <table className="qz-table"><thead><tr><th>Measure</th><th>Plan (projection)</th><th>Actual</th><th>Difference</th><th>Where the actual comes from</th><th>Explanation of difference</th></tr></thead>
        <tbody>{y.metrics.map((m) => <tr key={m.key}><td>{m.label}</td><td>{fmtNum(m.plan)}</td><td>{fmtNum(m.actual)}</td><td style={m.diff != null && m.diff < 0 ? { color: "var(--bad)" } : undefined}>{m.diff == null ? "" : fmtNum(m.diff)}</td><td className="small muted">{m.source}</td><td>{writable ? <input name={`note_${y.year}:${m.key}`} defaultValue={m.note} aria-label={`Explanation for ${m.label}, year ${y.year}`} placeholder="Add an explanation" /> : m.note}</td></tr>)}</tbody>
      </table>
    </div>
  ));
  return writable ? <ActionForm action={saveExplanations.bind(null, id)} submit="Save explanations">{tables}</ActionForm> : <>{tables}</>;
}
