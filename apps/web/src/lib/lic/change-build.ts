import { createDateFormatter, parseDateFormats, type DateFormats } from "@/lib/lic/date-formats";
import { assertNoticeDateMapping } from "@/lib/lic/export-checks";
import { assertPersonTables } from "@/lib/lic/person-tables";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createGen } from "@/lib/lic/gen";
import { S3_MAP, S3_CAP, O3_SPEC } from "@/lib/lic/change-spec";
import { L, fullDetails, type ChangeItem, type Rec } from "@/lib/lic/changes";
import type { Out } from "@/lib/lic/build";

/** Notice-of-change branch of buildFiling in lic_filings.js, using the shared read-back filler. */
export async function buildChange(d: Rec, sensitive: string[], formats: DateFormats = parseDateFormats()): Promise<Out[]> {
  if (!fullDetails(sensitive)) throw new Error("The notice cannot be prepared because it contains personal or identity details your role cannot see.");
  // The representative cessation date has no inherited format.
  assertNoticeDateMapping(d, formats);
  assertPersonTables(d.people ?? []);
  const store = { company: () => ({}), list: () => [], get: () => null, canSee: (s: string) => sensitive.includes(s) }, formatDate = createDateFormatter(formats), G = createGen(store, formatDate);
  const items = (d.items ?? []) as ChangeItem[];
  if (!items.length) throw new Error("Add at least one change first.");
  const v: Rec = { Text373: d.licence_no, Text374: d.name, Text472: d.o3?.signer || d.signer }, labels: Rec = {};
  const byCode: Record<string, ChangeItem[]> = {};
  items.forEach((i) => (byCode[i.code] ??= []).push(i));
  for (const [code, list] of Object.entries(byCode)) {
    const map = S3_MAP[code] as (number | null)[][];
    if (S3_CAP(code) === 1 && map.length === 2) {
      const it = list[0];
      for (const [key, j] of [["former", 0], ["new", 1], ["reason", 3]] as const) {
        const text = it[key] || "", lines = text.split(/\n+/).filter(Boolean);
        // A-E provide two boxes for a single change. Preserve all text, joining excess lines into the second box.
        const parts = lines.length > 1 ? [lines[0], lines.slice(1).join("\n")] : [text];
        parts.forEach((s, i) => { const field = `Text${map[i][j]}`; v[field] = s; labels[field] = `Item ${code} - ${key}${i ? " (continued)" : ""}`; });
      }
      if (it.date) v[`Text${map[0][2]}`] = formatDate("s3", `Text${map[0][2]}`, it.date);
    } else list.forEach((it, i) => {
      const row = map[i]; if (!row) throw new Error(`Item ${code}: the official form is full.`);
      for (const [key, j] of [["former", 0], ["new", 1], ["reason", 3]] as const) { const field = `Text${row[j]}`; v[field] = it[key]; labels[field] = `Item ${code} (${i + 1}) - ${key}`; }
      if (it.date) v[`Text${row[2]}`] = formatDate("s3", `Text${row[2]}`, it.date);
    });
  }
  const out: Out[] = [], cont: [string, string][] = [];
  const add = (name: string, r: Rec) => { out.push({ name, blob: new Blob([r.bytes], { type: "application/pdf" }), check: r }); cont.push(...r.cont); };
  add("Schedule_III_Notice_of_change.pdf", await G.fillPdfForm("s3", v, {}, { items: labels, never: ["Text474"] }));
  if (d.offshore) add("Form_III_Offshore_changes.pdf", await G.fillSpecForm("o3", O3_SPEC, d.o3 ?? {}, { never: ["Text92", "Text93", "Text94"] }));
  for (const [index, p] of (d.people ?? []).entries()) for (const part of L.personParts(p, { legal: "" })) {
    const x = { v: { Text1: d.name }, c: {}, items: {}, notes: [] };
    if (part === "III") G.s1Part3(p, x); else G.s1Part45(p, x, part);
    add(`Schedule_I_Part_${part}_${index + 1}.pdf`, await G.fillPdfForm("s1", x.v, x.c, { items: x.items, never: G.S1.never }));
  }
  if (cont.length) out.push({ name: "Notice_of_change_continuation.pdf", blob: await continuation(d.name ?? "", cont) });
  return out;
}
/** Full text from boxes that overflow is kept in a companion sheet. No truncation. */
async function continuation(who: string, entries: [string, string][]) {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]), y = 790;
  const line = (text: string) => { if (y < 50) { page = pdf.addPage([595, 842]); y = 790; } page.drawText(text, { x: 40, y, size: 10, font }); y -= 14; };
  const write = (text: string) => {
    for (const para of text.split("\n")) {
      let current = "";
      for (const ch of para) { if (font.widthOfTextAtSize(current + ch, 10) > 510) { line(current); current = ""; } current += ch; }
      line(current);
    }
  };
  write("Schedule III / offshore Form III - continuation sheet"); write(`Authorised Person: ${who}`);
  for (const [label, text] of entries) { line(""); write(label); write(text); }
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}
