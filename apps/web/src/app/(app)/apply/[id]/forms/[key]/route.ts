import JSZip from "jszip";
import { NextResponse } from "next/server";
import { audit, withTenant } from "@/lib/db";
import { BUILD, loadGen, type, type Out } from "@/lib/lic/build";
import { download, fileSafe } from "@/lib/report-export";
import { can, getTenantContext } from "@/lib/tenant";

/** Prepares a form for a person to check. Once approved it uses the fixed copy; before that the file is marked DRAFT. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  const ctx = await getTenantContext();
  if (!can(ctx, "licensing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!BUILD[key]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const g = await loadGen(ctx, id);
  if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let out: Out[];
  try { const r = await BUILD[key](g.G, g.a); out = Array.isArray(r) ? r : [r]; }
  catch (e) { const msg = Array.isArray(e) ? e.join(" ") : (e as Error).message; return new NextResponse(msg, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
  const problems = out.flatMap((f) => f.check?.problems ?? []);
  await withTenant(ctx.org.id, (tx) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "generate", entityType: "apps", entityId: id, summary: `Prepared ${key}${g.final ? " from the approved copy" : " (draft)"}, ${problems.length} problem(s)` }));
  // A form that failed its read-back must never reach someone who might submit it.
  if (problems.length) return new NextResponse(`The form could not be filled correctly, so it was not downloaded:\n\n${problems.join("\n")}`, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (out.length === 1) return download(new Uint8Array(await out[0].blob.arrayBuffer()), `${g.prefix}${out[0].name}`, type(out[0].name));
  const zip = new JSZip();
  for (const f of out) zip.file(`${g.prefix}${f.name}`, await f.blob.arrayBuffer());
  return download(await zip.generateAsync({ type: "uint8array" }), `${g.prefix}${fileSafe(key)}_forms.zip`, "application/zip");
}
