/* ===== exports.js ===== */
/* Report exports. One report object, three well-formatted outputs:
   Excel (ExcelJS: a summary sheet plus one formatted sheet per table), PDF (jsPDF + AutoTable) and Word (docx).
   Report shape: {title, subtitle, demo, notes[], sections:[{heading, text, columns, rows}]} */


const BRAND = { navy: "0B282F", teal: "0A5C62", tealLight: "E0F0F0", ink: "11232A", muted: "56686F", line: "D9E3E6", zebra: "F3F7F8", amber: "FFF2D4", amberInk: "8A5400" };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/* Dates inside report text are shown as "1 Apr 2025" */
const fixDates = t => String(t ?? "").replace(/\b(\d{4}-\d{2}-\d{2})(?![\d-])/g, m => fmtDate(m));
const cellText = v => v == null ? "" : (typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString("en-US") : fmtMoney(v)) : fixDates(v));
/* Which columns hold numbers only: those are right-aligned and given number formats */
function numericCols(s) { return (s.columns || []).map((_, i) => { const vals = (s.rows || []).map(r => r[i]).filter(v => v != null && v !== ""); return vals.length > 0 && vals.every(v => typeof v === "number"); }); }
/* Relative column widths from the longest text in each column */
function colWeights(s) {
  return (s.columns || []).map((c, i) => { const lens = [String(c).length * 0.9, ...(s.rows || []).slice(0, 200).map(r => cellText(r[i]).length)]; const m = Math.max(...lens); return Math.min(42, Math.max(7, m)); });
}
/* Column widths that never break a number or a heading word: numbers and short columns get what they need, long text shares the rest. */
function colWidths(s, avail, charW, pad) {
  const nc = numericCols(s), word = c => Math.max(...String(c).split(/\s+/).map(w => w.length));
  const need = s.columns.map((c, i) => { const lens = (s.rows || []).slice(0, 300).map(r => cellText(r[i]).length), maxLen = Math.max(0, ...lens);
    const minW = Math.max(word(c), nc[i] ? maxLen : Math.min(maxLen, 12), 3) * charW + pad, want = Math.max(minW, Math.min(Math.max(maxLen, String(c).length * 0.8), 70) * charW + pad); return { minW, want }; });
  const total = need.reduce((a, n) => a + n.want, 0), minT = need.reduce((a, n) => a + n.minW, 0);
  if (total <= avail) return need.map(n => n.want * avail / total);
  if (minT >= avail) return need.map(n => n.minW * avail / minT);
  const k = (avail - minT) / (total - minT); return need.map(n => n.minW + (n.want - n.minW) * k);
}
const reportName = rep => (rep.title || "Report").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
const company = () => (Store.company() || {}).name || "";
const subLine = rep => { const c = company(), s = rep.subtitle || ""; return !c ? s : s.startsWith(c) ? s : [c, s].filter(Boolean).join(" · "); };
const isWide = rep => rep.sections.some(s => (s.columns || []).length > 6);

