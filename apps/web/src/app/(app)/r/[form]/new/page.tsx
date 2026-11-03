import Link from "next/link";
import { RecordForm } from "@/components/record-form";
import { saveRecordAction } from "@/app/(app)/actions";
import { loadFormPage } from "../load";

export default async function NewRecord({ params }: { params: Promise<{ form: string }> }) {
  const { form: key } = await params;
  const p = await loadFormPage(key, null);
  return (
    <>
      <div className="head"><div className="t"><Link className="link" href={`/r/${key}`}>← Back</Link><h1>Add {p.form.label.toLowerCase()}</h1>{p.form.intro && <p className="muted">{p.form.intro}</p>}</div></div>
      <RecordForm action={saveRecordAction.bind(null, key, null)} fields={p.fields} values={p.values} choices={p.choices} refs={p.refs} users={p.users} readOnly={false} />
    </>
  );
}
