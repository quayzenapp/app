import JSZip from "jszip";
import { NextResponse } from "next/server";
import { audit, withTenant } from "@/lib/db";
import { createGen } from "@/lib/lic/gen";
import { S, stripPerson, toEngineApp, toEnginePerson } from "@/lib/lic/store";
import { MIME, download, fileSafe } from "@/lib/report-export";
import { loadReportStore } from "@/lib/reports/store";
import { can, getTenantContext } from "@/lib/tenant";

type Rec = Record<string, unknown>;
type Out = { name: string; blob: Blob; check?: { problems?: string[] } };
const BUILD: Record<string, (G: any, a: Rec) => Promise<Out | Out[]>> = {
  s1: (G, a) => G.buildSchedule1(a), tef: (G, a) => G.buildTef(a), ap_decl: (G, a) => G.buildApDeclaration(a), ubo: (G, a) => G.buildUboDeclarations(a), ds: (G, a) => G.buildDsInfo(a), bprofile: (G, a) => G.buildBusinessProfile(a),
};
const type = (n: string) => (n.endsWith(".pdf") ? MIME.pdf : n.endsWith(".xlsx") ? MIME.xlsx : n.endsWith(".docx") ? MIME.docx : "application/zip");

/** Prepares a form for a person to check. Once approved it uses the fixed copy; before that the file is marked DRAFT. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  const ctx = await getTenantContext();
  if (!can(ctx, "licensing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!BUILD[key]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await withTenant(ctx.org.id, async (tx) => {
    const row = await tx.application.findFirst({ where: { id, organizationId: ctx.org.id } });
    if (!row) return null;
    const base = await loadReportStore(tx, ctx);
    const final = row.snapshotId && ![S.prep, S.ready, S.info].includes(row.status);
    const snap = final ? await tx.applicationSnapshot.findFirst({ where: { id: row.snapshotId!, organizationId: ctx.org.id } }) : null;
    const body = snap?.body as { app: Rec; people: Rec[] } | undefined;
    const people = body?.people ?? (await tx.applicationPerson.findMany({ where: { applicationId: id, organizationId: ctx.org.id }, orderBy: { createdAt: "asc" } })).map(toEnginePerson);
    return { base, a: body?.app ?? toEngineApp(row), people: people.map((p) => stripPerson(p, ctx.sensitive)), final: !!snap };
  });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const store = { ...data.base, list: (t: string) => (t === "app_people" ? data.people : data.base.list(t)) };
  let out: Out[];
  try { const r = await BUILD[key](createGen(store), data.a); out = Array.isArray(r) ? r : [r]; }
  catch (e) { const msg = Array.isArray(e) ? e.join(" ") : (e as Error).message; return new NextResponse(msg, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
  const problems = out.flatMap((f) => f.check?.problems ?? []);
  await withTenant(ctx.org.id, (tx) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "generate", entityType: "apps", entityId: id, summary: `Prepared ${key}${data.final ? " from the approved copy" : " (draft)"}, ${problems.length} problem(s)` }));
  // A form that failed its read-back must never reach someone who might submit it.
  if (problems.length) return new NextResponse(`The form could not be filled correctly, so it was not downloaded:\n\n${problems.join("\n")}`, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const prefix = `${ctx.org.isDemo ? "DEMO_" : ""}${data.final ? "" : "DRAFT_"}`;
  if (out.length === 1) return download(new Uint8Array(await out[0].blob.arrayBuffer()), `${prefix}${out[0].name}`, type(out[0].name));
  const zip = new JSZip();
  for (const f of out) zip.file(`${prefix}${f.name}`, await f.blob.arrayBuffer());
  return download(await zip.generateAsync({ type: "uint8array" }), `${prefix}${fileSafe(key)}_forms.zip`, "application/zip");
}
