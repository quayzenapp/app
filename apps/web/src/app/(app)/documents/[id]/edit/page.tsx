import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentForm } from "@/components/document-form";
import { withTenant } from "@/lib/db";
import { canRestricted, visibleWhere } from "@/lib/documents";
import { getLookups } from "@/lib/forms";
import { can, requirePermission } from "@/lib/tenant";
import { saveDocument } from "../../actions";

export default async function EditDocument({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("documents");
  if (!can(ctx, "documents", "write")) redirect("/forbidden");
  const d = await withTenant(ctx.org.id, (tx) => tx.document.findFirst({ where: { ...visibleWhere(ctx), id } }));
  if (!d) notFound();
  return (
    <>
      <div className="head"><div className="t"><Link className="link" href={`/documents/${id}`}>← Back</Link><h1>Edit document</h1></div></div>
      <DocumentForm action={saveDocument.bind(null, id, null)} categories={(await getLookups(ctx.org.id)).document_categories ?? []} values={d} allowRestricted={canRestricted(ctx)} />
    </>
  );
}
