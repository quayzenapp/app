import { ActionForm } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/forms";
import { requireAdmin } from "@/lib/tenant";
import { changeMemberRole, inviteUser, removeMember, resetUserPassword, setUserStatus } from "../actions";

export default async function Users() {
  const ctx = await requireAdmin();
  const organizationId = ctx.org.id, platform = ctx.user.isPlatformAdmin;
  const [members, roles] = await Promise.all([
    db.membership.findMany({ where: { organizationId }, include: { user: true, role: true }, orderBy: { user: { name: "asc" } } }),
    db.role.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
  ]);
  const roleOptions = roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>);
  return (
    <>
      <div className="head"><div className="t"><h1>Users in {ctx.org.name}</h1><p className="muted">People sign in with their email and password, then see only the organizations they belong to.</p></div></div>
      <div className="card"><h3>Add a user</h3>
        <ActionForm action={inviteUser} submit="Add user" className="row">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input name="name" placeholder="Full name" aria-label="Full name" required />
          <input name="email" type="email" placeholder="Email" aria-label="Email" required />
          <select name="roleId" aria-label="Role" required>{roleOptions}</select>
        </ActionForm>
      </div>
      <div className="card qz-scroll"><table className="qz-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
        <tbody>{members.map((m) => (
          <tr key={m.id}>
            <td>{m.user.name}</td><td>{m.user.email}</td>
            <td><ActionForm action={changeMemberRole} submit="Change" className="row">
              <input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="membershipId" value={m.id} />
              <select name="roleId" defaultValue={m.roleId} aria-label={`Role for ${m.user.name}`}>{roleOptions}</select>
            </ActionForm></td>
            <td>{m.user.lastLoginAt ? fmtDate(m.user.lastLoginAt.toISOString()) : "Never"}</td>
            <td><span className={`badge ${m.user.status === "ACTIVE" ? "ok" : "bad"}`}>{m.user.status === "ACTIVE" ? "Active" : "Disabled"}</span></td>
            <td className="row">
              <ActionForm action={removeMember} submit="Remove" confirm={`Remove ${m.user.email} from this organization?`}><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="membershipId" value={m.id} /></ActionForm>
              {platform && <ActionForm action={resetUserPassword} submit="Reset password" confirm={`Reset the password for ${m.user.email}?`}><input type="hidden" name="userId" value={m.userId} /></ActionForm>}
              {platform && m.userId !== ctx.user.id && <form action={setUserStatus.bind(null, m.userId, m.user.status === "ACTIVE" ? "DISABLED" : "ACTIVE")}><button className="btn sm">{m.user.status === "ACTIVE" ? "Disable" : "Enable"}</button></form>}
            </td>
          </tr>
        ))}</tbody>
      </table>{!members.length && <p className="muted">No members yet.</p>}</div>
    </>
  );
}
