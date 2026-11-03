import { NextResponse } from "next/server";
import { fillAnnualReturnPdf } from "@/lib/ar/pdf";
import { loadCompany, type Lines } from "@/lib/ar/store";
import { audit, withTenant } from "@/lib/db";
import { MIME, download, fileSafe } from "@/lib/report-export";
import { can, getTenantContext } from "@/lib/tenant";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!can(ctx, "returns")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await withTenant(ctx.org.id, async (tx) => {
    const r = await tx.annualReturn.findFirst({ where: { id, organizationId: ctx.org.id } });
    if (!r) return null;
    const final = ["Approved", "Submitted"].includes(r.status) && r.snapshotId;
    const snap = final ? await tx.returnSnapshot.findFirst({ where: { id: r.snapshotId!, organizationId: ctx.org.id } }) : null;
    return { r, snap };
  });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { r, snap } = data, company = await loadCompany(ctx.org.id);
  const { bytes, check } = await fillAnnualReturnPdf((snap ? snap.lines : r.lines) as Lines);
  const name = `${company.is_demo ? "DEMO_" : ""}${snap ? "" : "DRAFT_"}Annual_Return_2026_${fileSafe(company.name)}.pdf`;
  await withTenant(ctx.org.id, (tx) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "pdf", entityType: "returns", entityId: r.id, summary: `${name}: ${check.filled} fields filled, ${check.problems.length} problem(s)` }));
  // A form that failed its read-back must never reach someone who might submit it.
  if (!check.ok) return new NextResponse(`The form could not be filled correctly, so it was not downloaded:\n\n${check.problems.join("\n")}`, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return download(bytes, name, MIME.pdf);
}
