import { db, withTenant } from "@/lib/db";
import { fmtDate } from "@/lib/forms";
import { requireAdmin } from "@/lib/tenant";

export default async function AdminHome() {
  const ctx = await requireAdmin();
  const platform = ctx.user.isPlatformAdmin;
  const [orgs, users, members, roles, forms, recent] = await Promise.all([
    db.organization.count(), db.user.count(), db.membership.count({ where: { organizationId: ctx.org.id } }),
    db.role.count({ where: { organizationId: ctx.org.id } }), db.formDefinition.count({ where: { OR: [{ organizationId: null }, { organizationId: ctx.org.id }] } }),
    withTenant(ctx.org.id, (tx) => tx.auditLog.findMany({ where: { organizationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 8 })),
  ]);
  const stat = (v: number, l: string) => <div className="stat" key={l}><b>{v}</b><span>{l}</span></div>;
  return (
    <>
      <div className="head"><div className="t"><h1>Administration</h1><p className="muted">{platform ? "Platform view. Member, role and audit figures are for the organization selected above." : `Managing ${ctx.org.name}.`}</p></div></div>
      <div className="stats">{platform && [stat(orgs, "Organizations"), stat(users, "Users on the platform")]}{stat(members, "Members here")}{stat(roles, "Roles here")}{stat(forms, "Forms available")}</div>
      <div className="card"><h3>Recent activity</h3>
        {recent.length ? <ul className="rem">{recent.map((a) => <li key={a.id}><div><b>{a.summary ?? a.action}</b><div className="muted small">{a.actorEmail ?? "System"} · {fmtDate(a.createdAt.toISOString())}</div></div></li>)}</ul> : <p className="muted">Nothing recorded yet.</p>}
      </div>
    </>
  );
}
