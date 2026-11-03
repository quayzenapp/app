import { notFound, redirect } from "next/navigation";
import { db, withTenant } from "@/lib/db";
import { canSeeField, choicesFor, getForm, getForms, getLookups, loadRefOptions, stripSensitive } from "@/lib/forms";
import { can, getTenantContext } from "@/lib/tenant";

/** Everything a form page needs, already filtered by role. Never sends hidden field definitions or values. */
export async function loadFormPage(key: string, id: string | null) {
  const ctx = await getTenantContext();
  const orgId = ctx.org.id;
  const form = await getForm(orgId, key);
  if (!form) notFound();
  if (!can(ctx, form.module)) redirect("/forbidden");
  const writable = can(ctx, form.module, "write");
  if (!id && !writable) redirect("/forbidden");
  const [forms, lookups, members] = await Promise.all([getForms(orgId), getLookups(orgId), db.membership.findMany({ where: { organizationId: orgId }, include: { user: true } })]);
  const { record, refs } = await withTenant(orgId, async (tx) => ({
    record: id ? await tx.record.findFirst({ where: { id, organizationId: orgId, formKey: key, archivedAt: null } }) : null,
    refs: await loadRefOptions(tx, orgId, forms, form, ctx.sensitive),
  }));
  if (id && !record) notFound();
  const fields = form.fields.filter((f) => canSeeField(f, ctx.sensitive));
  const defaults = Object.fromEntries(form.fields.filter((f) => f.dflt !== undefined).map((f) => [f.name, f.dflt]));
  const values = record ? stripSensitive(form, record.data as Record<string, unknown>, ctx.sensitive) : defaults;
  const choices = Object.fromEntries(fields.filter((f) => f.type === "choice").map((f) => [f.name, choicesFor(f, lookups)]));
  const users = members.map((m) => ({ value: m.user.name, label: m.user.name }));
  return { ctx, form, fields, values, choices, refs, users, writable, record };
}
