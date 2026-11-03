import { redirect } from "next/navigation";
import { db, withTenant } from "@/lib/db";
import { canSeeField, choicesFor, getForm, getForms, getLookups, loadRefOptions } from "@/lib/forms";
import { can, getTenantContext } from "@/lib/tenant";

export async function getCompanyFormProps() {
  const ctx = await getTenantContext();
  if (!can(ctx, "company")) redirect("/forbidden");
  const [form, forms, lookups, org] = await Promise.all([getForm(ctx.org.id, "company_profile"), getForms(ctx.org.id), getLookups(ctx.org.id), db.organization.findUniqueOrThrow({ where: { id: ctx.org.id } })]);
  if (!form) throw new Error("The company profile form is missing. Run the seed.");
  const refs = await withTenant(ctx.org.id, (tx) => loadRefOptions(tx, ctx.org.id, forms, form, ctx.sensitive));
  const fields = form.fields.filter((f) => canSeeField(f, ctx.sensitive));
  return { fields, refs, users: [], values: { ...(org.profile as object), name: org.name } as Record<string, unknown>, choices: Object.fromEntries(fields.filter((f) => f.type === "choice").map((f) => [f.name, choicesFor(f, lookups)])), readOnly: !can(ctx, "company", "write") };
}