/* ---------- Excel ---------- */
async function reportXlsx(rep) {
  const ExcelJS = await libs.exceljs();
  const wb = new ExcelJS.Workbook(); wb.creator = "Quayzen"; wb.created = new Date();
  const argb = h => "FF" + h, thin = { style: "thin", color: { argb: argb(BRAND.line) } }, box = { top: thin, left: thin, bottom: thin, right: thin };
  const sum = wb.addWorksheet("Summary", { properties: { tabColor: { argb: argb(BRAND.teal) } }, views: [{ showGridLines: false }] });
  sum.getColumn(1).width = 3; sum.getColumn(2).width = 120;
  let r = 2;
  const put = (text, font, fill, h) => { const row = sum.getRow(r++), c = row.getCell(2); c.value = text; c.font = Object.assign({ name: "Calibri", size: 11, color: { argb: argb(BRAND.ink) } }, font || {}); c.alignment = { wrapText: true, vertical: "top" };
    if (fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(fill) } };
    const t = typeof text === "string" ? text : (text && text.text) || "", sz = (font && font.size) || 11; row.height = h || Math.max(sz * 1.45, Math.ceil(t.length / (125 * 11 / sz)) * sz * 1.4 + (t.split("\n").length - 1) * sz * 1.3); return c; };
  put("BFM ZONE  ·  PORT CITY COMPLIANCE", { size: 9, bold: true, color: { argb: argb(BRAND.teal) } });
  put(rep.title, { size: 18, bold: true }, null, 28);
  put(fixDates(subLine(rep)), { size: 11, color: { argb: argb(BRAND.muted) } });
  put("Generated " + fmtDate(today()) + " from Quayzen. Working report, not an official Commission document.", { size: 9, italic: true, color: { argb: argb(BRAND.muted) } });
  if (rep.demo) put("DEMO DATA - made-up sample figures, not for submission", { bold: true, color: { argb: argb(BRAND.amberInk) } }, BRAND.amber, 20);
  r++;
  if ((rep.notes || []).length) { put("Notes", { bold: true, size: 12, color: { argb: argb(BRAND.teal) } }); rep.notes.forEach(n => { n = fixDates(n); put("•  " + n, { size: 10 }); }); r++; }
  const used = new Set(["Summary"]), sheetName = h => { let n = fixDates(h || "Table").replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim(); if (n.length > 28) { n = n.slice(0, 28); const sp = n.lastIndexOf(" "); if (sp > 14) n = n.slice(0, sp); } n = n || "Table"; let k = n, i = 2; while (used.has(k.toLowerCase())) k = n.slice(0, 26) + " " + i++; used.add(k.toLowerCase()); return k; };
  const tables = rep.sections.filter(s => s.columns), texts = rep.sections.filter(s => !s.columns && (s.text || s.heading));
  if (tables.length) {
    put("Contents", { bold: true, size: 12, color: { argb: argb(BRAND.teal) } });
    tables.forEach(s => { s._sheet = sheetName(s.heading || rep.title); const c = put({ text: fixDates(s.heading || s._sheet) + `  (${(s.rows || []).length} row${(s.rows || []).length === 1 ? "" : "s"})`, hyperlink: `#'${s._sheet}'!A1` }, { color: { argb: argb("1C5EA6") }, underline: true }); });
    r++;
  }
  texts.forEach(s => { if (s.heading) put(fixDates(s.heading), { bold: true, size: 12, color: { argb: argb(BRAND.teal) } }); if (s.text) put(fixDates(s.text), { size: 10 }); r++; });
  for (const s of tables) {
    const nc = numericCols(s), ws = wb.addWorksheet(s._sheet, { views: [{ state: "frozen", ySplit: 4, showGridLines: false }], pageSetup: { orientation: s.columns.length > 6 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    ws.getCell("A1").value = fixDates(s.heading || rep.title); ws.getCell("A1").font = { name: "Calibri", size: 14, bold: true, color: { argb: argb(BRAND.ink) } };
    ws.getCell("A2").value = `${rep.title} · ${company()}${rep.demo ? " · DEMO DATA" : ""}`; ws.getCell("A2").font = { name: "Calibri", size: 9, color: { argb: argb(rep.demo ? BRAND.amberInk : BRAND.muted) } };
    const hr = ws.getRow(4); s.columns.forEach((c, i) => { const cell = hr.getCell(i + 1); cell.value = c; cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(BRAND.teal) } }; cell.alignment = { vertical: "middle", wrapText: true, horizontal: nc[i] ? "right" : "left" }; cell.border = box; });
    hr.height = 30;
    const rows = (s.rows || []).length ? s.rows : [[ "None recorded." ]];
    rows.forEach((row, ri) => {
      const xr = ws.getRow(5 + ri);
      s.columns.forEach((_, i) => {
        const v = row[i], cell = xr.getCell(i + 1);
        if (typeof v === "number") { cell.value = v; cell.numFmt = Number.isInteger(v) && (s.rows || []).every(rr => rr[i] == null || rr[i] === "" || Number.isInteger(rr[i])) ? "#,##0" : "#,##0.00"; }
        else if (typeof v === "string" && ISO_DATE.test(v)) { cell.value = new Date(v + "T00:00:00Z"); cell.numFmt = "d mmm yyyy"; }
        else cell.value = v == null ? "" : String(v);
        cell.font = { name: "Calibri", size: 10, color: { argb: argb(BRAND.ink) }, italic: !(s.rows || []).length };
        cell.alignment = { vertical: "top", wrapText: true, horizontal: nc[i] || typeof v === "number" ? "right" : "left" };
        cell.border = box; if (ri % 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(BRAND.zebra) } };
      });
    });
    const nc2 = numericCols(s); s.columns.forEach((c, i) => { const ml = Math.max(0, ...(s.rows || []).slice(0, 300).map(r => cellText(r[i]).length)), hw = Math.max(...String(c).split(/\s+/).map(w => w.length));
      ws.getColumn(i + 1).width = Math.max(10, Math.min(60, Math.max(hw, nc2[i] ? ml : Math.min(ml, 55)) + 3)); });
    if ((s.rows || []).length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: s.columns.length } };
  }
  return new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ---------- PDF ---------- */
