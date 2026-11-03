"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, withTenant } from "@/lib/db";
import { RESTRICTED_CATEGORIES, canRestricted, checkFile, visibleWhere } from "@/lib/documents";
import { getForms, getLookups } from "@/lib/forms";
import { deleteStored, saveFile, sha256 } from "@/lib/storage";
import { can, getTenantContext } from "@/lib/tenant";

export type State = { error?: string; ok?: string };
const writer = async () => {
  const ctx = await getTenantContext();
  if (!can(ctx, "documents", "write")) redirect("/forbidden");
  return ctx;
};

export async function saveDocument(id: string | null, link: { type: string; id: string } | null, _s: State, f: FormData): Promise<State> {
  const ctx = await writer();
  const g = (k: string) => String(f.get(k) ?? "").trim();
  const title = g("title").slice(0, 300), category = g("category"), expiry = g("expiry_date"), notes = g("notes").slice(0, 5000);
  if (!title) return { error: "Document title is required." };
  if (!(await getLookups(ctx.org.id)).document_categories?.includes(category)) return { error: "Please choose a category." };
  if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return { error: "Expiry date: use the date format YYYY-MM-DD." };
  const access = RESTRICTED_CATEGORIES.includes(category) || g("access") === "Restricted" ? "Restricted" : "Normal";
  if (access === "Restricted" && !canRestricted(ctx)) return { error: "Your role cannot add restricted documents." };
  const data = { title, category, access, expiryDate: expiry || null, notes: notes || null };
  let saved: string;
  try {
    saved = await withTenant(ctx.org.id, async (tx) => {
      if (id) {
        const r = await tx.document.updateMany({ where: { ...visibleWhere(ctx), id }, data });
        if (!r.count) throw new Error("This document no longer exists.");
      } else if (link?.type === "bplans") {
        if (!(await tx.businessPlan.findFirst({ where: { id: link.id, organizationId: ctx.org.id } }))) throw new Error("The linked plan wasn't found.");
      } else if (link) {
        // The link must point at a record of this organization, in a form that exists.
        const form = (await getForms(ctx.org.id)).find((x) => x.key === link.type);
        if (!form || !(await tx.record.findFirst({ where: { id: link.id, organizationId: ctx.org.id, formKey: link.type } }))) throw new Error("The linked record wasn't found.");
      }
      const docId = id ?? (await tx.document.create({ data: { ...data, organizationId: ctx.org.id, createdById: ctx.user.id, linkType: link?.type ?? null, linkId: link?.id ?? null } })).id;
      await audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: id ? "update" : "create", entityType: "documents", entityId: docId, summary: `${id ? "Updated" : "Added"} document: ${title}` });
      return docId;
    });
  } catch (e) { return { error: (e as Error).message }; }
  redirect(`/documents/${saved}`);
}

export async function uploadVersion(id: string, _s: State, f: FormData): Promise<State> {
  const ctx = await writer();
  const file = f.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Please choose a file." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkFile(file.name, bytes);
  if ("error" in checked) return { error: checked.error };
  const note = String(f.get("note") ?? "").trim().slice(0, 500) || null;
  const key = await saveFile(ctx.org.id, bytes);
  try {
    const n = await withTenant(ctx.org.id, async (tx) => {
      const d = await tx.document.findFirst({ where: { ...visibleWhere(ctx), id } });
      if (!d) throw new Error("This document no longer exists.");
      const versionNo = (await tx.documentVersion.count({ where: { organizationId: ctx.org.id, documentId: d.id } })) + 1;
      await tx.documentVersion.create({ data: { organizationId: ctx.org.id, documentId: d.id, versionNo, filename: checked.filename, size: bytes.length, mime: checked.mime, sha256: sha256(bytes), storageKey: key, note, uploadedById: ctx.user.id, uploadedByName: ctx.user.name } });
      await tx.document.update({ where: { id: d.id }, data: { updatedAt: new Date() } });
      await audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "upload", entityType: "documents", entityId: d.id, summary: `${d.title}: version ${versionNo} (${checked.filename})` });
      return versionNo;
    });
    revalidatePath(`/documents/${id}`);
    return { ok: `Version ${n} uploaded.` };
  } catch (e) {
    await deleteStored(key).catch(() => {}); // nothing recorded, so don't keep the file
    const dup = (e as { code?: string }).code === "P2002";
    return { error: dup ? "Someone else uploaded a version at the same moment. Please try again." : (e as Error).message };
  }
}

/** Archiving hides a document but keeps its files and history. */
export async function archiveDocument(id: string) {
  const ctx = await writer();
  await withTenant(ctx.org.id, async (tx) => {
    const d = await tx.document.findFirst({ where: { ...visibleWhere(ctx), id } });
    if (!d) return;
    await tx.document.update({ where: { id: d.id }, data: { archivedAt: new Date() } });
    await audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "archive", entityType: "documents", entityId: d.id, summary: `Archived document: ${d.title}` });
  });
  redirect("/documents");
}
