import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin-ui";
import { PlanVsActual, type PlanYear } from "@/components/plan-pva";
import { BP_SECTIONS, BP_YEAR_FIELDS } from "@/lib/bplan";
import { withTenant } from "@/lib/db";
import { canRestricted, visibleWhere } from "@/lib/documents";
import { fmtDate, fmtDateTime } from "@/lib/forms";
import { createReports } from "@/lib/reports/engine";
import { loadReportStore, toEnginePlan } from "@/lib/reports/store";
import { can, requirePermission } from "@/lib/tenant";
import { askForCheck, backToDraft, lockPlan, revisePlan, saveProgress, setReference, verifyFingerprint } from "../actions";

const TONE: Record<string, string> = { Draft: "info", "Ready for check": "warn", Locked: "ok" };
type Ms = { milestone: string; target_date?: string | null; actual_status?: string | null; actual_date?: string | null; actual_note?: string | null };
type Year = Record<string, string | number | null>;
const money = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "");

export default async function PlanView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("bplan");
  const data = await withTenant(ctx.org.id, async (tx) => {
    const v = await tx.businessPlan.findFirst({ where: { id, organizationId: ctx.org.id } });
    if (!v) return null;
    const store = await loadReportStore(tx, ctx), eng = createReports(store, () => canRestricted(ctx)), ref = eng.referencePlan();
    return { v, refId: ref?.id as string | undefined, pva: (v.status === "Locked" ? eng.comparePlan(toEnginePlan(v)) : []) as PlanYear[], docs: can(ctx, "documents") ? await tx.document.findMany({ where: { ...visibleWhere(ctx), linkType: "bplans", linkId: id } }) : [], history: can(ctx, "audit") ? await tx.auditLog.findMany({ where: { organizationId: ctx.org.id, entityType: "bplans", entityId: id }, orderBy: { createdAt: "desc" }, take: 30 }) : [] };
  });
  if (!data) notFound();
  const { v, refId, pva, docs, history } = data, w = can(ctx, "bplan", "write"), ap = can(ctx, "bplan", "approve"), locked = v.status === "Locked";
  const years = v.years as Year[], ms = v.milestones as Ms[], sections = v.sections as Record<string, string>;
  return (
    <>
      <div className="head">
        <div className="t"><Link className="link" href="/bplan">← Business plan reference</Link><h1>{v.title} <span className="muted">v{v.versionNo}</span></h1>
          <div className="row"><span className={`badge ${TONE[v.status] ?? "info"}`}>{v.status}</span>{refId === v.id && <span className="badge ok">Used for comparison</span>}{v.hash && <span className="small muted" title="SHA-256 fingerprint of the locked figures">Fingerprint {v.hash.slice(0, 16)}</span>}</div></div>
        <div className="acts">{(["xlsx", "pdf", "docx"] as const).map((f) => <a key={f} className="btn sm" href={`/bplan/${v.id}/export?format=${f}`}>{f === "xlsx" ? "Excel" : f === "pdf" ? "PDF" : "Word"}</a>)}</div>
      </div>
      <div className="card"><div className="row">
        {w && v.status === "Draft" && <><Link className="btn sm p" href={`/bplan/${v.id}/edit`}>Edit</Link><ActionForm action={askForCheck.bind(null, v.id)} submit="Ask for a check" /></>}
        {v.status === "Ready for check" && ap && <ActionForm action={lockPlan.bind(null, v.id)} submit="Checked against the plan - lock it" />}
        {v.status === "Ready for check" && w && <ActionForm action={backToDraft.bind(null, v.id)} submit="Back to draft" />}
        {locked && w && refId !== v.id && <ActionForm action={setReference.bind(null, v.id)} submit="Use this version for comparison" />}
        {locked && w && <form action={revisePlan.bind(null, v.id)}><button className="btn sm">Record a revised plan</button></form>}
        {v.hash && <ActionForm action={verifyFingerprint.bind(null, v.id)} submit="Check fingerprint" />}
        {can(ctx, "documents", "write") && <Link className="btn sm" href={`/documents/new?type=bplans&id=${v.id}`}>Attach the plan document</Link>}
      </div></div>
      <div className="card"><dl className="kv">
        <dt>What this version is</dt><dd>{v.commissionStatus ?? "—"}</dd><dt>Date given to the Commission</dt><dd>{fmtDate(v.commissionDate) || "—"}</dd><dt>Reference (letter, email or application number)</dt><dd>{v.commissionRef ?? "—"}</dd>
        <dt>Year 1 starts</dt><dd>{fmtDate(v.year1Start) || "—"}</dd><dt>Plan document</dt><dd>{docs.length ? docs.map((d) => <Link key={d.id} href={`/documents/${d.id}`}>{d.title} </Link>) : "Not attached"}</dd>
        {v.changeSummary && <><dt>What changed from the previous version</dt><dd>{v.changeSummary}</dd></>}
      </dl></div>
      <p className="note">{locked ? `Checked against the submitted plan and locked by ${v.lockedByName ?? "—"} on ${v.lockedAt ? fmtDateTime(v.lockedAt) : "—"}. The figures cannot be changed; if the Commission accepts a revised plan, record it as a new version.` : "Enter the figures exactly as they appear in the plan you submitted. A second person then checks them against the plan and locks this version."}</p>
      <div className="card qz-scroll"><h3>Year-by-year projections (as submitted)</h3>
        <table className="qz-table"><thead><tr><th>Item</th>{years.map((_, i) => <th key={i}>Year {i + 1}</th>)}</tr></thead>
          <tbody>{BP_YEAR_FIELDS.map(([k, l, t]) => <tr key={k}><td>{l}</td>{years.map((y, i) => <td key={i} className={t === "num" || t === "int" ? "" : "small"}>{t === "num" || t === "int" ? money(y[k]) : y[k] ?? ""}</td>)}</tr>)}</tbody></table>
      </div>
      <div className="card qz-scroll"><h3>Milestones</h3>
        {ms.length ? (() => {
          const table = <table className="qz-table"><thead><tr><th>Milestone</th><th>Target date (plan)</th><th>Actual status</th><th>Actual date</th><th>Note</th></tr></thead>
            <tbody>{ms.map((m, i) => <tr key={i}><td>{m.milestone}</td><td>{fmtDate(m.target_date)}</td>
              <td>{w ? <select name={`ms${i}_status`} defaultValue={m.actual_status ?? ""} aria-label={`Status of ${m.milestone}`}>{["", "Not started", "In progress", "Achieved", "Delayed", "Dropped"].map((s) => <option key={s}>{s}</option>)}</select> : m.actual_status}</td>
              <td>{w ? <input type="date" name={`ms${i}_date`} defaultValue={m.actual_date ?? ""} aria-label={`Date of ${m.milestone}`} /> : fmtDate(m.actual_date)}</td>
              <td>{w ? <input name={`ms${i}_note`} defaultValue={m.actual_note ?? ""} aria-label={`Note on ${m.milestone}`} /> : m.actual_note}</td></tr>)}</tbody></table>;
          return w ? <ActionForm action={saveProgress.bind(null, v.id)} submit="Save progress">{table}</ActionForm> : table;
        })() : <p className="muted">No milestones.</p>}
        <p className="small muted">Actual progress can be updated at any time. It is not part of the locked plan figures.</p>
      </div>
      {BP_SECTIONS.some(([k]) => sections[k]) && <div className="card"><h3>Key points from the plan</h3>{BP_SECTIONS.filter(([k]) => sections[k]).map(([k, l]) => <div key={k}><h4>{l}</h4><p style={{ whiteSpace: "pre-wrap" }}>{sections[k]}</p></div>)}</div>}
      {locked && <><h2>Plan vs actual for this version</h2><PlanVsActual id={v.id} rows={pva} writable={w} /></>}
      {can(ctx, "audit") && <div className="card"><h3>History</h3>{history.map((a) => <div className="small" key={a.id}>{fmtDateTime(a.createdAt)} · {a.actorEmail ?? "System"} · {a.summary}</div>)}</div>}
    </>
  );
}
