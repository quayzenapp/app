import { NextResponse } from "next/server";
import { AR_TEMPLATE, arCompute } from "@/lib/ar/engine";
import { STATUS_LABEL, TEMPLATE_LINES, lineValue, loadCompany, loadStore, toEngine, type Lines } from "@/lib/ar/store";
import { withTenant } from "@/lib/db";
import { fmtDate } from "@/lib/forms";
import { MIME, download, fileSafe, toDocx, toPdf, toXlsx, type Report } from "@/lib/report-export";
import { can, getTenantContext } from "@/lib/tenant";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "xlsx";
  if (format !== "xlsx" && format !== "pdf" && format !== "docx") return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  const ctx = await getTenantContext();
  if (!can(ctx, "returns")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const company = await loadCompany(ctx.org.id);
  const data = await withTenant(ctx.org.id, async (tx) => {
    const r = await tx.annualReturn.findFirst({ where: { id, organizationId: ctx.org.id } });
    if (!r) return null;
    const final = ["Approved", "Submitted"].includes(r.status) && r.snapshotId;
    return { r, snap: final ? await tx.returnSnapshot.findFirst({ where: { id: r.snapshotId!, organizationId: ctx.org.id } }) : null, calc: arCompute(await loadStore(tx, ctx.org.id), toEngine(r), company) };
  });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { r, snap, calc } = data, lines = (snap ? snap.lines : r.lines) as Lines;
  const sections = [...new Set(TEMPLATE_LINES.map((l) => l.section))];
  const rep: Report = {
    title: `Annual return working report - ${r.title}`, demo: company.is_demo,
    subtitle: `${company.name} - Period ${fmtDate(r.periodStart)} to ${fmtDate(r.periodEnd)} - Headcount as at ${fmtDate(r.headcountAsAt)} - Office as at ${fmtDate(r.officeAsAt)} - ${snap ? `Approved snapshot ${snap.versionNo} (fingerprint ${snap.hash.slice(0, 12)})` : `Current working figures (${r.status})`}`,
    notes: [`Template: Annual Return ${AR_TEMPLATE.version} (from '${AR_TEMPLATE.source}').`, `Currency method: ${r.currencyMethod === "split" ? "split by transaction currency (LKR transactions on LKR lines; USD and converted other currencies on USD lines)." : "full totals converted to both USD and LKR."} ${AR_TEMPLATE.note}`, "Use this report to check each figure and, where needed, to type values into the official fillable PDF. The system does not tick the declarations, sign, date or submit the form."],
    sections: sections.map((heading) => ({ heading, columns: ["Ref", "Item", "Value", "Status", "Source", "Explanation", "Worked out from"], rows: TEMPLATE_LINES.filter((l) => l.section === heading).map((l) => { const s = lines[l.key]; return [l.ref ?? "", l.label, s ? lineValue(l, s) : "Not set", s ? STATUS_LABEL[s.status] ?? s.status : "Not set", s?.source ?? "", s?.explanation ?? "", calc[l.key]?.detail.explanation ?? ""]; }) })),
  };
  const body = format === "xlsx" ? await toXlsx(rep) : format === "pdf" ? await toPdf(rep) : await toDocx(rep);
  return download(body, `${company.is_demo ? "DEMO_" : ""}Working_report_${fileSafe(r.title)}.${format}`, MIME[format]);
}
