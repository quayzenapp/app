import { NextResponse } from "next/server";
import { BP_SECTIONS, BP_YEAR_FIELDS } from "@/lib/bplan";
import { withTenant } from "@/lib/db";
import { fmtDate } from "@/lib/forms";
import { MIME, download, toDocx, toPdf, toXlsx, type Report } from "@/lib/report-export";
import { sezDeep } from "@/lib/sections";
import { can, getTenantContext } from "@/lib/tenant";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "xlsx";
  if (format !== "xlsx" && format !== "pdf" && format !== "docx") return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  const ctx = await getTenantContext();
  if (!can(ctx, "bplan")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const v = await withTenant(ctx.org.id, (tx) => tx.businessPlan.findFirst({ where: { id, organizationId: ctx.org.id } }));
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const years = v.years as Record<string, string | number | null>[], ms = v.milestones as Record<string, string | null>[], sections = v.sections as Record<string, string>;
  const rep: Report = sezDeep({
    title: `${v.title} (version ${v.versionNo})`, demo: ctx.org.isDemo,
    subtitle: `${ctx.org.name} - ${v.commissionStatus ?? ""}${v.commissionDate ? ` on ${fmtDate(v.commissionDate)}` : ""} - ${v.status}${v.hash ? ` - fingerprint ${v.hash.slice(0, 16)}` : ""}`,
    notes: ["Figures recorded from the business plan given to the Commission. They are projections, not commitments, unless a licence, approval or agreement says otherwise."],
    sections: [
      { heading: "Year-by-year projections", columns: ["Item", ...years.map((_, i) => `Year ${i + 1}`)], rows: BP_YEAR_FIELDS.map(([k, l]) => [l, ...years.map((y) => y[k] ?? "")]) },
      { heading: "Milestones", columns: ["Milestone", "Target date", "Actual status", "Actual date"], rows: ms.map((m) => [m.milestone, m.target_date, m.actual_status, m.actual_date]) },
      ...BP_SECTIONS.filter(([k]) => sections[k]).map(([k, l]) => ({ heading: l, text: sections[k] })),
    ],
  });
  const body = format === "xlsx" ? await toXlsx(rep) : format === "pdf" ? await toPdf(rep) : await toDocx(rep);
  return download(body, `${ctx.org.isDemo ? "DEMO_" : ""}Business_plan_reference_v${v.versionNo}.${format}`, MIME[format]);
}
