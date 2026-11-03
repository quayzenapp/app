import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ImportForm } from "@/components/import-form";
import { importRecords } from "./import/actions";
import { withTenant } from "@/lib/db";
import { canSeeField, fmtDate, getForm, stripSensitive } from "@/lib/forms";
import { SECTIONS } from "@/lib/sections";
import { can, getTenantContext } from "@/lib/tenant";

const PAGE = 100;
export default async function RegisterList({ params, searchParams }: { params: Promise<{ form: string }>; searchParams: Promise<{ q?: string }> }) {
  const { form: key } = await params;
  const { q = "" } = await searchParams;
  const ctx = await getTenantContext();
  const form = await getForm(ctx.org.id, key);
  if (!form) notFound();
  if (!can(ctx, form.module)) redirect("/forbidden");
  const rows = await withTenant(ctx.org.id, (tx) => tx.record.findMany({ where: { organizationId: ctx.org.id, formKey: key, archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 2000 }));
  const visible = rows.map((r) => ({ ...r, d: stripSensitive(form, r.data as Record<string, unknown>, ctx.sensitive) }));
  const needle = q.trim().toLowerCase();
  const filtered = needle ? visible.filter((r) => Object.values(r.d).some((v) => String(v ?? "").toLowerCase().includes(needle))) : visible;
  const cols = form.listFields.map((n) => form.fields.find((f) => f.name === n)!).filter((f) => f && canSeeField(f, ctx.sensitive));
  const section = SECTIONS.find((s) => s.forms?.includes(key));
  const siblings = section?.forms?.length && (section.forms.length > 1 || section.href) ? section.forms : [];
  const labels = siblings.length ? await Promise.all(siblings.map(async (k) => [k, (await getForm(ctx.org.id, k))?.plural ?? k] as const)) : [];
  const cell = (type: string, v: unknown) => (v == null ? "" : type === "date" ? fmtDate(v) : typeof v === "number" ? v.toLocaleString("en-US") : String(v));
  return (
    <>
      {labels.length > 0 && <div className="tabs" role="tablist">{section?.href && <Link role="tab" className="tab" href={section.href}>{section.label}</Link>}{labels.map(([k, l]) => <Link key={k} role="tab" href={`/r/${k}`} className={`tab${k === key ? " on" : ""}`} aria-selected={k === key}>{l}</Link>)}</div>}
      <div className="head">
        <div className="t"><h1>{form.plural}</h1>{form.intro && <p className="muted">{form.intro}</p>}</div>
        <div className="acts"><a className="btn" href={`/r/${key}/export`}>Export to Excel</a>{can(ctx, form.module, "write") && <Link className="btn p" href={`/r/${key}/new`}>Add {form.label.toLowerCase()}</Link>}</div>
      </div>
      {form.importable && can(ctx, form.module, "write") && <ImportForm action={importRecords.bind(null, key)} templateHref={`/r/${key}/export?template=1`} />}
      <form className="row" style={{ marginBottom: 12 }}><input name="q" defaultValue={q} placeholder="Search" aria-label="Search" /><button className="btn sm">Search</button></form>
      <div className="card qz-scroll">
        {filtered.length ? (
          <table className="qz-table">
            <thead><tr>{cols.map((c) => <th key={c.name}>{c.label}</th>)}{form.reviewable && <th>Review</th>}</tr></thead>
            <tbody>{filtered.slice(0, PAGE).map((r) => (
              <tr key={r.id}>
                {cols.map((c, i) => <td key={c.name}>{i === 0 ? <Link href={`/r/${key}/${r.id}`}>{cell(c.type, r.d[c.name]) || "Open"}</Link> : cell(c.type, r.d[c.name])}</td>)}
                {form.reviewable && <td><span className={`badge ${r.reviewStatus === "Confirmed" ? "ok" : "warn"}`}>{r.reviewStatus ?? "Pending"}</span></td>}
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="muted">{needle ? "Nothing matches your search." : "No records yet."}</p>}
        {filtered.length > PAGE && <p className="small muted">Showing the {PAGE} most recently changed of {filtered.length}. Search to narrow the list.</p>}
      </div>
    </>
  );
}
