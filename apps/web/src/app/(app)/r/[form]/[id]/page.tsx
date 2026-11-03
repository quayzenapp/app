import Link from "next/link";
import { RecordForm } from "@/components/record-form";
import { archiveRecordAction, reviewRecordAction, saveRecordAction } from "@/app/(app)/actions";
import { can } from "@/lib/tenant";
import { loadFormPage } from "../load";

export default async function EditRecord({ params, searchParams }: { params: Promise<{ form: string; id: string }>; searchParams: Promise<{ note?: string }> }) {
  const { form: key, id } = await params;
  const { note } = await searchParams;
  const p = await loadFormPage(key, id);
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
    </>
  );
}
