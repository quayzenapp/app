import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin-ui";
import { SpecFields } from "@/components/lic-fields";
import { withTenant } from "@/lib/db";
import { can, requirePermission } from "@/lib/tenant";
import { O3_SPEC, S3_CAP, type OffshoreSpec } from "@/lib/lic/change-spec";
import { stripChange, fullDetails, locked, CHANGE_NEXT, L, o3Sensitivity, type Rec, type ChangeItem } from "@/lib/lic/changes";
import { hiddenPersonKeys } from "@/lib/lic/store";
import { saveChange, saveFilingPerson, filingStatus } from "../actions";
export default async function Change({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ person?: string }> }) {
  const ctx = await requirePermission("licensing"), { id } = await params, { person } = await searchParams;
  const row = await withTenant(ctx.org.id, (tx) => tx.licenceFiling.findFirst({ where: { id, organizationId: ctx.org.id } }));
  if (!row) notFound();
  const d = stripChange(row.data as Rec, ctx.sensitive), items = (d.items ?? []) as ChangeItem[], people = d.people as Rec[];
  const edit = can(ctx, "licensing", "write") && !locked(row.status), full = fullDetails(ctx.sensitive);
  if (person) {
    const p = person === "new" ? {} : people.find((x) => x.id === person); if (!p) notFound();
    return <><div className="head"><h1>Profile for a new member</h1><Link className="btn" href={`/changes/${id}`}>Back to notice</Link></div><p>Schedule I Parts III, IV and V, as applicable. Check which parts this person needs.</p><SpecFields rowFields kind="person" specKeys="" initial={{ ...p, __app: { legal: "" } }} hidden={hiddenPersonKeys(ctx.sensitive)} disabled={!edit} action={saveFilingPerson.bind(null, id, person === "new" ? null : person)} submit="Save person" /></>;
  }
  const fieldBody = <>
    <div className="grid2">{[["name", "Name of Authorised Person"], ["licence_no", "Licence number"]].map(([k, label]) => <label className="fld" key={k}>{label}<input name={k} defaultValue={d[k] ?? ""} disabled={!edit} /></label>)}</div>
    <h3>Changes to notify</h3><p>Schedule III, items A–K: the notice must reach the Commission within 30 days of the change, with evidence of the change.</p><p className="help">Attach the evidence when you submit the notice. Quayzen prepares files and records what you did.</p>
    {row.dueDate && <p>Notice due by <b>{row.dueDate}</b>, based on the earliest change.</p>}
    {full ? <><div className="qz-scroll"><table className="qz-table"><thead><tr><th>Item</th><th>Former details</th><th>New details</th><th>Date of change</th><th>Reason</th>{edit && <th>Remove</th>}</tr></thead><tbody>{items.map((it, i) => <tr key={`${i}-${it.code}`}><td>{it.code}. {L.S3_ITEMS.find((x: string[]) => x[0] === it.code)?.[1]}</td>{["former", "new", "date", "reason"].map((k) => <td key={k}>{k === "date" ? <input type="date" name={`i.${i}.${k}`} aria-label={`Change ${i + 1} date`} defaultValue={it.date ?? ""} disabled={!edit} /> : <textarea rows={3} name={`i.${i}.${k}`} aria-label={`Change ${i + 1} ${k}`} defaultValue={it[k as keyof ChangeItem] ?? ""} disabled={!edit} />}</td>)}{edit && <td><input type="checkbox" name={`remove:${i}`} value="1" aria-label={`Remove change ${i + 1}`} /></td>}</tr>)}</tbody></table></div>
      {edit && <label className="fld">Add a change<select name="newcode" defaultValue=""><option value="">Choose item…</option>{L.S3_ITEMS.map(([k, label]: string[]) => <option key={k} value={k} disabled={items.filter((i) => i.code === k).length >= S3_CAP(k)}>{k}. {label}</option>)}</select><span className="help">Save to add the row. The number of rows follows the official form.</span></label>}
      <label className="fld">Full name of director or authorised signatory<input name="signer" defaultValue={d.signer ?? ""} disabled={!edit} /></label>
      <label className="radio"><input type="checkbox" name="offshore" value="1" defaultChecked={!!d.offshore} disabled={!edit} /> Also prepare offshore Form III</label></> : <div className="banner warn">The change rows require personal and identity access. Values hidden by your role are kept when you save.</div>}
    <details open={!!d.offshore}><summary>Offshore Form III particulars</summary><p>Offshore companies notify changes to the Form I particulars on Form III (regulation 6(1)), in addition to Schedule III. Complete the sections that apply.</p><div>{Array.from(new Set(O3_SPEC.map((s) => s[4]?.sec))).map((section) => <fieldset key={section}><legend>{section}</legend><div className="grid2">{O3_SPEC.filter(([k, , , , op]: OffshoreSpec) => op?.sec === section && (!o3Sensitivity(k) || ctx.sensitive.includes(o3Sensitivity(k)!))).map(([k, label, type, , op]) => <label className={`fld${type === "area" ? " wide" : ""}`} key={k}>{label}{type === "area" ? <textarea name={`o3.${k}`} rows={3} defaultValue={L.getPath(d.o3, k) ?? ""} disabled={!edit} /> : type === "check" ? <input type="checkbox" name={`o3.${k}`} value="1" defaultChecked={!!L.getPath(d.o3, k)} disabled={!edit} /> : <input type={type === "date" ? "date" : "text"} name={`o3.${k}`} defaultValue={L.getPath(d.o3, k) ?? ""} disabled={!edit} />}{op?.help && <span className="help">{op.help}</span>}</label>)}</div></fieldset>)}</div></details>
  </>;
  return <><div className="head"><div className="t"><h1>{row.title}</h1><span className="badge info">{row.status}</span></div><Link href="/changes" className="btn">All filings</Link></div>
    <div className="banner info">Quayzen does not make declarations, sign, date or submit forms. The signatory checks and completes them. This feature has not been reviewed by a compliance professional.</div>
    {locked(row.status) && <p className="banner warn">This filing has been submitted, so it is locked.</p>}
    <div className="card">{edit ? <ActionForm action={saveChange.bind(null, id)} submit="Save notice" className="f">{fieldBody}</ActionForm> : <div className="f">{fieldBody}</div>}</div>
    <div className="card"><h3>Profiles for new members</h3><p>New shareholders / members need Part III and/or IV of Schedule I; new directors or key management need Part V.</p>{people.map((p) => <p key={p.id}><Link href={`/changes/${id}?person=${p.id}`}>{p.name || "Person (restricted)"}</Link></p>)}{edit && <Link className="btn sm" href={`/changes/${id}?person=new`}>Add a person</Link>}</div>
    <div className="card"><h3>Prepare forms</h3><Link className="btn" href={`/changes/${id}/forms`}>Download notice forms</Link><p className="help">The Commission&apos;s original PDFs, with a continuation sheet when needed. Drafts are marked DRAFT. After approval the fixed copy is used. Signatures and signature dates stay blank.</p></div>
    {can(ctx, "licensing", "write") && <div className="card"><h3>Record a status</h3>{(CHANGE_NEXT[row.status] ?? []).filter((to) => to !== "Approved" || can(ctx, "licensing", "approve")).map((to) => <details key={to}><summary>{({ "Ready for review": "Mark ready for review", Draft: "Back to draft", Approved: "Approve", Submitted: "Record submission", Acknowledged: "Record acknowledgement", Closed: "Close" } as Rec)[to]}</summary><ActionForm action={filingStatus.bind(null, id, to)} submit={`Record ${to}`} confirm={to === "Approved" ? "Approve this notice and keep a fixed copy? Check all particulars and supporting evidence first." : undefined}>{["Submitted", "Acknowledged"].includes(to) && <><p>Record what you did. Quayzen has not sent anything.</p><label className="fld">Date<input type="date" name="date" required /></label><label className="fld">Reference<input name="ref" /></label></>}<label className="fld">Note<textarea name="note" /></label></ActionForm></details>)}</div>}
    <div className="card"><h3>Status and history</h3>{(row.events as Rec[]).slice().reverse().map((e, i) => <p key={i}><b>{e.status}</b> · {e.at} · {e.by}<br /><span className="small">{e.note}</span></p>)}</div>
  </>;
}