/* The built-in PDF fonts cover Western European characters only, so a few symbols are swapped for plain ones. */
function pdfSafe(t) {
  return fixDates(t).replace(/[→➔]/g, "->").replace(/[−‐‑]/g, "-").replace(/✓/g, "Yes").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/×/g, "x").replace(/÷/g, "/")
    .replace(/[^\u0000-ÿ–—‘’“”•…€]/g, "");
}
async function reportPdf(rep) {
  const jsPDF = await libs.jspdf(); await libs.autotable();
  const doc = new jsPDF({ orientation: isWide(rep) ? "landscape" : "portrait", unit: "pt", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40, rgb = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  doc.setProperties({ title: pdfSafe(rep.title), subject: pdfSafe(rep.subtitle || ""), creator: "Quayzen" });
  // header band on the first page
  doc.setFont("helvetica", "bold"); doc.setFontSize(17); const tl = doc.splitTextToSize(pdfSafe(rep.title), W - 2 * M - (rep.demo ? 110 : 0)).slice(0, 3);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); const sl = doc.splitTextToSize(pdfSafe(subLine(rep)), W - 2 * M).slice(0, 2);
  const band = 58 + tl.length * 21 + sl.length * 12;
  doc.setFillColor(...rgb(BRAND.navy)); doc.rect(0, 0, W, band, "F");
  doc.setTextColor(140, 200, 198); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("BFM ZONE  ·  PORT CITY COMPLIANCE", M, 28, { charSpace: 0.6 });
  doc.setTextColor(255); doc.setFontSize(17); doc.text(tl, M, 52, { lineHeightFactor: 1.2 });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(200, 220, 222); doc.text(sl, M, 52 + tl.length * 21 + 2, { lineHeightFactor: 1.3 });
  if (rep.demo) { doc.setFillColor(...rgb(BRAND.amber)); doc.roundedRect(W - M - 100, 20, 100, 20, 10, 10, "F"); doc.setTextColor(...rgb(BRAND.amberInk)); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("DEMO DATA", W - M - 50, 33, { align: "center" }); }
  let y = band + 24;
  const newPageIfNeeded = h => { if (y + h > H - 56) { doc.addPage(); y = 56; } };
  if ((rep.notes || []).length) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    const lines = rep.notes.flatMap(n => doc.splitTextToSize("•  " + pdfSafe(n), W - 2 * M - 24)); const h = lines.length * 11 + 16;
    newPageIfNeeded(h); doc.setFillColor(...rgb(BRAND.zebra)); doc.setDrawColor(...rgb(BRAND.line)); doc.roundedRect(M, y, W - 2 * M, h, 6, 6, "FD");
    doc.setTextColor(...rgb(BRAND.muted)); doc.text(lines, M + 12, y + 14); y += h + 18;
  }
  for (const s of rep.sections) {
    if (s.heading) { newPageIfNeeded(s.columns ? 60 : 30); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...rgb(BRAND.teal)); const hl = doc.splitTextToSize(pdfSafe(s.heading), W - 2 * M); doc.text(hl, M, y); y += hl.length * 14; doc.setDrawColor(...rgb(BRAND.line)); doc.setLineWidth(0.8); doc.line(M, y - 6, W - M, y - 6); y += 6; }
    if (s.text) { doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...rgb(BRAND.ink)); for (const line of doc.splitTextToSize(pdfSafe(s.text), W - 2 * M)) { newPageIfNeeded(13); doc.text(line, M, y); y += 13; } y += 6; }
    if (s.columns) {
      const nc = numericCols(s), fsz = s.columns.length > 8 ? 7 : 8, cw = colWidths(s, W - 2 * M, fsz * 0.5, 11);
      const columnStyles = {}; s.columns.forEach((_, i) => { columnStyles[i] = { halign: nc[i] ? "right" : "left", cellWidth: cw[i] }; });
      const body = (s.rows || []).length ? s.rows.map(r => s.columns.map((_, i) => pdfSafe(cellText(r[i])))) : [[{ content: "None recorded.", colSpan: s.columns.length, styles: { fontStyle: "italic", textColor: rgb(BRAND.muted) } }]];
      doc.autoTable({ startY: y, head: [s.columns.map(pdfSafe)], body, theme: "grid", margin: { left: M, right: M, top: 56, bottom: 60 }, columnStyles, rowPageBreak: "avoid",
        styles: { font: "helvetica", fontSize: fsz, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, textColor: rgb(BRAND.ink), lineColor: rgb(BRAND.line), lineWidth: 0.5, overflow: "linebreak", valign: "top" },
        headStyles: { fillColor: rgb(BRAND.teal), textColor: 255, fontStyle: "bold", lineColor: rgb(BRAND.teal), valign: "middle" },
        alternateRowStyles: { fillColor: rgb(BRAND.zebra) },
        didParseCell: d => { if (d.section === "head") d.cell.styles.halign = nc[d.column.index] ? "right" : "left"; else if (s.rows && s.rows[d.row.index] && typeof s.rows[d.row.index][d.column.index] === "number") d.cell.styles.halign = "right"; } });
      y = doc.lastAutoTable.finalY + 22;
    }
  }
  const n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setDrawColor(...rgb(BRAND.line)); doc.setLineWidth(0.5); doc.line(M, H - 42, W - M, H - 42);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...rgb(BRAND.muted));
    doc.text(doc.splitTextToSize(pdfSafe(`Quayzen  ·  ${rep.title}`), W - 2 * M - 70)[0], M, H - 29);
    doc.text(`Page ${i} of ${n}`, W - M, H - 29, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.text(`Generated ${fmtDate(today())}. Working report, not an official Commission document.`, M, H - 19);
    if (i > 1) { doc.setFontSize(7.5); doc.text(pdfSafe(rep.title).slice(0, 110), M, 30); if (rep.demo) { doc.setTextColor(...rgb(BRAND.amberInk)); doc.text("DEMO DATA", W - M, 30, { align: "right" }); } }
  }
  return doc.output("blob");
}

