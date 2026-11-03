import { ActionForm } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { createOrganization, setOrganizationStatus } from "../actions";

export default async function Organizations() {
  await requirePlatformAdmin();
  const orgs = await db.organization.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { memberships: true } } } });
  return (
    <>
      <div className="head"><div className="t"><h1>Organizations</h1><p className="muted">Each organization is a separate tenant. Its data is isolated by the database.</p></div></div>
      <div className="card"><h3>Add an organization</h3>
        <ActionForm action={createOrganization} submit="Create organization" className="row">
          <input name="name" placeholder="Organization name" aria-label="Organization name" required />
          <select name="stage" aria-label="Stage"><option value="licensed">Holds a licence</option><option value="applicant">Applying for a licence</option></select>
          <label className="small"><input type="checkbox" name="isDemo" /> Demo organization</label>
        </ActionForm>
      </div>
      <div className="card qz-scroll"><table className="qz-table">
        <thead><tr><th>Name</th><th>Members</th><th>Stage</th><th>Status</th><th /></tr></thead>
        <tbody>{orgs.map((o) => (
          <tr key={o.id}>
            <td>{o.name} {o.isDemo && <span className="badge warn">DEMO</span>}</td><td>{o._count.memberships}</td><td>{o.stage}</td>
            <td><span className={`badge ${o.status === "ACTIVE" ? "ok" : "bad"}`}>{o.status === "ACTIVE" ? "Active" : "Suspended"}</span></td>
            <td><form action={setOrganizationStatus.bind(null, o.id, o.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}><button className="btn sm">{o.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button></form></td>
          </tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
