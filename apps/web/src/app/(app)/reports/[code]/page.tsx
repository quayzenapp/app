import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { fmtDate, todayISO } from "@/lib/forms";
import { fixDates, str } from "@/lib/report-export";
import { runReport } from "@/lib/reports/store";
import { getTenantContext, can } from "@/lib/tenant";

type P = Record<string, string | undefined>;
export default async function ReportPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<P> }) {
  const { code } = await params;
  const p = await searchParams;
  const ctx = await getTenantContext();
  if (!can(ctx, "reports")) redirect("/forbidden");
  let out;
  try { out = await runReport(ctx, code, p); } catch (e) { if ((e as Error).message === "forbidden") redirect("/forbidden"); throw e; }
  if (!out) notFound();
  const { rep, title, options } = out, today = todayISO();
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  const seePersonal = ctx.sensitive.includes("personal"), seePay = ctx.sensitive.includes("pay");
  const dateIn = (k: string, label: string, dflt: string) => <label className="small">{label} <input type="date" name={k} defaultValue={p[k] ?? dflt} /></label>;
  const controls = code === "employees" ? <>{dateIn("as_at", "As at", today)}{seePersonal && <label className="small"><input type="checkbox" name="names" value="1" defaultChecked={p.names === "1"} /> include names</label>}{seePay && <label className="small"><input type="checkbox" name="pay" value="1" defaultChecked={p.pay === "1"} /> include pay</label>}</>
    : code === "office_headcount" ? dateIn("as_at", "As at", today)
    : code === "investment" ? <>{dateIn("start", "From", "2025-04-01")}{dateIn("end", "To", today)}</>
    : code === "visas" ? <label className="small">Expiring within <input type="number" name="days" min={1} max={3650} defaultValue={p.days ?? 180} style={{ width: 80 }} /> days</label>
    : code === "plan_vs_actual" && options.plans.length ? <label className="small">Plan version <select name="vid" defaultValue={p.vid ?? ""}><option value="">Reference version</option>{options.plans.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
    : code === "annual_return" && options.returns.length ? <><label className="small">Return <select name="rid" defaultValue={options.rid}>{options.returns.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>{options.snapshots.length > 0 && <label className="small">Figures <select name="snap" defaultValue={p.snap ?? ""}><option value="">Current working figures</option>{options.snapshots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>}</>
    : null;
  return (
    <>
      <div className="head"><div className="t"><Link className="link" href="/reports">← Reports</Link><h1>{title}</h1></div>
        <div className="acts">{(["xlsx", "pdf", "docx"] as const).map((f) => <a key={f} className="btn" href={`/reports/${code}/export?format=${f}${qs ? `&${qs}` : ""}`}>{f === "xlsx" ? "Excel" : f === "pdf" ? "PDF" : "Word"}</a>)}</div></div>
      {controls && <form className="row" style={{ marginBottom: 12 }}>{controls}<button className="btn sm">Update</button></form>}
      <div className="card rdoc">
        {rep.subtitle && <p className="muted">{fixDates(rep.subtitle)}</p>}
        {rep.demo && <div className="banner demo">DEMO DATA: made-up sample figures, not for submission.</div>}
        {!!rep.notes?.length && <ul className="small muted">{rep.notes.map((n) => <li key={n}>{fixDates(n)}</li>)}</ul>}
        <p className="small muted">Prepared {fmtDate(today)}.</p>
        {rep.sections.map((s, i) => (
          <div key={i} className="qz-scroll" style={{ marginTop: 18 }}>
            {s.heading && <h3>{fixDates(s.heading)}</h3>}
            {s.text && <p>{fixDates(s.text)}</p>}
            {s.columns && ((s.rows ?? []).length ? (
              <table className="qz-table"><thead><tr>{s.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{s.rows!.map((r, j) => <tr key={j}>{r.map((v, k) => <td key={k} style={typeof v === "number" ? { textAlign: "right", fontVariantNumeric: "tabular-nums" } : undefined}>{str(v)}</td>)}</tr>)}</tbody></table>
            ) : !s.text && <p className="muted small">None.</p>)}
          </div>
        ))}
      </div>
    </>
  );
}
