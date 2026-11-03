import ExcelJS from "exceljs";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type Section = { heading: string; columns?: string[]; rows?: (string | number | null)[][]; text?: string };
export type Report = { title: string; subtitle?: string; demo?: boolean; notes?: string[]; sections: Section[] };
export const MIME = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdf: "application/pdf" } as const;
const DEMO = "DEMO DATA - made-up sample figures, not for submission";
const str = (v: unknown) => (v == null ? "" : String(v));

export async function toXlsx(r: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sum = wb.addWorksheet("Summary");
  sum.addRow([r.title]).font = { bold: true, size: 14 };
  if (r.subtitle) sum.addRow([r.subtitle]);
  if (r.demo) sum.addRow([DEMO]).font = { bold: true, color: { argb: "FF9A3412" } };
  sum.addRow([]);
  for (const n of r.notes ?? []) sum.addRow([n]);
  sum.getColumn(1).width = 120;
  const used = new Set(["summary"]);
  for (const s of r.sections) {
    if (!s.columns) { sum.addRow([]); sum.addRow([s.heading]).font = { bold: true }; if (s.text) sum.addRow([s.text]); continue; }
    let name = s.heading.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Table";
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${name.slice(0, 25)} ${i}`;
    used.add(name.toLowerCase());
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    const head = ws.addRow(s.columns);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } }; });
    (s.rows ?? []).forEach((row) => ws.addRow(row.map((v) => v ?? "")));
    s.columns.forEach((c, i) => { const w = Math.max(c.length, ...(s.rows ?? []).map((x) => str(x[i]).length)); ws.getColumn(i + 1).width = Math.min(60, Math.max(10, w + 2)); ws.getColumn(i + 1).alignment = { wrapText: true, vertical: "top" }; });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function toDocx(r: Report): Promise<Buffer> {
  const kids: (Paragraph | Table)[] = [new Paragraph({ text: r.title, heading: HeadingLevel.TITLE })];
  if (r.subtitle) kids.push(new Paragraph(r.subtitle));
  if (r.demo) kids.push(new Paragraph({ children: [new TextRun({ text: DEMO, bold: true, color: "9A3412" })] }));
  for (const n of r.notes ?? []) kids.push(new Paragraph({ text: n, bullet: { level: 0 } }));
  const cell = (t: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold, size: 16 })], alignment: AlignmentType.LEFT })] });
  for (const s of r.sections) {
    kids.push(new Paragraph({ text: s.heading, heading: HeadingLevel.HEADING_2 }));
    if (s.text) kids.push(new Paragraph(s.text));
    if (s.columns) kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: s.columns.map((c) => cell(c, true)) }), ...(s.rows ?? []).map((x) => new TableRow({ children: x.map((v) => cell(str(v))) }))] }));
  }
  return Packer.toBuffer(new Document({ sections: [{ children: kids }] }));
}

// The built-in PDF fonts cover Western European characters only.
const safe = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/·/g, "-").replace(/\s+/g, " ").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

export async function toPdf(r: Report): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const [font, bold] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);
  const W = 842, H = 595, M = 36;
  let page = doc.addPage([W, H]), y = H - M;
  const ensure = (h: number) => { if (y - h < M) { page = doc.addPage([W, H]); y = H - M; } };
  const wrap = (t: string, f: typeof font, size: number, max: number) => {
    const out: string[] = []; let cur = "";
    for (let word of safe(t).split(" ")) {
      while (f.widthOfTextAtSize(word, size) > max && word.length > 1) { // a long unbroken value must still fit its column
        let n = word.length; while (n > 1 && f.widthOfTextAtSize(word.slice(0, n), size) > max) n--;
        if (cur) { out.push(cur); cur = ""; }
        out.push(word.slice(0, n)); word = word.slice(n);
      }
      const next = cur ? `${cur} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > max) { if (cur) out.push(cur); cur = word; } else cur = next;
    }
    if (cur) out.push(cur);
    return out.length ? out : [""];
  };
  const para = (t: string, size = 9, f = font, color = rgb(0.07, 0.09, 0.15)) => { for (const l of wrap(t, f, size, W - 2 * M)) { ensure(size + 4); page.drawText(l, { x: M, y: y - size, size, font: f, color }); y -= size + 4; } };
  para(r.title, 15, bold); if (r.subtitle) para(r.subtitle, 9);
  if (r.demo) para(DEMO, 10, bold, rgb(0.6, 0.2, 0.07));
  y -= 4; for (const n of r.notes ?? []) para(n, 8, font, rgb(0.42, 0.45, 0.5));
  for (const s of r.sections) {
    y -= 10; ensure(40); para(s.heading, 11, bold);
    if (s.text) para(s.text);
    if (!s.columns) continue;
    const size = 7.5, total = W - 2 * M;
    const weights = s.columns.map((c, i) => Math.max(8, Math.min(60, Math.max(c.length, ...(s.rows ?? []).map((x) => str(x[i]).length)))));
    const sum = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => (w / sum) * total);
    const drawRow = (cells: string[], f: typeof font, shade: boolean) => {
      const wrapped = cells.map((c, i) => wrap(c, f, size, widths[i] - 6));
      const h = Math.max(...wrapped.map((x) => x.length)) * (size + 2) + 5;
      ensure(h);
      if (shade) page.drawRectangle({ x: M, y: y - h, width: total, height: h, color: rgb(0.93, 0.95, 1) });
      let x = M;
      wrapped.forEach((ls, i) => { ls.forEach((l, j) => page.drawText(l, { x: x + 3, y: y - 3 - (j + 1) * (size + 2) + 2, size, font: f, color: rgb(0.07, 0.09, 0.15) })); x += widths[i]; });
      page.drawLine({ start: { x: M, y: y - h }, end: { x: W - M, y: y - h }, thickness: 0.3, color: rgb(0.8, 0.82, 0.86) });
      y -= h;
    };
    drawRow(s.columns, bold, true);
    for (const row of s.rows ?? []) drawRow(row.map(str), font, false);
  }
  return Buffer.from(await doc.save());
}

export const fileSafe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40);
export function download(body: Buffer | Uint8Array, name: string, type: string) {
  return new Response(new Uint8Array(body), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
