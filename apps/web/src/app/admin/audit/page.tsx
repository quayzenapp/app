import { withTenant } from "@/lib/db";
import { requireAdmin } from "@/lib/tenant";

export default async function Audit() {
  const ctx = await requireAdmin();
  const rows = await withTenant(ctx.org.id, (tx) => tx.auditLog.findMany({ where: { organizationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 200 }));
  return (
    <>
      <div className="head"><div className="t"><h1>Audit log</h1><p className="muted">The latest 200 changes in {ctx.org.name}. Entries can't be changed or deleted.</p></div></div>
      <div className="card qz-scroll"><table className="qz-table">
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Type</th><th>Summary</th></tr></thead>
        <tbody>{rows.map((a) => <tr key={a.id}><td>{a.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td>{a.actorEmail ?? "System"}</td><td>{a.action}</td><td>{a.entityType}</td><td>{a.summary}</td></tr>)}</tbody>
      </table>{!rows.length && <p className="muted">Nothing recorded yet.</p>}</div>
    </>
  );
}
