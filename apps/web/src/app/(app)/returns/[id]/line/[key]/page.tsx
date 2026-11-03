import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin-ui";
import { arCompute } from "@/lib/ar/engine";
import { TEMPLATE_LINES, lineValue, loadCompany, loadStore, toEngine, type Lines } from "@/lib/ar/store";
import { withTenant } from "@/lib/db";
import { can, requirePermission } from "@/lib/tenant";
import { setLine } from "../../../actions";

type Rec = Record<string, unknown>;
const recName = (e: Rec) => String(e.source_name ?? e.description ?? e.name ?? e.ref ?? e.job_title ?? ""); // never a person's name
const money = (n: unknown) => (typeof n === "number" ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");

export default async function LinePage({ params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  const ctx = await requirePermission("returns");
  const l = TEMPLATE_LINES.find((x) => x.key === key);
  if (!l) notFound();
  const company = await loadCompany(ctx.org.id);
  const data = await withTenant(ctx.org.id, async (tx) => {
    const r = await tx.annualReturn.findFirst({ where: { id, organizationId: ctx.org.id } });
    return r ? { r, calc: arCompute(await loadStore(tx, ctx.org.id), toEngine(r), company) } : null;
  });
  if (!data) notFound();
  const { r, calc } = data, s = (r.lines as Lines)[key], k = calc[key];
  const edit = can(ctx, "returns", "write") && r.status === "Draft";
  const cur = s?.status === "value" ? s : null;
  const opts: [string, string][] = l.kind === "doc" ? [["doc_ready", "Ready (copy on file)"], ["doc_missing", "Not ready yet"], ["not_applicable", "Not applicable to us"]]
    : l.kind === "confirm" ? [["conf_yes", "The company has confirmed this"], ["conf_no", "Not confirmed (explain under Decl. 3)"]]
    : [...(k ? [["calc", "Use the worked-out value"] as [string, string]] : []), ["manual", "Enter the value myself"], ["nil", "Nil (there was none)"], ["not_applicable", "Not applicable"], ["not_available", "Not available"]];
  const pre = !s ? (k ? "calc" : l.kind === "doc" ? "doc_ready" : l.kind === "confirm" ? "conf_yes" : "manual") : l.kind === "doc" ? (s.status === "value" ? "doc_ready" : s.status === "not_applicable" ? "not_applicable" : "doc_missing") : l.kind === "confirm" ? (s.text === "Confirmed" ? "conf_yes" : "conf_no") : s.source === "Calculated" ? "calc" : s.status === "value" ? "manual" : s.status;
  const initial = !cur ? "" : l.kind === "table" && cur.text ? (JSON.parse(cur.text) as { country: string; currency: string; amount: number }[]).map((x) => `${x.country} ; ${x.currency} ; ${x.amount}`).join("\n") : String(cur.num ?? cur.text ?? "");
  const used: { e: Rec; used: unknown }[] = k?.detail.used ?? [], excluded: { e: Rec; reason: string }[] = k?.detail.excluded ?? [], warnings: string[] = k?.detail.warnings ?? [];
  return (
    <>
      <div className="head"><div className="t"><Link className="link" href={`/returns/${r.id}`}>← {r.title}</Link><h1>{l.label}</h1><p className="muted small">Form reference {l.ref}{typeof l.pdf === "string" ? ` · PDF field ${l.pdf}` : l.kind === "table" ? " · 12 rows in the PDF" : l.shared025 ? " · shared PDF field p3_field_025" : ["doc", "confirm"].includes(l.kind) ? " · internal record (not in the PDF)" : " · no PDF field: enter by hand"}</p></div></div>
      {k && (
        <div className="card"><h3>How it was worked out</h3><p className="small">{k.detail.explanation}</p><p><b>Result:</b> {lineValue(l, k) || "nothing found"}</p>
          {warnings.map((x) => <p className="note small" key={x}>{x}</p>)}
          {used.length > 0 && <details><summary className="small">{used.length} record(s) used</summary><table className="qz-table small"><tbody>{used.slice(0, 40).map((u, i) => <tr key={i}><td>{String(u.e.entry_date ?? u.e.start_date ?? "")}</td><td>{recName(u.e)}</td><td>{String(u.e.original_currency ?? "")} {money(u.e.original_amount)}</td><td>{money(u.used)}</td></tr>)}</tbody></table></details>}
          {excluded.length > 0 && <details open><summary className="small">{excluded.length} record(s) left out</summary>{excluded.map((x, i) => <div className="small" key={i}>{recName(x.e)}: {x.reason}</div>)}</details>}
        </div>
      )}
      {s && <p className="small">Current: <b>{lineValue(l, s)}</b> ({s.source}{s.set_by ? `, by ${s.set_by} on ${s.set_at}` : ""})</p>}
      {edit && (
        <div className="card">
          <ActionForm action={setLine.bind(null, r.id, key)} submit="Save line">
            <fieldset><legend>What should the return show?</legend>{opts.map(([v, t]) => <label className="radio" key={v} style={{ display: "block" }}><input type="radio" name="action" value={v} defaultChecked={v === pre} /> {t}</label>)}</fieldset>
            {!["doc", "confirm"].includes(l.kind) && <div className="fld"><label htmlFor="val">Value (for &quot;Enter the value myself&quot;)</label>
              {l.kind === "table" ? <><textarea id="val" name="value" rows={5} defaultValue={initial} placeholder="One row per line: Country ; Currency ; Amount" /><span className="help">Use USD or LKR. Up to 12 rows fit on the form.</span></>
                : l.kind === "bool" ? <select id="val" name="value" defaultValue={initial || "No"}><option>Yes</option><option>No</option></select>
                : l.kind === "longtext" ? <textarea id="val" name="value" rows={3} defaultValue={initial} />
                : <input id="val" name="value" defaultValue={initial} inputMode={["amount", "area", "count"].includes(l.kind) ? "decimal" : undefined} />}</div>}
            <div className="fld"><label htmlFor="ex">Explanation</label><textarea id="ex" name="explanation" rows={2} defaultValue={s?.explanation ?? k?.autoExpl ?? ""} /><span className="help">Required when you enter a value yourself or mark Nil, Not applicable, Not available or Not confirmed.</span></div>
          </ActionForm>
        </div>
      )}
    </>
  );
}
