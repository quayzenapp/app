import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin-ui";
import { arCompute, arPdfValues } from "@/lib/ar/engine";
import { STATUS_LABEL, TEMPLATE_LINES, lineValue, loadCompany, loadStore, missingLines, sameAsCalculated, toEngine, type Lines } from "@/lib/ar/store";
import { withTenant } from "@/lib/db";
import { fmtDate, todayISO } from "@/lib/forms";
import { can, requirePermission } from "@/lib/tenant";
import { acceptCalculated, approveReturn, markReady, recordSubmission, reopenReturn } from "../actions";

const TONE: Record<string, string> = { Draft: "info", "Ready for review": "warn", Approved: "ok", Submitted: "ok" };
export default async function ReturnView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("returns");
  const company = await loadCompany(ctx.org.id);
  const data = await withTenant(ctx.org.id, async (tx) => {
    const r = await tx.annualReturn.findFirst({ where: { id, organizationId: ctx.org.id } });
    if (!r) return null;
    return { r, calc: arCompute(await loadStore(tx, ctx.org.id), toEngine(r), company), snap: r.snapshotId ? await tx.returnSnapshot.findFirst({ where: { id: r.snapshotId, organizationId: ctx.org.id } }) : null };
  });
  if (!data) notFound();
  const { r, calc, snap } = data, L = r.lines as Lines;
  const w = can(ctx, "returns", "write"), ap = can(ctx, "returns", "approve"), edit = w && r.status === "Draft";
  const final = ["Approved", "Submitted"].includes(r.status) && !!snap;
  const count = (f: (k: string) => boolean) => TEMPLATE_LINES.filter((l) => f(L[l.key]?.status ?? "notset")).length;
  const stale = TEMPLATE_LINES.filter((l) => L[l.key]?.source === "Calculated" && calc[l.key] && !sameAsCalculated(L[l.key], calc[l.key])).length;
  const notSet = count((k) => k === "missing" || k === "notset");
  const sections = [...new Set(TEMPLATE_LINES.map((l) => l.section))];
  const manual = arPdfValues(snap && final ? (snap.lines as Lines) : L).manual;
  const stat = (v: number, l: string, cls = "") => <div className={`stat ${cls}`}><b>{v}</b><span>{l}</span></div>;
  return (
    <>
      <div className="head">
        <div className="t"><Link className="link" href="/returns">← Annual returns</Link><h1>{r.title}</h1>
          <p className="muted">Period {fmtDate(r.periodStart)} to {fmtDate(r.periodEnd)} · headcount as at {fmtDate(r.headcountAsAt)} · office space as at {fmtDate(r.officeAsAt)} · {r.currencyMethod === "split" ? "currency split by transaction currency" : "full totals in USD and LKR"}</p>
          <div className="row"><span className={`badge ${TONE[r.status] ?? "info"}`}>{r.status}</span>{snap && <span className="small muted">Approved snapshot {snap.versionNo}, fingerprint {snap.hash.slice(0, 16)}</span>}</div>
        </div>
        <div className="acts">
          <a className="btn p" href={`/returns/${r.id}/pdf`}>{final ? "Fill the official PDF" : "Fill a draft of the official PDF"}</a>
          {(["xlsx", "pdf", "docx"] as const).map((x) => <a key={x} className="btn" href={`/returns/${r.id}/report?format=${x}`}>Working report ({x === "xlsx" ? "Excel" : x === "pdf" ? "PDF" : "Word"})</a>)}
        </div>
      </div>
      <div className="stats">{stat(count((k) => k === "value"), "lines with a value")}{stat(count((k) => ["nil", "not_applicable", "not_available"].includes(k)), "Nil / not applicable / not available")}{stat(notSet, "not set or missing", notSet ? "warn" : "")}{stale > 0 && stat(stale, "calculated lines where records have changed", "bad")}</div>
      {r.status !== "Draft" && missingLines(L).length > 0 && <div className="banner warn"><b>{missingLines(L).length} supporting document(s) are not ready:</b> {missingLines(L).map((l) => l.label).join("; ")}.</div>}
      <div className="card">
        <div className="row">
          {edit && <ActionForm action={acceptCalculated.bind(null, r.id)} submit="Use calculated values for lines not yet set" />}
          {edit && <ActionForm action={markReady.bind(null, r.id)} submit="Mark ready for review" />}
          {r.status === "Ready for review" && ap && <ActionForm action={approveReturn.bind(null, r.id)} submit="Approve and keep a snapshot" />}
          {["Ready for review", "Approved"].includes(r.status) && w && <ActionForm action={reopenReturn.bind(null, r.id)} submit="Reopen for changes" />}
        </div>
        {!edit && <p className="small muted">{r.status === "Draft" ? "You can view this return but your role cannot change it." : r.status === "Submitted" ? "This return has been recorded as submitted, so its lines are locked." : `Lines are locked while the return is ${r.status.toLowerCase()}. Reopen it to change a line; the approved snapshot is kept.`}</p>}
        {r.status === "Approved" && w && (
          <><h3>Record the submission</h3><p className="small muted">Record what you sent. The system does not submit the form, tick the declarations or sign it.</p>
            <ActionForm action={recordSubmission.bind(null, r.id)} submit="Record submission" className="row">
              <input type="date" name="submitted_at" defaultValue={todayISO()} aria-label="Date submitted" />
              <input name="submission_method" placeholder="How it was sent, e.g. portal" aria-label="How it was sent" />
              <input name="submission_ref" placeholder="Reference (optional)" aria-label="Reference" />
              <input name="submitted_by_name" placeholder="Who sent it" aria-label="Who sent it" defaultValue={ctx.user.name} />
            </ActionForm></>
        )}
      </div>
      {manual.length > 0 && <div className="card"><h3>Enter these by hand in the PDF</h3><p className="small muted">The 2026 form has no field for these items.</p>{manual.map(([a, b]) => <div className="small" key={a}>{a}: <b>{b}</b></div>)}</div>}
      {sections.map((sec) => (
        <div className="card qz-scroll" key={sec}><h3>{sec}</h3>
          <table className="qz-table"><thead><tr><th>Ref</th><th>Item</th><th>Worked out from records</th><th>Value for the return</th><th>Status</th><th /></tr></thead>
            <tbody>{TEMPLATE_LINES.filter((l) => l.section === sec).map((l) => {
              const s = L[l.key], k = calc[l.key], changed = s?.source === "Calculated" && k && !sameAsCalculated(s, k), warns: string[] = k?.detail.warnings ?? [];
              return (
                <tr key={l.key}>
                  <td className="small">{l.ref}</td>
                  <td>{l.label}{l.note && <div className="help">{l.note}</div>}</td>
                  <td className="small">{k ? lineValue(l, k) : <span className="muted">entered by you</span>}{warns.length > 0 && <> <span className="badge warn" title={warns.join(" ")}>!</span></>}</td>
                  <td>{lineValue(l, s)}{s?.explanation && <div className="help">{s.explanation}</div>}{changed && <div className="help" style={{ color: "var(--bad)" }}>Records changed since this was accepted.</div>}</td>
                  <td>{s ? <><span className={`badge ${s.status === "missing" ? "warn" : "ok"}`}>{STATUS_LABEL[s.status] ?? s.status}</span><div className="help">{s.source}</div></> : <span className="badge">Not set</span>}</td>
                  <td><Link className="btn sm" href={`/returns/${r.id}/line/${l.key}`}>{edit ? "Check / set" : "Details"}</Link></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ))}
    </>
  );
}
