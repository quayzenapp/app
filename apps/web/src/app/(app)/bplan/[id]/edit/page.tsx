import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/admin-ui";
import { BP_COMMISSION, BP_SECTIONS, BP_YEARS, BP_YEAR_FIELDS, FUNDING_SOURCES } from "@/lib/bplan";
import { withTenant } from "@/lib/db";
import { can, requirePermission } from "@/lib/tenant";
import { importFigures, savePlan } from "../../actions";

type Year = Record<string, string | number | null>;
export default async function PlanEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("bplan");
  if (!can(ctx, "bplan", "write")) redirect("/forbidden");
  const v = await withTenant(ctx.org.id, (tx) => tx.businessPlan.findFirst({ where: { id, organizationId: ctx.org.id } }));
  if (!v) notFound();
  if (v.status !== "Draft") redirect(`/bplan/${id}`);
  const saved = v.years as Year[], years = Array.from({ length: BP_YEARS }, (_, i) => saved[i] ?? {});
  const ms = v.milestones as { milestone: string; target_date?: string | null }[], sections = v.sections as Record<string, string>;
  const pick = (name: string, opts: string[], val: unknown, label: string) => <select name={name} defaultValue={String(val ?? "")} aria-label={label}><option value="">—</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>;
  return (
    <>
      <div className="head"><div className="t"><Link className="link" href={`/bplan/${id}`}>← Back</Link><h1>Record business plan v{v.versionNo}</h1><p className="muted">Copy the figures from the plan as submitted. Leave a box blank if the plan does not give that figure.</p></div></div>
      <details className="card"><summary>Import the figures from Excel</summary><p className="small muted">Download the template, copy the figures into it, and upload it. This replaces the year-by-year figures below.</p>
        <ActionForm action={importFigures.bind(null, id)} submit="Import figures" className="row"><input type="file" name="file" accept=".xlsx" aria-label="Excel template" /><a className="btn sm" href="/bplan/template">Download the template</a></ActionForm>
      </details>
      <div className="card f"><ActionForm action={savePlan.bind(null, id)} submit="Save draft">
        <fieldset><legend>About this version</legend><div className="grid2">
          <div className="fld"><label htmlFor="p_t">Title</label><input id="p_t" name="title" defaultValue={v.title} /></div>
          <div className="fld"><label htmlFor="p_s">What this version is</label><select id="p_s" name="commission_status" defaultValue={v.commissionStatus ?? ""}>{BP_COMMISSION.map((o) => <option key={o}>{o}</option>)}</select></div>
          <div className="fld"><label htmlFor="p_d">Date given to the Commission</label><input id="p_d" type="date" name="commission_date" defaultValue={v.commissionDate ?? ""} /></div>
          <div className="fld"><label htmlFor="p_r">Reference (letter, email or application number)</label><input id="p_r" name="commission_ref" defaultValue={v.commissionRef ?? ""} /></div>
          <div className="fld"><label htmlFor="p_y">Year 1 starts on</label><input id="p_y" type="date" name="year1_start" defaultValue={v.year1Start ?? ""} /><span className="help">Used to line up plan years with actual records. Usually the start of operations or the licence date.</span></div>
          <div className="fld wide"><label htmlFor="p_c">What changed from the previous version (for revised plans)</label><textarea id="p_c" name="change_summary" rows={2} defaultValue={v.changeSummary ?? ""} /></div>
        </div></fieldset>
        <fieldset><legend>Year-by-year projections</legend><div className="qz-scroll"><table className="qz-table"><thead><tr><th>Item</th>{years.map((_, i) => <th key={i}>Year {i + 1}</th>)}</tr></thead>
          <tbody>{BP_YEAR_FIELDS.map(([k, l, t]) => <tr key={k}><td style={{ minWidth: 220 }}>{l}</td>{years.map((y, i) => { const name = `y${i}_${k}`, label = `${l} year ${i + 1}`; return <td key={i} style={{ minWidth: 110 }}>{t === "choice" ? pick(name, FUNDING_SOURCES, y[k], label) : t === "yn" ? pick(name, ["Yes", "No"], y[k], label) : t === "text" ? <textarea name={name} rows={2} defaultValue={String(y[k] ?? "")} aria-label={label} /> : <input name={name} inputMode="decimal" defaultValue={String(y[k] ?? "")} aria-label={label} />}</td>; })}</tr>)}</tbody></table></div></fieldset>
        <fieldset><legend>Milestones</legend><div className="fld wide"><label htmlFor="p_m">One per line: milestone ; target date (YYYY-MM-DD)</label><textarea id="p_m" name="milestones" rows={5} defaultValue={ms.map((m) => `${m.milestone} ; ${m.target_date ?? ""}`).join("\n")} /></div></fieldset>
        <fieldset><legend>Key points from the plan (optional)</legend><p className="help">Short notes that help explain the figures later. Attach the full plan document from the plan page.</p>{BP_SECTIONS.map(([k, l]) => <div className="fld wide" key={k}><label htmlFor={`s_${k}`}>{l}</label><textarea id={`s_${k}`} name={`s_${k}`} rows={2} defaultValue={sections[k] ?? ""} /></div>)}</fieldset>
      </ActionForm></div>
    </>
  );
}
