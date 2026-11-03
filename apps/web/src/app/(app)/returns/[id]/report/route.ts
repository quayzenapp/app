import { NextResponse } from "next/server";
import { todayISO } from "@/lib/forms";
import { MIME, download, fileSafe, toDocx, toPdf, toXlsx } from "@/lib/report-export";
import { auditExport, runReport } from "@/lib/reports/store";
import { can, getTenantContext } from "@/lib/tenant";
import { withTenant } from "@/lib/db";

/** The working report of one return: from its approved snapshot once approved, otherwise current figures. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "xlsx";
  if (format !== "xlsx" && format !== "pdf" && format !== "docx") return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  const ctx = await getTenantContext();
  if (!can(ctx, "returns")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const r = await withTenant(ctx.org.id, (tx) => tx.annualReturn.findFirst({ where: { id, organizationId: ctx.org.id } }));
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const snap = ["Approved", "Submitted"].includes(r.status) && r.snapshotId ? r.snapshotId : undefined;
  const out = await runReport(ctx, "annual_return", { rid: r.id, snap });
  const body = format === "xlsx" ? await toXlsx(out!.rep) : format === "pdf" ? await toPdf(out!.rep) : await toDocx(out!.rep);
  await auditExport(ctx, "annual_return", format, {});
  return download(body, `${out!.rep.demo ? "DEMO_" : ""}Working_report_${fileSafe(r.title)}_${todayISO()}.${format}`, MIME[format]);
}
