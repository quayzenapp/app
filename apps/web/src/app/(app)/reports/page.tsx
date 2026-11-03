import Link from "next/link";
import { REPORT_DESC } from "@/lib/reports/descriptions";
import { REPORT_LIST } from "@/lib/reports/store";
import { can, requirePermission } from "@/lib/tenant";

export default async function Reports() {
  const ctx = await requirePermission("reports");
  const list = REPORT_LIST.filter((r) => can(ctx, r[2]));
  return (
    <>
      <div className="head"><div className="t"><h1>Reports</h1><p className="muted">Each report says the date or period it covers and where its figures come from. Download as Excel, PDF or Word. Reports from demo data are marked DEMO.</p></div></div>
      <div className="grid3">{list.map(([code, title]) => <Link key={code} href={`/reports/${code}`} className="card tile"><b>{title}</b><span className="small muted">{REPORT_DESC[code] ?? ""}</span><span className="small tilefmt">Excel · PDF · Word</span></Link>)}</div>
      {!list.length && <p className="muted">Your role doesn&apos;t include any reports.</p>}
    </>
  );
}
