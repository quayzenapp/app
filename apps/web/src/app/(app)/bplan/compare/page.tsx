import Link from "next/link";
import { BP_YEARS, BP_YEAR_FIELDS } from "@/lib/bplan";
import { withTenant } from "@/lib/db";
import { requirePermission } from "@/lib/tenant";

type Year = Record<string, unknown>;
export default async function Compare({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const p = await searchParams;
  const ctx = await requirePermission("bplan");
  const vs = await withTenant(ctx.org.id, (tx) => tx.businessPlan.findMany({ where: { organizationId: ctx.org.id }, orderBy: { versionNo: "asc" } }));
  const a = vs.find((v) => v.id === p.a) ?? vs[vs.length - 2], b = vs.find((v) => v.id === p.b) ?? vs[vs.length - 1];
  const head = <div className="head"><div className="t"><Link className="link" href="/bplan">← Business plan reference</Link><h1>Compare plan versions</h1></div></div>;
  if (!a || !b) return <>{head}<p className="muted">Two versions are needed to compare.</p></>;
  const rows: [string, unknown, unknown][] = [];
  for (const [k, l] of BP_YEAR_FIELDS) for (let i = 0; i < BP_YEARS; i++) { const x = ((a.years as Year[])[i] ?? {})[k], y = ((b.years as Year[])[i] ?? {})[k]; if (String(x ?? "") !== String(y ?? "")) rows.push([`${l} - year ${i + 1}`, x, y]); }
  const sel = (n: string, cur: string) => <select name={n} defaultValue={cur} aria-label={n === "a" ? "First version" : "Second version"}>{vs.map((v) => <option key={v.id} value={v.id}>v{v.versionNo} {v.status}</option>)}</select>;
  return (
    <>
      {head}
      <form className="row">Compare {sel("a", a.id)} with {sel("b", b.id)}<button className="btn sm">Compare</button></form>
      <div className="card qz-scroll"><h3>Changed figures</h3>{rows.length ? <table className="qz-table"><thead><tr><th>Item</th><th>v{a.versionNo}</th><th>v{b.versionNo}</th></tr></thead><tbody>{rows.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{String(r[1] ?? "—")}</td><td>{String(r[2] ?? "—")}</td></tr>)}</tbody></table> : <p className="muted">No figures changed.</p>}</div>
    </>
  );
}