/* ---------- Word ---------- */
async function reportDocx(rep) {
  const D = await libs.docx(), wide = isWide(rep);
  const pageW = wide ? 16838 : 11906, margin = 900, usable = pageW - 2 * margin;
  const run = (text, o = {}) => new D.TextRun(Object.assign({ text: fixDates(text), font: "Calibri" }, o));
  const ch = [];
  ch.push(new D.Paragraph({ spacing: { after: 60 }, children: [run("BFM ZONE  ·  PORT CITY COMPLIANCE", { size: 16, bold: true, color: BRAND.teal, characterSpacing: 20 })] }));
  ch.push(new D.Paragraph({ heading: D.HeadingLevel.TITLE, spacing: { after: 80 }, children: [run(rep.title, { size: 40, bold: true, color: BRAND.ink })] }));
  ch.push(new D.Paragraph({ spacing: { after: 60 }, children: [run(subLine(rep), { size: 20, color: BRAND.muted })] }));
  ch.push(new D.Paragraph({ spacing: { after: 200 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 8, color: BRAND.teal, space: 6 } }, children: [run(`Generated ${fmtDate(today())} from Quayzen. Working report, not an official Commission document. Not signed.`, { size: 16, italics: true, color: BRAND.muted })] }));
  if (rep.demo) ch.push(new D.Paragraph({ shading: { type: D.ShadingType.CLEAR, fill: BRAND.amber, color: "auto" }, spacing: { after: 200 }, children: [run("DEMO DATA - made-up sample figures, not for submission", { bold: true, color: BRAND.amberInk, size: 18 })] }));
  (rep.notes || []).forEach((n, i, a) => ch.push(new D.Paragraph({ shading: { type: D.ShadingType.CLEAR, fill: BRAND.zebra, color: "auto" }, spacing: { after: i === a.length - 1 ? 200 : 0 }, indent: { left: 120, right: 120 }, children: [run("•  " + n, { size: 17, color: BRAND.muted })] })));
  const border = { style: D.BorderStyle.SINGLE, size: 4, color: BRAND.line }, borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
  for (const s of rep.sections) {
    if (s.heading) ch.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_2, spacing: { before: 280, after: 100 }, keepNext: true, children: [run(s.heading, { size: 24, bold: true, color: BRAND.teal })] }));
    if (s.text) String(s.text).split(/\n\s*\n/).forEach(p => ch.push(new D.Paragraph({ spacing: { after: 120 }, children: String(p).split("\n").flatMap((l, i) => i ? [new D.TextRun({ break: 1 }), run(l, { size: 20 })] : [run(l, { size: 20 })]) })));
    if (s.columns) {
      const nc = numericCols(s), fs = s.columns.length > 8 ? 14 : 16, widths = colWidths(s, usable, fs * 5.6, 200).map(Math.round);
      const cell = (v, i, head, zebra) => new D.TableCell({ width: { size: widths[i], type: D.WidthType.DXA }, margins: { top: 50, bottom: 50, left: 80, right: 80 },
        shading: head ? { type: D.ShadingType.CLEAR, fill: BRAND.teal, color: "auto" } : zebra ? { type: D.ShadingType.CLEAR, fill: BRAND.zebra, color: "auto" } : undefined,
        children: [new D.Paragraph({ alignment: nc[i] || (!head && typeof v === "number") ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT, children: [run(head ? v : cellText(v), { size: fs, bold: head, color: head ? "FFFFFF" : BRAND.ink })] })] });
      const rows = [new D.TableRow({ tableHeader: true, cantSplit: true, children: s.columns.map((c, i) => cell(c, i, true)) })];
      if ((s.rows || []).length) s.rows.forEach((r, ri) => rows.push(new D.TableRow({ cantSplit: true, children: s.columns.map((_, i) => cell(r[i], i, false, ri % 2 === 1)) })));
      else rows.push(new D.TableRow({ children: [new D.TableCell({ columnSpan: s.columns.length, width: { size: usable, type: D.WidthType.DXA }, children: [new D.Paragraph({ children: [run("None recorded.", { italics: true, color: BRAND.muted, size: fs })] })] })] }));
      ch.push(new D.Table({ width: { size: usable, type: D.WidthType.DXA }, columnWidths: widths, borders, rows }));
      ch.push(new D.Paragraph({ spacing: { after: 120 }, children: [] }));
    }
  }
  const footer = new D.Footer({ children: [new D.Paragraph({ border: { top: { style: D.BorderStyle.SINGLE, size: 4, color: BRAND.line, space: 4 } }, tabStops: [{ type: D.TabStopType.RIGHT, position: usable }],
    children: [run(`Quayzen  ·  ${rep.title}`.slice(0, 110), { size: 15, color: BRAND.muted }), new D.TextRun({ children: ["\tPage ", D.PageNumber.CURRENT, " of ", D.PageNumber.TOTAL_PAGES], size: 15, color: BRAND.muted, font: "Calibri" })] })] });
  const header = new D.Header({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [run(`${company()}${rep.demo ? "  ·  DEMO DATA" : ""}`, { size: 15, color: rep.demo ? BRAND.amberInk : BRAND.muted })] })] });
  const document_ = new D.Document({ creator: "Quayzen", title: rep.title, styles: { default: { document: { run: { font: "Calibri", size: 20, color: BRAND.ink } } } },
    sections: [{ properties: { page: { size: wide ? { orientation: D.PageOrientation.LANDSCAPE, width: 11906, height: 16838 } : { width: 11906, height: 16838 }, margin: { top: 900, bottom: 900, left: margin, right: margin } } }, headers: { default: header }, footers: { default: footer }, children: ch }] });
  return await D.Packer.toBlob(document_);
}

