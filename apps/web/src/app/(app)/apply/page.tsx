import Link from "next/link";
import { ActionForm } from "@/components/admin-ui";
import { withTenant } from "@/lib/db";
import { createLic } from "@/lib/lic/core";
import { loadLic, toEngineApp } from "@/lib/lic/store";
import { can, requirePermission } from "@/lib/tenant";
import { startApplication } from "./actions";

const L = createLic();
export default async function Applications() {
  const ctx = await requirePermission("licensing");
  const rows = await withTenant(ctx.org.id, async (tx) => {
    const lic = await loadLic(tx, ctx);
    return (await tx.application.findMany({ where: { organizationId: ctx.org.id }, orderBy: { createdAt: "desc" } })).map((a) => {
      const R = lic.appReadiness(toEngineApp(a));
      return { a, done: R.steps.filter((s: { missing: unknown[] }) => !s.missing.length).length, total: R.steps.length, docs: R.docs };
    });
  });
  return (
    <>
      <div className="head"><div className="t"><h1>Licence application</h1><p className="muted">Enter the details once. The system prepares the Commission&apos;s forms and tracks the supporting documents. You check, sign and submit them yourself.</p></div></div>
      {can(ctx, "licensing", "write") && <div className="card"><h3>Start an application</h3>
        <ActionForm action={startApplication} submit="Start" className="row">
          <select name="app_type" aria-label="Application type" defaultValue="">{[<option key="" value="">Application type</option>, ...(L.APP_TYPES as string[]).map((t) => <option key={t}>{t}</option>)]}</select>
          <input name="title" placeholder="Title (optional)" aria-label="Title" />
        </ActionForm></div>}
      <div className="card qz-scroll">{rows.length ? <table className="qz-table"><thead><tr><th>Application</th><th>Status</th><th>Steps complete</th><th>Documents ready</th></tr></thead>
        <tbody>{rows.map(({ a, done, total, docs }) => <tr key={a.id}><td><Link href={`/apply/${a.id}`}>{a.title}</Link></td><td><span className="badge info">{a.status}</span></td><td>{done} of {total}</td><td>{docs.ok} of {docs.total}</td></tr>)}</tbody></table> : <p className="muted">No application yet.</p>}</div>
    </>
  );
}
