import Link from "next/link";
import { RecordForm } from "@/components/record-form";
import { saveCompanyProfile } from "./actions";
import { getCompanyFormProps } from "./load";

export default async function Company() {
  const p = await getCompanyFormProps();
  return (
    <>
      <div className="tabs" role="tablist"><Link href="/company" className="tab on" role="tab" aria-selected>Company profile</Link><Link href="/r/people" className="tab" role="tab">Directors and shareholders</Link><Link href="/r/ubo" className="tab" role="tab">Beneficial owners (UBO)</Link></div>
      <div className="head"><div className="t"><h1>Company profile</h1><p className="muted">The annual return reads these details, so keep them matching your licence.</p></div></div>
      <RecordForm action={saveCompanyProfile} {...p} />
    </>
  );
}