const FMT_NAMES = { xlsx: "Excel", pdf: "PDF", docx: "Word" };
async function exportReport(rep, fmt, name) {
  name = name || (rep.demo ? "DEMO_" : "") + reportName(rep) + "_" + today();
  const wait = toast(`Preparing the ${FMT_NAMES[fmt]} file…`, "info");
  try {
    const blob = fmt === "xlsx" ? await reportXlsx(rep) : fmt === "pdf" ? await reportPdf(rep) : await reportDocx(rep);
    if (await saveFile(`${name}.${fmt}`, blob)) { toast(`${FMT_NAMES[fmt]} file ready.`); Store.audit("reports", null, "Exported", `${rep.title} exported as ${FMT_NAMES[fmt]}`); }
  } catch (e) { console.error(e); showErrors((e && e.message) || String(e)); }
  finally { if (wait) wait.remove(); }
}
/* Ask which format, for any report-like download */
function chooseFormat(rep, name) {
  UI.pendingRep = { rep, name };
  openModal(`<h2>Download</h2><p class="muted">${esc(rep.title)}</p><div class="fmtgrid">
    <button class="fmt" data-act="fmt-go" data-fmt="xlsx"><b>Excel</b><span>A summary sheet and one formatted sheet per table, ready to filter and total</span></button>
    <button class="fmt" data-act="fmt-go" data-fmt="pdf"><b>PDF</b><span>Ready to read, share or attach</span></button>
    <button class="fmt" data-act="fmt-go" data-fmt="docx"><b>Word</b><span>To edit the wording before you use it</span></button></div>`);
}

