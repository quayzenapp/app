import { assertChangeVisible } from "@/lib/lic/export-checks";
import JSZip from "jszip";
import { audit, withTenant } from "@/lib/db";
import { can, getTenantContext } from "@/lib/tenant";
import { stripChange, type Rec } from "@/lib/lic/changes";
import { buildChange } from "@/lib/lic/change-build";
import { download } from "@/lib/report-export";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext(), { id } = await params;
  if (!can(ctx, "licensing")) return new Response("Forbidden", { status: 403 });
  try {
    const result = await withTenant(ctx.org.id, async (tx) => {
      const row = await tx.licenceFiling.findFirst({ where: { id, organizationId: ctx.org.id } });
      if (!row) return null;
      const final = row.snapshotId && !["Draft", "Ready for review"].includes(row.status);
      const snap = final ? await tx.filingSnapshot.findFirst({ where: { id: row.snapshotId!, filingId: id, organizationId: ctx.org.id } }) : null;
      if (final && !snap) throw new Error("The approved copy is missing.");
      const raw = (snap?.body ?? row.data) as Rec;
      assertChangeVisible(raw, ctx.sensitive);
      return { d: stripChange(raw, ctx.sensitive), final: !!snap };
    });
    if (!result) return new Response("Not found", { status: 404 });
    const out = await buildChange(result.d, ctx.sensitive), problems = out.flatMap((f) => f.check?.problems ?? []);
    await withTenant(ctx.org.id, (tx) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "export", entityType: "filings", entityId: id, summary: `Prepared notice forms${result.final ? " from approved copy" : " (draft)"}; ${problems.length} read-back problem(s)` }));
    if (problems.length) return new Response(`The forms failed their read-back and were not downloaded.\n${problems.join("\n")}`, { status: 422 });
    const prefix = `${ctx.org.isDemo ? "DEMO_" : ""}${result.final ? "" : "DRAFT_"}`, zip = new JSZip();
    for (const f of out) zip.file(prefix + f.name, await f.blob.arrayBuffer());
    zip.file("READ_ME.txt", `${result.final ? "Approved fixed copy" : "DRAFT - not approved"}\nCheck every value against the supporting evidence. Signatures and signature dates are blank. Quayzen has not submitted anything.\nNot reviewed by a compliance professional.\n`);
    return download(await zip.generateAsync({ type: "uint8array" }), `${prefix}Notice_of_change.zip`, "application/zip");
  } catch (e) { return new Response((e as Error).message, { status: 422 }); }
}
