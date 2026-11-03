import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormBuilder } from "@/components/form-builder";
import { db } from "@/lib/db";
import { getLookups, type Field } from "@/lib/forms";
import { MODULES, MODULE_LABELS, SENSITIVE_LABELS } from "@/lib/rbac";
import { requireAdmin } from "@/lib/tenant";
import { saveForm } from "../../actions";

export default async function FormEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  const f = await db.formDefinition.findUnique({ where: { id } });
  if (!f) notFound();
  if (f.organizationId && f.organizationId !== ctx.org.id && !ctx.user.isPlatformAdmin) redirect("/forbidden");
  const lookups = Object.keys(await getLookups(ctx.org.id));
  const modules = MODULES.map((m) => ({ value: m, label: MODULE_LABELS[m] }));
  return (
    <>
      <div className="head"><div className="t"><Link className="link" href="/admin/forms">← Forms</Link><h1>{f.plural}</h1><p className="muted">Version {f.version}. Removing a field hides it but keeps existing data.</p></div></div>
      <FormBuilder save={saveForm.bind(null, f.id)} modules={modules} lookups={lookups} sensitive={SENSITIVE_LABELS}
        initial={{ label: f.label, plural: f.plural, module: f.module, intro: f.intro ?? "", titleField: f.titleField, listFields: f.listFields, status: f.status, fields: f.fields as Field[] }} />
    </>
  );
}
