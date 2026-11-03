import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmButton } from "@/components/admin-ui";
import { SpecFields } from "@/components/lic-fields";
import { withTenant } from "@/lib/db";
import { fmtDate, fmtDateTime, todayISO } from "@/lib/forms";
import { LOCKED, S, hiddenPersonKeys, loadLic, stripPerson, toEngineApp, toEnginePerson } from "@/lib/lic/store";
import { can, requirePermission } from "@/lib/tenant";
import { approveApplication, changeStatus, removePerson, saveChecklist, savePerson, saveStep, setupRecords } from "../actions";

type Rec = Record<string, any>;
type P = { step?: string; person?: string };
export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<P> }) {
  const { id } = await params;
  const p = await searchParams;
  const ctx = await requirePermission("licensing");
  const data = await withTenant(ctx.org.id, async (tx) => {
    const row = await tx.application.findFirst({ where: { id, organizationId: ctx.org.id } });
    if (!row) return null;
    const lic = await loadLic(tx, ctx), a = toEngineApp(row) as Rec;
    return { row, lic, a, R: lic.appReadiness(a), cl: lic.checklistRows(a), T: lic.tefTotals(a), people: (await tx.applicationPerson.findMany({ where: { applicationId: id, organizationId: ctx.org.id }, orderBy: { createdAt: "asc" } })).map(toEnginePerson),
      history: can(ctx, "audit") ? await tx.auditLog.findMany({ where: { organizationId: ctx.org.id, entityType: "apps", entityId: id }, orderBy: { createdAt: "desc" }, take: 40 }) : [], missing: (step: string) => lic.stepMissing(a, step) as string[] };
  });
  if (!data) notFound();
  const { row, lic, a, R, cl, T, people, history } = data;
  const step = lic.APP_STEPS.some(([k]: [string]) => k === p.step) ? p.step! : "overview";
  const w = can(ctx, "licensing", "write"), ap = can(ctx, "licensing", "approve"), locked = !w || LOCKED.includes(row.status);
  const miss = data.missing(step);
  const todo = !["overview", "checklist", "forms", "history"].includes(step) && <p className="small">{miss.length ? <><span className="badge warn">{miss.length} to do</span> {miss.slice(0, 6).join("; ")}{miss.length > 6 ? " …" : ""}</> : <span className="badge ok">complete</span>}</p>;
  const stageIdx = (lic.APP_STAGES as [string, string[]][]).findIndex(([, ss]) => ss.includes(row.status));
  const issued = row.status === S.issued;
  const fieldset = (name: string, val: unknown, label: string, area = false) => area ? <textarea name={name} rows={2} defaultValue={String(val ?? "")} disabled={locked} aria-label={label} /> : <input name={name} defaultValue={String(val ?? "")} disabled={locked} aria-label={label} />;
  const save = saveStep.bind(null, id, step);
  const mp = (lic.getPath(a, "p6.mp") ?? {}) as Rec, t = (a.tef ?? {}) as Rec, v = (t.v ?? {}) as Rec, det = (t.d ?? {}) as Rec, prof = (a.prof ?? {}) as Rec, par = (prof.parent ?? {}) as Rec, decl = (a.decl ?? {}) as Rec, pr = (decl.presenter ?? {}) as Rec;
  const ents: Rec[] = prof.entities ?? [], fl = (k: string, lab: string, area = false) => <div className={`fld${area ? " wide" : ""}`}><label>{lab}</label>{fieldset(`prof.${k}`, prof[k], lab, area)}</div>;
  const sheet = lic.tefSheet(a);
  const statusBtn = (to: string, label: string, primary = false) => {
    const fs = (lic.STATUS_FIELDS[to] ?? []) as [string, string, any, boolean?, string?][];
    return <details key={to} className="card" style={{ margin: 0 }}><summary className={`btn sm ${primary ? "p" : ""}`}>{label}</summary>
      <ActionForm action={changeStatus.bind(null, id, to)} submit="Save">
        {to === S.submitted && <p className="small">Record what you submitted. The system has not sent anything.</p>}
        {to === S.ready && R.steps.some((s: Rec) => s.missing.length) && <p className="note small">{R.steps.reduce((n: number, s: Rec) => n + s.missing.length, 0)} item(s) are still missing and {R.docs.total - R.docs.ok} document(s) are not ready. You can still send it for review.</p>}
        {fs.map(([k, l, ty, req, help]) => <div className="fld" key={k}><label htmlFor={`st_${to}_${k}`}>{l}{req && <span className="req"> *</span>}</label>{Array.isArray(ty) ? <select id={`st_${to}_${k}`} name={k}>{ty.map((o: string) => <option key={o}>{o}</option>)}</select> : ty === "area" ? <textarea id={`st_${to}_${k}`} name={k} rows={3} /> : ty === "check" ? <label className="radio"><input type="checkbox" id={`st_${to}_${k}`} name={k} defaultChecked /> Yes</label> : <input id={`st_${to}_${k}`} name={k} type={ty === "date" ? "date" : "text"} defaultValue={ty === "date" ? todayISO() : undefined} />}{help && <span className="help">{help}</span>}</div>)}
      </ActionForm></details>;
  };
  const actions = !w ? null : row.status === S.prep || row.status === S.info ? <>{statusBtn(S.ready, "Mark ready for review", true)}{statusBtn(S.withdrawn, "Withdraw")}</>
    : row.status === S.ready ? <>{ap ? <ActionForm action={approveApplication.bind(null, id)} submit="Approve for submission" confirm={R.ready ? undefined : "Some items are still missing or not ready. Approve anyway? The approval will record this."} /> : <span className="small muted">Waiting for a reviewer with approval rights.</span>}{statusBtn(S.prep, "Back to preparing")}</>
    : row.status === S.approved ? <>{statusBtn(S.submitted, "Record submission", true)}{statusBtn(S.prep, "Back to preparing")}</>
    : row.status === S.submitted ? <>{statusBtn(S.aip, "Record Approval in Principle", true)}{statusBtn(S.info, "Commission asked for more information")}{statusBtn(S.rejected, "Record rejection")}{statusBtn(S.withdrawn, "Withdraw")}</>
    : row.status === S.aip ? <>{statusBtn(S.clear, "Regulatory clearances in progress")}{statusBtn(S.issued, "Record licence issued", true)}</>
    : row.status === S.clear ? <>{statusBtn(S.issued, "Record licence issued", true)}{statusBtn(S.info, "Commission asked for more information")}</>
    : row.status === S.issued ? <details className="card" style={{ margin: 0 }}><summary className="btn sm p">Set up compliance records from this application</summary><p className="small">Copy what the application already holds into the records the rest of Quayzen uses. Choose what to copy.</p>
        <ActionForm action={setupRecords.bind(null, id)} submit="Set up">{([["profile", "Update the company profile (licence number, designation, address, signatory and contact)"], ["licence", `Create the licence record (${a.licence_number ?? "no number"}) and make it the main licence`], ["people", "Add directors and shareholders to the company register. Names already there are skipped."], ["office", "Add the proposed office to the office register as planned"]] as const).map(([k, l]) => <label key={k} className="radio" style={{ display: "block" }}><input type="checkbox" name={k} defaultChecked /> {l}</label>)}</ActionForm></details> : null;
  const editing = p.person === "new" ? { app_id: id } : people.find((x) => x.id === p.person);
  const shown = people.map((x) => stripPerson(x as Rec, ctx.sensitive));
  return (
    <>
      <div className="head"><div className="t"><Link className="link" href="/apply">← Applications</Link><h1>{row.title}</h1><div className="row"><span className="badge info">{row.status}</span><span className="small muted">{a.app_type}</span></div></div></div>
      <div className="tabs" role="tablist">{(lic.APP_STEPS as [string, string][]).map(([k, l]) => <Link key={k} role="tab" href={`/apply/${id}?step=${k}`} className={`tab${k === step ? " on" : ""}`} aria-selected={k === step}>{l}</Link>)}</div>
      {lic.STEP_INTRO?.[step] && <p className="muted small">{lic.STEP_INTRO[step]}</p>}
      {locked && w && <p className="note small">This application is locked because it has been submitted. Details can&apos;t be changed unless the Commission asks for more information.</p>}

      {step === "overview" && <>
        <div className="card"><ol className="stepper">{(lic.APP_STAGES as [string][]).map(([l], i) => <li key={l} className={i < stageIdx || issued ? "done" : i === stageIdx ? "cur" : ""}><span>{i < stageIdx || issued ? "✓" : i + 1}</span>{l}</li>)}</ol>{actions && <div className="row" style={{ marginTop: 12, alignItems: "flex-start" }}>{actions}</div>}</div>
        <div className="stats hlc">
          <div className="stat static"><b>{R.steps.filter((s: Rec) => !s.missing.length).length} of {R.steps.length}</b><span>Steps complete</span></div>
          <div className="stat static"><b>{R.docs.ok} of {R.docs.total}</b><span>Supporting documents ready</span></div>
          <div className="stat static"><b>{people.length}</b><span>People and companies</span></div>
          <div className="stat static"><b>{cl.filter((r: Rec) => r.warn.some((x: string) => /30 days/.test(x))).length}</b><span>Certified copies older than 30 days</span></div>
        </div>
        <div className="card"><h3>What&apos;s left</h3>{R.steps.map((s: Rec) => <p key={s.k} className="small"><Link href={`/apply/${id}?step=${s.k}`}><b>{s.l}</b></Link> {s.missing.length ? <><span className="badge warn">{s.missing.length} to do</span> <span className="muted">{s.missing.slice(0, 3).join("; ")}</span></> : <span className="badge ok">complete</span>}</p>)}</div>
      </>}

      {["applicant", "business"].includes(step) && <div className="card">{todo}<SpecFields specKeys={step} kind="app" initial={a} action={save} disabled={locked} submit="Save" /></div>}

      {step === "people" && <div className="card">{todo}
        {editing ? <><h3>{p.person === "new" ? "Add a person or company" : "Edit"}</h3><Link className="link small" href={`/apply/${id}?step=people`}>← Back to people</Link>
          <SpecFields specKeys="" kind="person" initial={{ ...stripPerson(editing as Rec, ctx.sensitive), __app: a } as Rec} hidden={hiddenPersonKeys(ctx.sensitive)} action={savePerson.bind(null, id, p.person === "new" ? null : p.person!)} disabled={locked} submit="Save" /></>
        : <>{shown.length ? <div className="qz-scroll"><table className="qz-table"><thead><tr><th>Name</th><th>Type</th><th>Roles</th><th>Ownership</th><th>Missing</th><th /></tr></thead><tbody>{shown.map((x: Rec, i: number) => <tr key={x.id}><td><Link href={`/apply/${id}?step=people&person=${x.id}`}>{x.name}</Link></td><td>{x.kind}</td><td className="small">{(x.roles ?? []).join("; ")}</td><td>{x.shareholding_pct != null ? `${x.shareholding_pct}%` : ""}</td><td>{lic.personMissing(people[i], a).length || ""}</td><td>{!locked && <ConfirmButton action={removePerson.bind(null, id, x.id)} label="Remove" ask={`Remove ${x.name} from this application?`} />}</td></tr>)}</tbody></table></div> : <p className="muted">Nobody added yet.</p>}
          {!locked && <div className="row"><Link className="btn sm p" href={`/apply/${id}?step=people&person=new`}>Add a person or company</Link></div>}</>}
      </div>}

      {step === "proposal" && <div className="card">{todo}<SpecFields specKeys="proposal" kind="app" initial={a} action={save} disabled={locked} submit="Save" extra={
        <fieldset><legend>Manpower planning</legend><p className="help">Number of people by category, and the expected remuneration (state the currency and period, e.g. USD per year).{T[0].staff ? ` Your projections show ${T[0].local} local and ${T[0].foreign} foreign staff in year 1.` : ""}</p>
          <div className="qz-scroll"><table className="qz-table"><thead><tr><th>Category</th><th>Local</th><th>Non-local</th><th>Expected remuneration</th></tr></thead><tbody>{(lic.MP_ROWS as [string, string][]).map(([k, l]) => <tr key={k}><td>{l}</td><td>{fieldset(`p6.mp.${k}.local`, mp[k]?.local, `${l} local`)}</td><td>{fieldset(`p6.mp.${k}.nonlocal`, mp[k]?.nonlocal, `${l} non-local`)}</td><td>{fieldset(`p6.mp.${k}.pay`, mp[k]?.pay, `${l} remuneration`)}</td></tr>)}</tbody></table></div></fieldset>} /></div>}

      {step === "projections" && <div className="card">{todo}
        <ActionForm action={save} submit="Save" className="f">
          <div className="fld"><label htmlFor="t_y1">Year 1 starts on</label><input id="t_y1" type="date" name="tef.year1" defaultValue={t.year1 ?? ""} disabled={locked} /></div>
          <div className="qz-scroll"><table className="qz-table bgrid"><thead><tr><th>Item</th>{Array.from({ length: 10 }, (_, y) => <th key={y}>Y{y + 1}</th>)}</tr></thead><tbody>
            {(lic.TEF_ROWS as Rec[]).flatMap((r) => (r.pair && sheet === "primary" ? [[`${r.k}_ll`, `${r.l} - Land lease`], [`${r.k}_dev`, `${r.l} - Development`]] : [[r.k, r.l]]).map(([key, lab]: string[], i: number) => <tr key={key}><td style={{ minWidth: 230 }} title={r.help}>{lab}{r.det && i === 0 && <div className="det">{fieldset(`tef.d.${r.k}.provider`, det[r.k]?.provider, `${r.l} provider`)}{fieldset(`tef.d.${r.k}.docref`, det[r.k]?.docref, `${r.l} document`)}</div>}</td>{Array.from({ length: 10 }, (_, y) => <td key={y} style={{ minWidth: 80 }}>{fieldset(`tef.v.${key}.${y}`, (v[key] ?? [])[y], `${lab} year ${y + 1}`)}</td>)}</tr>))}
          </tbody></table></div>
        </ActionForm></div>}

      {step === "profile" && <div className="card">{todo}
        <ActionForm action={save} submit="Save" className="f">
          <fieldset><legend>Part 1: the applicant</legend><div className="grid2">{fl("sectors", "Business sectors")}{fl("years_exp", "Years of experience in the relevant business sectors")}</div>
            <h4>Global presence</h4><div className="qz-scroll"><table className="qz-table small"><thead><tr><th>Entity name</th><th>Country</th><th>Type</th><th>Years of operation</th></tr></thead><tbody>{Array.from({ length: Math.max(3, ents.length + 1) }, (_, i) => <tr key={i}><td>{fieldset(`prof.entities.${i}.name`, ents[i]?.name, "Entity name")}</td><td>{fieldset(`prof.entities.${i}.country`, ents[i]?.country, "Country")}</td><td><select name={`prof.entities.${i}.type`} defaultValue={ents[i]?.type ?? ""} disabled={locked} aria-label="Type"><option value="">—</option>{(lic.ENTITY_TYPES as string[]).map((o) => <option key={o}>{o}</option>)}</select></td><td>{fieldset(`prof.entities.${i}.years`, ents[i]?.years, "Years")}</td></tr>)}</tbody></table></div>
            <div className="grid2">{fl("countries", "Countries served (main countries of clients)", true)}{fl("segments", "Target segments (corporate, SME, individual etc.)", true)}{fl("client_sectors", "Industry / business sectors of clients", true)}</div></fieldset>
          <fieldset><legend>Part 2: parent company or other associated entity</legend><div className="grid2"><div className="fld"><label>Business sectors</label>{fieldset("prof.parent.sectors", par.sectors, "Parent business sectors")}</div><div className="fld"><label>Years of experience</label>{fieldset("prof.parent.years_exp", par.years_exp, "Parent years of experience")}</div></div></fieldset>
        </ActionForm></div>}

      {step === "declarations" && <div className="card">{todo}<p className="muted small">The system fills in names and addresses only; the people concerned read, sign and date the declarations themselves.</p>
        <ActionForm action={save} submit="Save" className="f">
          <fieldset><legend>AP Declaration</legend><div className="grid2"><div className="fld"><label>Director signing (1)</label>{fieldset("decl.director1", decl.director1, "Director 1")}</div><div className="fld"><label>Director signing (2)</label>{fieldset("decl.director2", decl.director2, "Director 2")}</div>
            {a.q?.group_sl === "Yes" && <><div className="fld"><label>Parent company name</label>{fieldset("decl.parent_name", decl.parent_name, "Parent name")}</div><div className="fld wide"><label>Parent company address</label>{fieldset("decl.parent_address", decl.parent_address, "Parent address", true)}</div></>}</div>
            <p className="note small">The declaration includes undertakings (for example, not to relocate Sri Lankan business into SEZ without approval and not to carry on gambling). Breach leads to cancellation. Have it reviewed before signing.</p></fieldset>
          <fieldset><legend>UBO Declaration presenter</legend><div className="grid2">{[["name", "Name"], ["capacity", "Capacity"], ["email", "Email"]].map(([k, l]) => <div className="fld" key={k}><label>{l}</label>{fieldset(`decl.presenter.${k}`, pr[k], `Presenter ${l}`)}</div>)}</div><p className="small">One declaration is prepared for each beneficial owner in <Link href="/r/ubo">Company Profile</Link>.</p></fieldset>
        </ActionForm></div>}

      {step === "checklist" && <div className="card qz-scroll"><p className="small muted">Certified copies must be certified within 30 days before submission. {a.planned_date ? `Checked against the planned submission date, ${fmtDate(a.planned_date)}.` : "Set a planned submission date on the Applicant step to check this."}</p>
        <ActionForm action={saveChecklist.bind(null, id)} submit="Save"><table className="qz-table"><thead><tr><th>Document</th><th>Status</th><th>Certified on</th><th>Note</th><th>File</th></tr></thead><tbody>{cl.map((r: Rec) => <tr key={r.key}><td><b>{r.it.t}</b>{r.who && <div>{r.who}</div>}<div className="small muted">{r.it.src}</div>{r.it.help && <div className="small">{r.it.help}</div>}{r.warn.map((x: string) => <div className="small" style={{ color: "var(--warn)" }} key={x}>{x}</div>)}</td><td><select name={`st:${r.key}`} defaultValue={r.status} disabled={locked} aria-label="Status">{(lic.CL_STATUS as string[]).map((o) => <option key={o}>{o}</option>)}</select></td><td>{r.it.cert30 ? <input type="date" name={`cert:${r.key}`} defaultValue={r.e.cert_date ?? ""} disabled={locked} aria-label="Certified on" /> : <span className="muted small">—</span>}</td><td><input name={`note:${r.key}`} defaultValue={r.e.note ?? ""} disabled={locked} aria-label="Note" /></td><td>{r.e.doc_id && <Link className="small" href={`/documents/${r.e.doc_id}`}>Open</Link>}{!locked && <input type="file" name={`file:${r.key}`} aria-label={`File for ${r.it.t}`} style={{ maxWidth: 190 }} />}</td></tr>)}</tbody></table></ActionForm></div>}

      {step === "forms" && <div className="card"><h3>Forms and downloads</h3><p className="muted small">Each form is the Commission&apos;s original file, filled from this application. Open every file and check it before anyone signs. Nothing is signed, ticked as a declaration or sent by Quayzen.</p>
        {[S.prep, S.ready, S.info].includes(row.status) && <p className="note small">This application hasn&apos;t been approved for submission yet{R.steps.some((s: Rec) => s.missing.length) ? ", and some items are missing" : ""}. You can still download drafts to review; they&apos;re marked DRAFT.</p>}
        <div className="row"><a className="btn sm p" href={`/apply/${id}/pack`}>Download the full pack</a></div>
        <div className="qz-scroll"><table className="qz-table"><thead><tr><th>Form</th><th>File</th><th /></tr></thead><tbody>{([["s1", "Application form (Schedule I)", "PDF"], ["tef", "Technical Evaluation Form", "Excel"], ["ap_decl", "AP Declaration", "Word"], ["ubo", "UBO Declaration, one per beneficial owner", "Word"], ["ds", "Information of Directors and Shareholders", "Word"], ["bprofile", "Business Profile and Key Management Personnel", "Word"]] as const).map(([k, t, f]) => <tr key={k}><td>{t}</td><td>{f}</td><td><a className="btn sm" href={`/apply/${id}/forms/${k}`}>Download</a></td></tr>)}</tbody></table></div></div>}

      {step === "history" && <div className="card"><h3>Status</h3>{(row.events as Rec[]).slice().reverse().map((e, i) => <p className="small" key={i}><b>{e.status}</b> · {e.at} · {e.by}{e.date ? ` · ${fmtDate(e.date)}` : ""}{e.ref ? ` · ${e.ref}` : ""}{e.note ? ` · ${e.note}` : ""}</p>)}{history.length > 0 && <><h3>Changes</h3>{history.map((h) => <div className="small" key={h.id}>{fmtDateTime(h.createdAt)} · {h.actorEmail ?? "System"} · {h.summary}</div>)}</>}</div>}
    </>
  );
}
