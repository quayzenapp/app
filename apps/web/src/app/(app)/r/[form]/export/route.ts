import { NextResponse } from "next/server";
import { withTenant } from "@/lib/db";
import { canSeeField, getForm, stripSensitive } from "@/lib/forms";
import { MIME, download, fileSafe, toXlsx } from "@/lib/report-export";
import { can, getTenantContext } from "@/lib/tenant";

/** Excel export of a register. ?template=1 gives the empty sheet used for import. Restricted fields are left out by role. */
export async function GET(req: Request, { params }: { params: Promise<{ form: string }> }) {
  const { form: key } = await params;
  const ctx = await getTenantContext();
  const form = await getForm(ctx.org.id, key);
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(ctx, form.module)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const template = new URL(req.url).searchParams.get("template") === "1";
  const cols = form.fields.filter((f) => canSeeField(f, ctx.sensitive) && (!template || !f.readonly));
  const rows = template ? [] : await withTenant(ctx.org.id, (tx) => tx.record.findMany({ where: { organizationId: ctx.org.id, formKey: key, archivedAt: null }, orderBy: { updatedAt: "desc" } }));
  const body = await toXlsx({ title: form.plural, demo: ctx.org.isDemo && !template, subtitle: ctx.org.name, sections: [{ heading: form.plural, columns: cols.map((c) => c.label), rows: rows.map((r) => { const d = stripSensitive(form, r.data as Record<string, unknown>, ctx.sensitive); return cols.map((c) => (d[c.name] as string | number | null) ?? null); }) }] });
  return download(body, `${ctx.org.isDemo && !template ? "DEMO_" : ""}${fileSafe(form.plural)}${template ? "_import_template" : ""}.xlsx`, MIME.xlsx);
}
