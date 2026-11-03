import { NextResponse } from "next/server";
import { audit, withTenant } from "@/lib/db";
import { visibleWhere } from "@/lib/documents";
import { readStored, sha256 } from "@/lib/storage";
import { can, getTenantContext } from "@/lib/tenant";

/** The only way to a file. There are no public links: every download checks the organization, the role and restricted access. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  const ctx = await getTenantContext();
  const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(ctx, "documents")) return notFound();
  const v = await withTenant(ctx.org.id, async (tx) => {
    const d = await tx.document.findFirst({ where: { ...visibleWhere(ctx), id } });
    if (!d) return null;
    const version = await tx.documentVersion.findFirst({ where: { id: versionId, documentId: d.id, organizationId: ctx.org.id } });
    if (version && d.access === "Restricted") await audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "download", entityType: "documents", entityId: d.id, summary: `Downloaded restricted file: ${d.title} v${version.versionNo}` });
    return version;
  });
  if (!v) return notFound();
  let bytes: Buffer;
  try { bytes = await readStored(v.storageKey); } catch { return NextResponse.json({ error: "This file is missing from storage. Please contact your administrator." }, { status: 410 }); }
  if (sha256(bytes) !== v.sha256) return NextResponse.json({ error: "This file failed its integrity check, so it wasn't delivered. Please contact your administrator." }, { status: 500 });
  const ascii = v.filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": v.mime, "Content-Length": String(bytes.length),
    // Always a download, never run or rendered on our origin.
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(v.filename)}`,
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'", "Cache-Control": "private, no-store",
  } });
}
