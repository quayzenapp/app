import { ActionForm, ConfirmButton } from "@/components/admin-ui";
import { aiFetch } from "@/lib/ai";
import { requireAdmin } from "@/lib/tenant";
import { documentAction, uploadDocument } from "../actions";

type Doc = { id: string; title: string; short: string | null; kind: string; doc_date: string | null; status: string; error: string | null; superseded: boolean; chunk_count: number; shared: boolean; filename: string | null };
const KINDS = ["Circular", "Act", "Regulations", "Rules", "Gazette notice", "Commission form", "Commission guidance", "Other"];
const TONE: Record<string, string> = { ready: "ok", failed: "bad", processing: "info", pending: "warn" };

export default async function AiDocuments() {
  const ctx = await requireAdmin();
  const platform = ctx.user.isPlatformAdmin;
  let docs: Doc[] | null = null;
  try { const r = await aiFetch(ctx, "/v1/documents"); if (r.ok) docs = await r.json(); } catch {}
  const ready = docs?.filter((d) => d.status === "ready").length ?? 0;
  return (
    <>
      <div className="head"><div className="t"><h1>AI documents</h1><p className="muted">Documents here are what Ask Quayza can read. Your organization's documents are only used for your organization. Shared documents are available to everyone.</p></div></div>
      <div className="card"><h3>Upload a document</h3>
        <ActionForm action={uploadDocument} submit="Upload">
          <div className="grid2">
            <div className="fld"><label htmlFor="d_title">Title</label><input id="d_title" name="title" required placeholder="e.g. Circular 03/2026 on annual returns" /></div>
            <div className="fld"><label htmlFor="d_short">Short name (used in citations)</label><input id="d_short" name="short" placeholder="e.g. Circular 03/2026" /></div>
            <div className="fld"><label htmlFor="d_kind">Type</label><select id="d_kind" name="kind">{KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            <div className="fld"><label htmlFor="d_date">Date of the document</label><input id="d_date" type="date" name="doc_date" /></div>
            <div className="fld"><label htmlFor="d_src">Reference or where it came from</label><input id="d_src" name="source" /></div>
            <div className="fld"><label htmlFor="d_file">File (PDF, Word, Excel, TXT or Markdown, up to 50 MB)</label><input id="d_file" type="file" name="file" accept=".pdf,.docx,.xlsx,.txt,.md" required /></div>
          </div>
          {platform && <p><label><input type="checkbox" name="shared" /> Add to the shared library, for all organizations</label></p>}
        </ActionForm>
      </div>
      <div className="card qz-scroll">
        {docs === null ? <p className="muted">The AI service isn't reachable right now.</p> : (
          <>
            <p className="small muted">{ready} of {docs.length} documents ready.</p>
            <table className="qz-table">
              <thead><tr><th>Document</th><th>Type</th><th>Passages</th><th>Available to</th><th>Status</th><th /></tr></thead>
              <tbody>{docs.map((d) => {
                const can = !d.shared || platform;
                const act = (op: "delete" | "reindex" | "supersede" | "restore", label: string) => <form action={documentAction.bind(null, d.id, op)}><button className="btn sm">{label}</button></form>;
                return (
                  <tr key={d.id}>
                    <td>{d.title}{d.superseded && <> <span className="badge warn">superseded</span></>}{d.error && <div className="small" style={{ color: "var(--bad)" }}>{d.error}</div>}</td>
                    <td>{d.kind}</td><td>{d.chunk_count}</td><td>{d.shared ? "Everyone" : ctx.org.name}</td>
                    <td><span className={`badge ${TONE[d.status] ?? "info"}`}>{d.status}</span></td>
                    <td>{can && <div className="row" style={{ margin: 0 }}>{act(d.superseded ? "restore" : "supersede", d.superseded ? "Restore" : "Superseded")}{act("reindex", "Reprocess")}<ConfirmButton action={documentAction.bind(null, d.id, "delete")} label="Delete" ask={`Permanently delete "${d.title}"? Ask Quayza will stop using it.`} /></div>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
