import Link from "next/link";
import { ActionForm } from "@/components/admin-ui";
import { PlanCharts, PlanHighlights, PlanVsActual, type PlanYear } from "@/components/plan-pva";
import { withTenant } from "@/lib/db";
import { fmtDate } from "@/lib/forms";
import { canRestricted } from "@/lib/documents";
import { createReports } from "@/lib/reports/engine";
import { loadReportStore } from "@/lib/reports/store";
import { can, requirePermission } from "@/lib/tenant";
import { newPlan } from "./actions";

const TONE: Record<string, string> = { Draft: "info", "Ready for check": "warn", Locked: "ok" };
export default async function BusinessPlans() {
  const ctx = await requirePermission("bplan");
  const { rows, ref, pva } = await withTenant(ctx.org.id, async (tx) => {
    const store = await loadReportStore(tx, ctx);
    const eng = createReports(store, () => canRestricted(ctx));
    const refV = eng.referencePlan();
    return { rows: await tx.businessPlan.findMany({ where: { organizationId: ctx.org.id }, orderBy: { versionNo: "desc" } }), ref: refV as { id: string; title: string; version_no: number } | null, pva: (refV ? eng.comparePlan(refV) : []) as PlanYear[] };
  });
  const w = can(ctx, "bplan", "write");
  return (
    <>
      <div className="head"><div className="t"><h1>Business plan reference</h1><p className="muted">Record the business plan your company submitted to the Commission, so actual progress can be compared with it. Business plan figures are projections, not commitments, unless your licence, approval or an agreement says otherwise. Year-by-year fields follow the AP Technical Evaluation Form.</p></div>
        <div className="acts">{w && <form action={newPlan}><button className="btn p">{rows.length ? "Record another plan version" : "Record the business plan"}</button></form>}{rows.length > 1 && <Link className="btn" href="/bplan/compare">Compare versions</Link>}</div></div>
      <PlanHighlights rows={pva} />
      <div className="card qz-scroll"><table className="qz-table"><thead><tr><th>Version</th><th>Title</th><th>What it is</th><th>Date given to the Commission</th><th>Status</th><th>Used for comparison</th></tr></thead>
        <tbody>{rows.map((v) => <tr key={v.id}><td>v{v.versionNo}</td><td><Link href={`/bplan/${v.id}`}>{v.title}</Link></td><td className="small">{v.commissionStatus}</td><td>{fmtDate(v.commissionDate)}</td><td><span className={`badge ${TONE[v.status] ?? "info"}`}>{v.status}</span></td><td>{ref?.id === v.id && <span className="badge ok">Reference</span>}</td></tr>)}</tbody></table>
        {!rows.length && <p className="muted">No business plan recorded yet. Enter the figures from the plan you submitted with your licence application.</p>}
      </div>
      {ref ? <><h2>Plan vs actual</h2><p className="muted">Compared with {ref.title} v{ref.version_no}. Explain any large difference in the last column; the Commission may ask about progress against the plan.</p><PlanCharts rows={pva} /><PlanVsActual id={ref.id} rows={pva} writable={w} /></> : rows.length > 0 && <p className="note">Check and lock a plan version to use it for comparison.</p>}
    </>
  );
}
