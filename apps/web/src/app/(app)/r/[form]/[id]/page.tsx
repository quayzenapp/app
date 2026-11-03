import Link from "next/link";
import { RecordForm } from "@/components/record-form";
import { archiveRecordAction, reviewRecordAction, saveRecordAction } from "@/app/(app)/actions";
import { withTenant } from "@/lib/db";
import { visibleWhere } from "@/lib/documents";
import { can } from "@/lib/tenant";
import { loadFormPage } from "../load";

export default async function EditRecord({ params, searchParams }: { params: Promise<{ form: string; id: string }>; searchParams: Promise<{ note?: string }> }) {
  const { form: key, id } = await params;
  const { note } = await searchParams;
  const p = await loadFormPage(key, id);
  const docs = can(p.ctx, "documents") ? await withTenant(p.ctx.org.id, (tx) => tx.document.findMany({ where: { ...visibleWhere(p.ctx), linkType: key, linkId: id }, orderBy: { title: "asc" } })) : null;
  const canApprove = p.form.reviewable && can(p.ctx, p.form.module, "approve");
  return (
    <>
      <div className="head">
        <div className="t"><Link className="link" href={`/r/${key}`}>← Back</Link><h1>{p.writable ? "Edit" : "View"} {p.form.label.toLowerCase()}</h1>{p.form.intro && <p className="muted">{p.form.intro}</p>}</div>
        <div className="acts">
          {p.form.reviewable && <span className={`badge ${p.record?.reviewStatus === "Confirmed" ? "ok" : "warn"}`}>{p.record?.reviewStatus ?? "Pending"}</span>}
          {canApprove && p.record?.reviewStatus !== "Confirmed" && <form action={reviewRecordAction.bind(null, key, id, "Confirmed")}><button className="btn sm p">Confirm review</button></form>}
          {p.writable && <form action={archiveRecordAction.bind(null, key, id)}><button className="btn sm">Archive</button></form>}
        </div>
      </div>
      {note && <div className="banner info" role="status">Saved. {note}</div>}
      <RecordForm action={saveRecordAction.bind(null, key, id)} fields={p.fields} values={p.values} choices={p.choices} refs={p.refs} users={p.users} readOnly={!p.writable} />
      {docs && <div className="card"><h3>Documents</h3>{docs.length ? docs.map((d) => <div className="li" key={d.id}><Link href={`/documents/${d.id}`}>{d.title}</Link> <span className="muted small">{d.category}</span></div>) : <p className="muted">No documents linked yet.</p>}{can(p.ctx, "documents", "write") && <div className="row"><Link className="btn sm" href={`/documents/new?type=${key}&id=${id}`}>Add a document</Link></div>}</div>}
    </>
  );
}
