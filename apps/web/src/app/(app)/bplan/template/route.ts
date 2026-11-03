import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { BP_YEARS, BP_YEAR_FIELDS } from "@/lib/bplan";
import { MIME, download } from "@/lib/report-export";
import { can, getTenantContext } from "@/lib/tenant";

export async function GET() {
  const ctx = await getTenantContext();
  if (!can(ctx, "bplan", "write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Business plan figures");
  ws.columns = [{ width: 46 }, ...Array.from({ length: BP_YEARS }, () => ({ width: 15 }))];
  ws.addRow(["Business plan figures - Quayzen template"]).font = { bold: true, size: 13 };
  ws.addRow(["Copy the figures from the plan as given to the Commission. Leave a box blank if the plan does not give that figure. Keep the item names in column A as they are. Source of funding: Equity, Debt, Equity and Debt, or Other. Evidence: Yes or No."]).font = { italic: true, color: { argb: "FF666666" } };
  ws.addRow(["Item", ...Array.from({ length: BP_YEARS }, (_, i) => `Year ${i + 1}`)]).font = { bold: true };
  BP_YEAR_FIELDS.forEach(([, l]) => ws.addRow([l]));
  ws.addRow([]);
  ws.addRow(["Year 1 starts on (YYYY-MM-DD)"]);
  return download(Buffer.from(await wb.xlsx.writeBuffer()), "Business_plan_figures_template.xlsx", MIME.xlsx);
}
