import { markForm } from "@/lib/form-marks";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { audit, withTenant } from "@/lib/db";
import { fmtDate, todayISO } from "@/lib/forms";
import { BUILD, loadGen, type Out } from "@/lib/lic/build";
import { download, fileSafe } from "@/lib/report-export";
import { can, getTenantContext } from "@/lib/tenant";

/** All the forms this role can prepare. A form that can't be prepared, or fails its read-back, is left out and listed. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!can(ctx, "licensing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let g;
  try { g = await loadGen(ctx, id); }
  catch (e) { return new NextResponse((e as Error).message, { status: 422 }); }
  if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const zip = new JSZip(), inc: string[] = [], out: string[] = [];
  for (const [key, build] of Object.entries(BUILD)) {
    try {
      const r = await build(g.G, g.a), files: Out[] = Array.isArray(r) ? r : [r], problems = files.flatMap((f) => f.check?.problems ?? []);
      if (problems.length) { out.push(`${key}: failed its check, so it was left out (${problems[0]})`); continue; }
      const marked = await Promise.all(files.map(f => markForm(f, g.state)));
      for (const f of marked) { zip.file(`${g.prefix}${f.name}`, await f.blob.arrayBuffer()); inc.push(`${g.prefix}${f.name}`); }
    } catch (e) { out.push(`${key}: ${Array.isArray(e) ? e.join(" ") : (e as Error).message}`); }
  }
  const name = String(((g.a as { p1?: { name?: string } }).p1)?.name ?? "application");
  zip.file("READ_ME.txt", [`Application pack - ${name}`, `Prepared by Quayzen on ${fmtDate(todayISO())}${g.final ? ", from the approved copy" : ". DRAFT: not yet approved"}.`, "", "Check every file before anyone signs it. Signatures, dates and declarations are left blank on purpose. Quayzen has not sent anything.", "", "Included:", ...inc.map((n) => `- ${n}`), ...(out.length ? ["", "NOT included:", ...out.map((n) => `- ${n}`)] : [])].join("\r\n"));
  await withTenant(ctx.org.id, (tx) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "generate", entityType: "apps", entityId: id, summary: `Prepared the application pack: ${inc.length} file(s), ${out.length} left out` }));
  return download(await zip.generateAsync({ type: "uint8array" }), `${g.prefix}Application_pack_${fileSafe(name)}_${todayISO()}.zip`, "application/zip");
}
