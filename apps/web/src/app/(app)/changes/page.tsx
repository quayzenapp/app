import Link from "next/link";
import { ActionForm } from "@/components/admin-ui";
import { withTenant } from "@/lib/db";
import { can, requirePermission } from "@/lib/tenant";
import { startChange } from "./actions";
export default async function Changes() {
  const ctx = await requirePermission("licensing");
  const rows = await withTenant(ctx.org.id, (tx) => tx.licenceFiling.findMany({ where: { organizationId: ctx.org.id }, select: { id: true, title: true, status: true, dueDate: true }, orderBy: { createdAt: "desc" } }));
  return <><div className="head"><div className="t"><h1>Licence changes</h1><p className="muted">Prepare a notice of change on the Commission&apos;s forms. You check, sign and submit it yourself.</p></div></div>
    <div className="banner info">Notice of change (Schedule III and offshore Form III) is available. Renewal, Schedule IV and surrender are still planned.</div>
    {can(ctx, "licensing", "write") && <div className="card"><h3>Start a notice of change</h3><ActionForm action={startChange} submit="Start" className="row"><input name="title" aria-label="Title" placeholder="Title (optional)" maxLength={200} /></ActionForm></div>}
    <div className="card qz-scroll"><table className="qz-table"><thead><tr><th>Filing</th><th>Status</th><th>Due</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td><Link href={`/changes/${r.id}`}>{r.title}</Link></td><td>{r.status}</td><td>{r.dueDate ?? "—"}</td></tr>)}</tbody></table>{!rows.length && <p>No filings yet.</p>}</div></>;
}