/* Fill the Commission's original fillable PDF, then read it back to check every value. */
async function fillAnnualReturnPdf(lineState) {
  const PDFLib = await libs.pdflib();
  if (typeof AR2026_PDF_B64 === "undefined") await loadScript("js/ar2026pdf.js");
  const bytes = Uint8Array.from(atob(AR2026_PDF_B64), c => c.charCodeAt(0));
  const pdf = await PDFLib.PDFDocument.load(bytes);
  const form = pdf.getForm();
  const { values, checks, manual } = arPdfValues(lineState);
  const problems = [];
  for (const [k, v] of Object.entries(values)) {
    let f; try { f = form.getField(k); } catch (e) { problems.push(`${k}: field not found in the form`); continue; }
    try {
      if (f instanceof PDFLib.PDFDropdown) { if (v) f.select(v); else f.clear(); }
      else if (f instanceof PDFLib.PDFTextField) f.setText(v || "");
    } catch (e) { problems.push(`${k}: could not write value`); }
  }
  for (const [k, on] of Object.entries(checks)) { try { const c = form.getCheckBox(k); on ? c.check() : c.uncheck(); } catch (e) { problems.push(`${k}: tick box not found`); } }
  form.updateFieldAppearances();
  const out = await pdf.save();
  // read back
  const back = await PDFLib.PDFDocument.load(out);
  const bf = back.getForm(), names = bf.getFields().map(f => f.getName());
  for (const [k, v] of Object.entries(values)) {
    try { const f = bf.getField(k); const got = f instanceof PDFLib.PDFDropdown ? (f.getSelected()[0] || "") : (f.getText() || ""); if (got !== (v || "")) problems.push(`${k}: saved '${got}' but expected '${v}'`); } catch (e) { }
  }
  for (const k of AR_TEMPLATE.neverFill) { try { const f = bf.getField(k); if (f instanceof PDFLib.PDFCheckBox && f.isChecked()) problems.push(`${k}: declaration should not be ticked`); if (f instanceof PDFLib.PDFTextField && f.getText()) problems.push(`${k}: should be blank`); } catch (e) { } }
  const check = { ok: !problems.length, problems, fields: names.length, pages: back.getPageCount(), filled: Object.values(values).filter(Boolean).length,
    ticked: Object.values(checks).filter(Boolean).length, manual };
  return { blob: new Blob([out], { type: "application/pdf" }), check };
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  if (window.crypto && crypto.subtle) { try { const buf = await crypto.subtle.digest("SHA-256", data); return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""); } catch (e) { } }
  return sha256js(data);
}
/* Plain JavaScript SHA-256, used only where the browser's crypto API is unavailable */
function sha256js(bytes) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l = bytes.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(n - 4, l * 8); dv.setUint32(n - 8, Math.floor(l / 0x20000000));
  const w = new Uint32Array(64), r = (x, y) => (x >>> y) | (x << (32 - y));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = r(w[i-15],7) ^ r(w[i-15],18) ^ (w[i-15] >>> 3), s1 = r(w[i-2],17) ^ r(w[i-2],19) ^ (w[i-2] >>> 10); w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0; }
    let [a,b,c,d,e,f,g,h] = H;
    for (let i = 0; i < 64; i++) { const t1 = (h + (r(e,6) ^ r(e,11) ^ r(e,25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((r(a,2) ^ r(a,13) ^ r(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0; }
    H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

