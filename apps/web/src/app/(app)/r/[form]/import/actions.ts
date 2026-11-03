"use server";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { audit, withTenant } from "@/lib/db";
import { buildRecord, canSeeField, getForm, getForms, getLookups, loadRefOptions } from "@/lib/forms";
import { can, getTenantContext } from "@/lib/tenant";
import type { Prisma } from "@/generated/prisma/client";

export type ImportState = { error?: string; errors?: string[]; ok?: string };
const MAX_BYTES = 5 * 1024 * 1024, MAX_ROWS = 5000;

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue);
    if ("text" in v) return v.text;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    return null;
  }
  return v;
}

/** All or nothing: if any row has a problem, nothing is saved and every problem is listed. */
export async function importRecords(key: string, _s: ImportState, f: FormData): Promise<ImportState> {
  const ctx = await getTenantContext(), orgId = ctx.org.id;
  const form = await getForm(orgId, key);
  if (!form?.importable) return { error: "This form can't be imported." };
  if (!can(ctx, form.module, "write")) return { error: "Your role can view this section but not change it." };
  const file = f.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Please choose an Excel file." };
  if (file.size > MAX_BYTES) return { error: "Files can be up to 5 MB." };
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); } catch { return { error: "This file couldn't be read. Please use an Excel .xlsx file." }; }
  const fields = form.fields.filter((x) => canSeeField(x, ctx.sensitive) && !x.readonly);
  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const byLabel = new Map(fields.flatMap((x) => [[norm(x.label), x] as const, [norm(x.name), x] as const]));
  // The header row may be on any sheet: use the first one with a recognised heading.
  const ws = wb.worksheets.find((s) => { const r = s.getRow(1).values as unknown[]; return Array.isArray(r) && r.some((v) => byLabel.has(norm(cellValue(v as ExcelJS.CellValue)))); });
  if (!ws) return { error: "No recognised column headings were found in the first row. Download the template to see them." };
  if (ws.rowCount - 1 > MAX_ROWS) return { error: `Up to ${MAX_ROWS} rows can be imported at once.` };
  const cols = new Map<number, (typeof fields)[number]>();
  ws.getRow(1).eachCell((c, i) => { const x = byLabel.get(norm(cellValue(c.value))); if (x) cols.set(i, x); });
  const [forms, lookups] = await Promise.all([getForms(orgId), getLookups(orgId)]);
  const errors: string[] = [];
  try {
    const n = await withTenant(orgId, async (tx) => {
      const refs = await loadRefOptions(tx, orgId, forms, form, ctx.sensitive);
      const built: Prisma.InputJsonValue[] = [];
      ws.eachRow((row, num) => {
        if (num === 1) return;
        const raw: Record<string, unknown> = {};
        for (const x of fields) if (x.dflt !== undefined) raw[x.name] = x.dflt;
        let any = false;
        for (const [i, x] of cols) {
          let v = cellValue(row.getCell(i).value);
          if (v == null || v === "") continue;
          any = true;
          if (x.type === "ref") { const m = refs[x.name]?.find((o) => norm(o.label) === norm(v)); if (!m) { errors.push(`Row ${num}: ${x.label}: '${v}' was not found.`); continue; } v = m.value; }
          raw[x.name] = v;
        }
        if (!any) return;
        try { built.push(buildRecord(form, raw, null, ctx.sensitive, lookups).rec as Prisma.InputJsonValue); }
        catch (e) { for (const m of Array.isArray(e) ? e : [String(e)]) errors.push(`Row ${num}: ${m}`); }
      });
      if (errors.length) throw new Error("rows");
      if (!built.length) { errors.push("No data rows were found."); throw new Error("rows"); }
      await tx.record.createMany({ data: built.map((data) => ({ organizationId: orgId, formKey: key, data, reviewStatus: form.reviewable ? "Pending" : null, createdById: ctx.user.id, updatedById: ctx.user.id })) });
      await audit(tx, { organizationId: orgId, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "import", entityType: key, summary: `Imported ${built.length} ${form.plural} from ${file.name}` });
      return built.length;
    });
    revalidatePath(`/r/${key}`);
    return { ok: `${n} record(s) imported.` };
  } catch (e) {
    if (errors.length) return { errors: errors.slice(0, 50), error: `Nothing was imported. Fix ${errors.length} problem(s) and try again.` };
    throw e;
  }
}
