import { NextResponse } from "next/server";
import { todayISO } from "@/lib/forms";
import { MIME, download, fileSafe, toDocx, toPdf, toXlsx } from "@/lib/report-export";
import { auditExport, runReport } from "@/lib/reports/store";
import { can, getTenantContext } from "@/lib/tenant";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const p = Object.fromEntries(new URL(req.url).searchParams);
  const format = p.format;
  if (format !== "xlsx" && format !== "pdf" && format !== "docx") return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  const ctx = await getTenantContext();
  if (!can(ctx, "reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let out;
  try { out = await runReport(ctx, code, p); } catch (e) { if ((e as Error).message === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 }); throw e; }
  if (!out) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = format === "xlsx" ? await toXlsx(out.rep) : format === "pdf" ? await toPdf(out.rep) : await toDocx(out.rep);
  await auditExport(ctx, code, format, p);
  return download(body, `${out.rep.demo ? "DEMO_" : ""}${fileSafe(out.title)}_${todayISO()}.${format}`, MIME[format]);
}
