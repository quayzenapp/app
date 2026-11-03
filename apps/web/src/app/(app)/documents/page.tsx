import Link from "next/link";
import { canRestricted, linkLabel, visibleWhere } from "@/lib/documents";
import { withTenant } from "@/lib/db";
import { daysUntil, fmtDate, getForms } from "@/lib/forms";
import { can, requirePermission } from "@/lib/tenant";

export default async function Documents({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q = "", category = "" } = await searchParams;
  const ctx = await requirePermission("documents");
  const forms = await getForms(ctx.org.id);
  const { rows, hidden, labels } = await withTenant(ctx.org.id, async (tx) => {
    const rows = await tx.document.findMany({ where: visibleWhere(ctx), include: { _count: { select: { versions: true } } }, orderBy: [{ category: "asc" }, { title: "asc" }], take: 2000 });
    const hidden = canRestricted(ctx) ? 0 : await tx.document.count({ where: { organizationId: ctx.org.id, archivedAt: null, access: "Restricted" } });
    const labels = new Map(await Promise.all(rows.filter((d) => d.linkType).map(async (d) => [d.id, await linkLabel(tx, ctx, forms, d.linkType, d.linkId)] as const)));
    return { rows, hidden, labels };
  });
  const expiring = (d: { expiryDate: string | null }) => !!d.expiryDate && daysUntil(d.expiryDate) <= 60;
  const noFile = rows.filter((d) => !d._count.versions).length, soon = rows.filter(expiring).length;
  const cats = [...new Set(rows.map((d) => d.category))];
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((d) => (!category || d.category === category) && (!needle || [d.title, d.category, d.notes].join(" ").toLowerCase().includes(needle)));
  const stat = (v: number, l: string, warn = false) => <div className={`stat ${warn ? "warn" : ""}`}><b>{v}</b><span>{l}</span></div>;
  return (
    <>
      <div className="head"><div className="t"><h1>Documents</h1><p className="muted">Licences, approvals, returns, letters and evidence, with versions and expiry dates.</p></div>
        <div className="acts">{can(ctx, "documents", "write") && <Link className="btn p" href="/documents/new">Add document</Link>}</div></div>
      {hidden > 0 && <p className="note small">{hidden} restricted document(s) are hidden for your role.</p>}
      <div className="stats">{stat(rows.length, "Documents")}{stat(noFile, "Without a file", noFile > 0)}{stat(soon, "Expired or expiring within 60 days", soon > 0)}{stat(rows.filter((d) => d.access === "Restricted").length, "Restricted")}</div>
      <form className="row" style={{ marginBottom: 12 }}>
        <input name="q" type="search" defaultValue={q} placeholder="Search" aria-label="Search" />
        <select name="category" defaultValue={category} aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <button className="btn sm">Filter</button>
      </form>
      <div className="card qz-scroll">{shown.length ? (
        <table className="qz-table"><thead><tr><th>Title</th><th>Category</th><th>Access</th><th>Linked to</th><th>Versions</th><th>Expiry</th></tr></thead>
          <tbody>{shown.map((d) => (
            <tr key={d.id}>
              <td><Link href={`/documents/${d.id}`}>{d.title}</Link></td><td>{d.category}</td>
              <td>{d.access === "Restricted" ? <span className="badge warn">Restricted</span> : "Normal"}</td>
              <td className="small">{labels.get(d.id)?.label ?? ""}</td>
              <td>{d._count.versions || <span className="badge warn">no file</span>}</td>
              <td>{d.expiryDate && <>{fmtDate(d.expiryDate)}{expiring(d) && <> <span className={`badge ${daysUntil(d.expiryDate) < 0 ? "bad" : "warn"}`}>{daysUntil(d.expiryDate) < 0 ? "Expired" : "Due soon"}</span></>}</>}</td>
            </tr>
          ))}</tbody></table>
      ) : <p className="muted">{needle || category ? "Nothing matches your search." : "No documents yet."}</p>}</div>
    </>
  );
}
