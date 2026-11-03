import Link from "next/link";
import { ActionForm } from "@/components/admin-ui";
import { TEMPLATE_LINES, missingLines, type Lines } from "@/lib/ar/store";
import { AR_TEMPLATE } from "@/lib/ar/engine";
import { withTenant } from "@/lib/db";
import { fmtDate } from "@/lib/forms";
import { can, requirePermission } from "@/lib/tenant";
import { createReturn } from "./actions";

const TONE: Record<string, string> = { Draft: "info", "Ready for review": "warn", Approved: "ok", Submitted: "ok" };
export default async function Returns() {
  const ctx = await requirePermission("returns");
  const rows = await withTenant(ctx.org.id, (tx) => tx.annualReturn.findMany({ where: { organizationId: ctx.org.id }, orderBy: { periodEnd: "desc" } }));
  const p = AR_TEMPLATE.period as { start: string; end: string; headcount: string };
  return (
    <>
      <div className="tabs" role="tablist"><Link href="/returns" className="tab on" role="tab" aria-selected>Annual returns</Link><Link href="/r/fin_entries" className="tab" role="tab">Financial records</Link><Link href="/r/housing" className="tab" role="tab">Staff residential units</Link></div>
      <div className="head"><div className="t"><h1>Annual returns</h1><p className="muted">Figures are worked out from your records, you check each line, a second person approves, and the system fills the Commission&apos;s original PDF for you to download, sign and submit yourself.</p></div></div>
      {can(ctx, "returns", "write") && (
        <div className="card"><h3>Start an annual return</h3><p className="small muted">The 2026 form covers 1 April 2025 to 31 March 2026. Change the dates only if the Commission asked for a different period.</p>
          <ActionForm action={createReturn} submit="Create">
            <div className="grid2">
              <div className="fld"><label htmlFor="t">Title</label><input id="t" name="title" defaultValue="Annual Return 2025/26" /></div>
              <div className="fld"><label htmlFor="m">Currency method</label><select id="m" name="currency_method"><option value="split">Split by transaction currency (default)</option><option value="both">Full totals in both USD and LKR</option></select></div>
              <div className="fld"><label htmlFor="a">Period start</label><input id="a" type="date" name="period_start" defaultValue={p.start} /></div>
              <div className="fld"><label htmlFor="b">Period end</label><input id="b" type="date" name="period_end" defaultValue={p.end} /></div>
              <div className="fld"><label htmlFor="c">Headcount as at</label><input id="c" type="date" name="headcount_as_at" defaultValue={p.headcount} /></div>
              <div className="fld"><label htmlFor="d">Office space as at</label><input id="d" type="date" name="office_as_at" defaultValue={p.end} /></div>
            </div>
          </ActionForm>
        </div>
      )}
      <div className="card qz-scroll">{rows.length ? (
        <table className="qz-table"><thead><tr><th>Return</th><th>Period</th><th>Status</th><th>Lines not set</th><th>Submitted</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td><Link href={`/returns/${r.id}`}>{r.title}</Link></td><td>{fmtDate(r.periodStart)} to {fmtDate(r.periodEnd)}</td><td><span className={`badge ${TONE[r.status] ?? "info"}`}>{r.status}</span></td><td>{missingLines(r.lines as Lines).length} of {TEMPLATE_LINES.length}</td><td>{fmtDate(r.submittedAt)}</td></tr>)}</tbody></table>
      ) : <p className="muted">No annual return yet.</p>}</div>
    </>
  );
}
