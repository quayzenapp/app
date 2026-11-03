import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin-ui";
import { db } from "@/lib/db";
import { LEVELS, MODULES, MODULE_LABELS, SENSITIVE_LABELS } from "@/lib/rbac";
import { requireAdmin } from "@/lib/tenant";
import { deleteRole, saveRole } from "../../actions";

export default async function RoleEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  const role = await db.role.findFirst({ where: { id, organizationId: ctx.org.id }, include: { _count: { select: { memberships: true } } } });
  if (!role) notFound();
  const perms = role.permissions as Record<string, string>;
  return (
    <>
      <div className="head"><div className="t"><Link className="link" href="/admin/roles">← Roles</Link><h1>{role.name}</h1></div>
        <div className="acts">{!role.isSystem && role._count.memberships === 0 && <form action={deleteRole.bind(null, role.id)}><button className="btn sm bad">Delete role</button></form>}</div>
      </div>
      <div className="card qz-scroll">
        <ActionForm action={saveRole.bind(null, role.id)} submit="Save permissions">
          <div className="fld"><label htmlFor="rname">Role name</label><input id="rname" name="name" defaultValue={role.name} /></div>
          <table className="qz-table">
            <thead><tr><th>Section</th>{LEVELS.map((l) => <th key={l}>{l[0].toUpperCase() + l.slice(1)}</th>)}</tr></thead>
            <tbody>{MODULES.map((m) => (
              <tr key={m}><td>{MODULE_LABELS[m]}</td>{LEVELS.map((l) => <td key={l}><input type="radio" name={`perm_${m}`} value={l} defaultChecked={(perms[m] ?? "none") === l} aria-label={`${MODULE_LABELS[m]}: ${l}`} /></td>)}</tr>
            ))}</tbody>
          </table>
          <h3>Restricted information this role can see</h3>
          {Object.entries(SENSITIVE_LABELS).map(([k, label]) => <p key={k}><label><input type="checkbox" name={`sens_${k}`} defaultChecked={role.sensitive.includes(k)} /> {label}</label></p>)}
        </ActionForm>
      </div>
    </>
  );
}
