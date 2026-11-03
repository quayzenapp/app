import Link from "next/link";
import { ActionForm } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/tenant";
import { createRole } from "../actions";

export default async function Roles() {
  const ctx = await requireAdmin();
  const roles = await db.role.findMany({ where: { organizationId: ctx.org.id }, orderBy: { name: "asc" }, include: { _count: { select: { memberships: true } } } });
  return (
    <>
      <div className="head"><div className="t"><h1>Roles and permissions</h1><p className="muted">Permissions are enforced by the application on the server, for {ctx.org.name} only.</p></div></div>
      <div className="card"><h3>Add a role</h3><ActionForm action={createRole} submit="Create role" className="row"><input name="name" placeholder="Role name" aria-label="Role name" required /></ActionForm></div>
      <div className="card qz-scroll"><table className="qz-table">
        <thead><tr><th>Role</th><th>Members</th><th>Type</th></tr></thead>
        <tbody>{roles.map((r) => <tr key={r.id}><td><Link href={`/admin/roles/${r.id}`}>{r.name}</Link></td><td>{r._count.memberships}</td><td>{r.isSystem ? "Standard" : "Custom"}</td></tr>)}</tbody>
      </table></div>
    </>
  );
}
