import Link from "next/link";
import { ActionForm } from "@/components/admin-ui";
import { getForms } from "@/lib/forms";
import { MODULES, MODULE_LABELS } from "@/lib/rbac";
import { requireAdmin } from "@/lib/tenant";
import { createForm } from "../actions";

export default async function Forms() {
  const ctx = await requireAdmin();
  const forms = await getForms(ctx.org.id, { includeDrafts: true });
  return (
    <>
      <div className="head"><div className="t"><h1>Forms</h1><p className="muted">Forms drive the record screens, validation and restricted-field handling.{ctx.user.isPlatformAdmin ? " Editing a standard form changes it for every organization that hasn't customised it." : " Editing a standard form saves your organization's own version."}</p></div></div>
      <div className="card"><h3>Add a form</h3>
        <ActionForm action={createForm} submit="Create draft" className="row">
          <input name="label" placeholder="Form name (singular)" aria-label="Form name" required />
          <select name="module" aria-label="Section">{MODULES.map((m) => <option key={m} value={m}>{MODULE_LABELS[m]}</option>)}</select>
          {ctx.user.isPlatformAdmin && <select name="scope" aria-label="Available to"><option value="org">This organization</option><option value="global">All organizations</option></select>}
        </ActionForm>
      </div>
      <div className="card qz-scroll"><table className="qz-table">
        <thead><tr><th>Form</th><th>Section</th><th>Fields</th><th>Applies to</th><th>Version</th><th>Status</th></tr></thead>
        <tbody>{forms.map((f) => <tr key={f.id}><td><Link href={`/admin/forms/${f.id}`}>{f.plural}</Link></td><td>{MODULE_LABELS[f.module] ?? f.module}</td><td>{f.fields.length}</td><td>{f.organizationId ? "This organization" : "All organizations"}</td><td>v{f.version}</td><td><span className={`badge ${f.status === "PUBLISHED" ? "ok" : "warn"}`}>{f.status.toLowerCase()}</span></td></tr>)}</tbody>
      </table></div>
    </>
  );
}
