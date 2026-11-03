import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmButton } from "@/components/admin-ui";
import { withTenant } from "@/lib/db";
import { ACCEPT, linkLabel, visibleWhere } from "@/lib/documents";
import { fmtDate, fmtDateTime, getForms } from "@/lib/forms";
import { can, requirePermission } from "@/lib/tenant";
import { archiveDocument, uploadVersion } from "../actions";

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
export default async function DocumentView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("documents");
  const forms = await getForms(ctx.org.id);
  const data = await withTenant(ctx.org.id, async (tx) => {
    const d = await tx.document.findFirst({ where: { ...visibleWhere(ctx), id }, include: { versions: { orderBy: { versionNo: "desc" } } } });
    if (!d) return null;
    return { d, link: await linkLabel(tx, ctx, forms, d.linkType, d.linkId), history: can(ctx, "audit") ? await tx.auditLog.findMany({ where: { organizationId: ctx.org.id, entityType: "documents", entityId: id }, orderBy: { createdAt: "desc" }, take: 30 }) : [] };
  });
  if (!data) notFound(); // the same for a restricted document, another organization's, or a wrong id
  const { d, link, history } = data, w = can(ctx, "documents", "write");
  return (
    <>
      <div className="head">
        <div className="t"><Link className="link" href="/documents">← Documents</Link><h1>{d.title}</h1><div className="row"><span className="badge">{d.category}</span>{d.access === "Restricted" && <span className="badge warn">Restricted</span>}</div></div>
        {w && <div className="acts"><Link className="btn" href={`/documents/${d.id}/edit`}>Edit details</Link><ConfirmButton action={archiveDocument.bind(null, d.id)} label="Archive" ask={`Archive "${d.title}"? It will be hidden, and its files and history are kept.`} /></div>}
      </div>
      <div className="card"><dl className="kv">
        <dt>Linked to</dt><dd>{link ? (link.href ? <Link href={link.href}>{link.label}</Link> : link.label) : "—"}</dd>
        <dt>Expiry</dt><dd>{fmtDate(d.expiryDate) || "—"}</dd>
        <dt>Notes</dt><dd style={{ whiteSpace: "pre-wrap" }}>{d.notes || "—"}</dd>
      </dl></div>
      <div className="card"><h3>Versions</h3>
        {d.versions.length ? d.versions.map((v) => (
          <div className="li" key={v.id}><b>v{v.versionNo}</b> <a href={`/documents/${d.id}/versions/${v.id}`}>{v.filename}</a> <span className="muted small">{kb(v.size)} · {fmtDateTime(v.createdAt)} · {v.uploadedByName ?? "System"}{v.note ? ` · ${v.note}` : ""}</span></div>
        )) : <p className="muted">No file uploaded yet.</p>}
        {w && <ActionForm action={uploadVersion.bind(null, d.id)} submit={`Upload ${d.versions.length ? "a new version" : "the file"}`} className="row">
          <input type="file" name="file" accept={ACCEPT} aria-label="File" />
          <input name="note" placeholder="What changed (optional)" aria-label="Note" />
          <span className="small muted">PDF, Word, Excel, image, CSV, text or JSON, up to 20 MB. Earlier versions are kept.</span>
        </ActionForm>}
      </div>
      {can(ctx, "audit") && <div className="card"><h3>History</h3>{history.length ? history.map((a) => <div className="small" key={a.id}>{fmtDateTime(a.createdAt)} · {a.actorEmail ?? "System"} · {a.summary}</div>) : <p className="muted">Nothing recorded yet.</p>}</div>}
    </>
  );
}
