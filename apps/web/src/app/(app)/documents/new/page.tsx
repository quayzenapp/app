import Link from "next/link";
import { redirect } from "next/navigation";
import { DocumentForm } from "@/components/document-form";
import { canRestricted } from "@/lib/documents";
import { getForms, getLookups } from "@/lib/forms";
import { can, requirePermission } from "@/lib/tenant";
import { saveDocument } from "../actions";

export default async function NewDocument({ searchParams }: { searchParams: Promise<{ type?: string; id?: string }> }) {
  const { type, id } = await searchParams;
  const ctx = await requirePermission("documents");
  if (!can(ctx, "documents", "write")) redirect("/forbidden");
  const lookups = await getLookups(ctx.org.id);
  const form = type ? (type === "bplans" ? { key: "bplans", label: "Business plan" } : (await getForms(ctx.org.id)).find((f) => f.key === type)) : null;
  const link = form && id ? { type: form.key, id } : null;
  return (
    <>
      <div className="head"><div className="t"><Link className="link" href={link ? (link.type === "bplans" ? `/bplan/${link.id}` : `/r/${link.type}/${link.id}`) : "/documents"}>← Back</Link><h1>Add document</h1>{form && <p className="muted">Linked to {form.label.toLowerCase()}</p>}<p className="small muted">You can upload the file after saving.</p></div></div>
      <DocumentForm action={saveDocument.bind(null, null, link)} categories={lookups.document_categories ?? []} allowRestricted={canRestricted(ctx)} />
    </>
  );
}
