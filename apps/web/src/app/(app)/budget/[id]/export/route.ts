import { NextResponse } from "next/server";
import { budgetRow, defaultAsAt, loadBudgetEngine } from "@/lib/budget-store";
import { withTenant } from "@/lib/db";
import { fmtDate, todayISO } from "@/lib/forms";
import { MIME, download, fileSafe, toDocx, toPdf, toXlsx, type Report } from "@/lib/report-export";
import { can, getTenantContext } from "@/lib/tenant";

const r2 = (n: number) => Math.round(n * 100) / 100;
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = new URL(req.url).searchParams, format = sp.get("format") ?? "xlsx", asParam = sp.get("as_at");
  if (format !== "xlsx" && format !== "pdf" && format !== "docx") return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  const ctx = await getTenantContext();
  if (!can(ctx, "budget")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await withTenant(ctx.org.id, async (tx) => { const b = await tx.budget.findFirst({ where: { id, organizationId: ctx.org.id } }); return b ? { b, eng: await loadBudgetEngine(tx, ctx.org.id) } : null; });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { b, eng } = data, asAt = asParam && /^\d{4}-\d{2}-\d{2}$/.test(asParam) ? asParam : defaultAsAt(eng, b.fyStart);
  const F = eng.budgetFigures(budgetRow(b), asAt);
  const rep: Report = {
    title: `${b.title} - budget and actuals`, demo: ctx.org.isDemo, subtitle: `${ctx.org.name} - ${b.currency} - as at ${fmtDate(asAt)} - ${b.status}`,
    notes: ["Management information. Not a Commission requirement. Actuals come from the financial records in the system."],
    sections: [
      { heading: "By category", columns: ["Category", "Annual budget", "Budget to date", "Actual to date", "Variance"], rows: F.cats.filter((x: { annual: number; ytdA: number }) => x.annual || x.ytdA).map((x: { cat: string; annual: number; ytdB: number; ytdA: number }) => [x.cat, r2(x.annual), r2(x.ytdB), r2(x.ytdA), r2(x.cat === "Revenue" ? x.ytdA - x.ytdB : x.ytdB - x.ytdA)]) },
      { heading: "Monthly budget by category", columns: ["Category", ...F.ms.map((m: { label: string }) => m.label)], rows: F.cats.filter((x: { annual: number }) => x.annual).map((x: { cat: string; months: number[] }) => [x.cat, ...x.months.map(r2)]) },
      { heading: "Month by month (spending)", columns: ["Month", "Budget", "Actual", "Variance"], rows: F.monthly.map((x: { m: { label: string }; budget: number; actual: number; share: number }) => [x.m.label, r2(x.budget), x.share ? r2(x.actual) : "", x.share ? r2(x.budget - x.actual) : ""]) },
    ],
  };
  const body = format === "xlsx" ? await toXlsx(rep) : format === "pdf" ? await toPdf(rep) : await toDocx(rep);
  return download(body, `${ctx.org.isDemo ? "DEMO_" : ""}${fileSafe(b.title)}_${todayISO()}.${format}`, MIME[format]);
}
