import { markPdf, type FormState } from "@/lib/form-marks";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFCheckBox, PDFDocument, PDFDropdown, PDFTextField } from "pdf-lib";
import { AR_TEMPLATE, arPdfValues } from "@/lib/ar/engine";
import type { Lines } from "@/lib/ar/store";

export const FORM_PATH = path.join(process.cwd(), "assets/annual-return-2026.pdf");

/** Fills the Commission's own form, then reads it back to check every value. Declarations, signature and date stay blank. */
export async function fillAnnualReturnPdf(lines: Lines, state: FormState = { approved: false, demo: false }) {
  const pdf = await PDFDocument.load(await readFile(FORM_PATH));
  const form = pdf.getForm();
  const { values, checks, manual } = arPdfValues(lines);
  const problems: string[] = [];
  for (const [k, v] of Object.entries(values)) {
    let f;
    try { f = form.getField(k); } catch { problems.push(`${k}: field not found in the form`); continue; }
    try {
      if (f instanceof PDFDropdown) { if (v) f.select(v); else f.clear(); }
      else if (f instanceof PDFTextField) f.setText(v || "");
    } catch { problems.push(`${k}: could not write value '${v}'`); }
  }
  for (const [k, on] of Object.entries(checks)) {
    try { const c = form.getCheckBox(k); if (on) c.check(); else c.uncheck(); } catch { problems.push(`${k}: tick box not found`); }
  }
  form.updateFieldAppearances();
  const out = await markPdf(await pdf.save(), state);

  const back = await PDFDocument.load(out);
  const bf = back.getForm();
  for (const [k, v] of Object.entries(values)) {
    try {
      const f = bf.getField(k);
      const got = f instanceof PDFDropdown ? f.getSelected()[0] ?? "" : f instanceof PDFTextField ? f.getText() ?? "" : "";
      if (got !== (v || "")) problems.push(`${k}: saved '${got}' but expected '${v}'`);
    } catch { /* already reported above */ }
  }
  for (const k of AR_TEMPLATE.neverFill as string[]) {
    try {
      const f = bf.getField(k);
      if (f instanceof PDFCheckBox && f.isChecked()) problems.push(`${k}: declaration should not be ticked`);
      if (f instanceof PDFTextField && f.getText()) problems.push(`${k}: should be blank`);
    } catch { /* not every form version has it */ }
  }
  return { bytes: out, check: { ok: !problems.length, problems, fields: bf.getFields().length, pages: back.getPageCount(), filled: Object.values(values).filter(Boolean).length, ticked: Object.values(checks).filter(Boolean).length, manual } };
}
