import type { Tx } from "@/lib/db";
import { canSeeField, type Form } from "@/lib/forms";
import { can, type TenantContext } from "@/lib/tenant";

export const RESTRICTED_CATEGORIES = ["UBO declarations", "Passports and IDs", "Visa and permit documents"];
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const canRestricted = (ctx: Pick<TenantContext, "sensitive">) => ctx.sensitive.includes("id") || ctx.sensitive.includes("ubo");
/** Added to every document query. A restricted document simply doesn't exist for other roles. */
export const visibleWhere = (ctx: TenantContext) => ({ organizationId: ctx.org.id, archivedAt: null, ...(canRestricted(ctx) ? {} : { access: "Normal" }) });

const TYPES: Record<string, { mime: string; sig?: (b: Uint8Array) => boolean }> = {
  ".pdf": { mime: "application/pdf", sig: (b) => ascii(b, 0, 5) === "%PDF-" },
  ".png": { mime: "image/png", sig: (b) => b[0] === 0x89 && ascii(b, 1, 4) === "PNG" },
  ".jpg": { mime: "image/jpeg", sig: isJpeg }, ".jpeg": { mime: "image/jpeg", sig: isJpeg },
  ".gif": { mime: "image/gif", sig: (b) => ascii(b, 0, 4) === "GIF8" },
  ".webp": { mime: "image/webp", sig: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP" },
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sig: isZip },
  ".xlsx": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sig: isZip },
  ".csv": { mime: "text/csv" }, ".txt": { mime: "text/plain" }, ".json": { mime: "application/json" },
};
export const ACCEPT = Object.keys(TYPES).join(",");
function ascii(b: Uint8Array, from: number, to: number) { return String.fromCharCode(...b.subarray(from, to)); }
function isJpeg(b: Uint8Array) { return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; }
function isZip(b: Uint8Array) { return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04; }

/** Checks the contents, not just the name: a program renamed to .pdf is refused. Returns a message or the type. */
export function checkFile(name: string, bytes: Uint8Array): { error: string } | { mime: string; filename: string } {
  const filename = (name.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f"]/g, "").trim().slice(0, 200) || "file";
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  const t = TYPES[ext];
  if (!t) return { error: "This file type can't be stored here. Use PDF, Word, Excel, an image, CSV, text or JSON." };
  if (!bytes.length) return { error: "This file is empty." };
  if (bytes.length > MAX_FILE_BYTES) return { error: "Files can be up to 20 MB." };
  const ok = t.sig ? t.sig(bytes) : !bytes.subarray(0, 8192).includes(0);
  if (!ok) return { error: `This file's contents don't match its ${ext} name.` };
  return { mime: t.mime, filename };
}

/** Readable names for linked records, without revealing anything this role can't see. */
export async function linkLabel(tx: Tx, ctx: TenantContext, forms: Form[], linkType: string | null, linkId: string | null) {
  if (!linkType || !linkId) return null;
  if (linkType === "bplans") {
    const v = await tx.businessPlan.findFirst({ where: { id: linkId, organizationId: ctx.org.id } });
    return v ? { label: `Business plan v${v.versionNo}`, href: can(ctx, "bplan") ? `/bplan/${v.id}` : null } : null;
  }
  if (linkType === "apps") {
    const v = await tx.application.findFirst({ where: { id: linkId, organizationId: ctx.org.id } });
    return v ? { label: `Licence application: ${v.title}`, href: can(ctx, "licensing") ? `/apply/${v.id}` : null } : null;
  }
  const form = forms.find((f) => f.key === linkType);
  if (!form) return null;
  const rec = await tx.record.findFirst({ where: { id: linkId, organizationId: ctx.org.id, formKey: linkType } });
  if (!rec) return null;
  const tf = form.fields.find((f) => f.name === form.titleField);
  const visible = can(ctx, form.module) && (!tf || canSeeField(tf, ctx.sensitive));
  return { label: `${form.label}: ${visible ? String((rec.data as Record<string, unknown>)[form.titleField] ?? "record") : "record"}`, href: can(ctx, form.module) ? `/r/${linkType}/${linkId}` : null };
}
