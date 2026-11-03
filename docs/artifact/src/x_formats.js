/* ===== x_formats.js ===== */
/* Word, PDF and Excel versions of any form or draft.
   A "model" is a simple description of a document: { title, subtitle, note, blocks: [ {h}, {p}, {list}, {kv:[[label, value]]}, {table:{cols, rows}} ] }.
   The Commission's own file (PDF, Word or Excel) is always the original. Other formats are editable copies built from the same data,
   and say so at the top, because a re-typed copy is not the Commission's form. */

const FMT_LABEL = { pdf: "PDF", docx: "Word", xlsx: "Excel" };
const COPY_NOTE = o => `Editable copy prepared from the information in Quayzen, following the Commission's ${o}. Submit the Commission's own form unless the Commission has said a copy is acceptable.`;
const mText = v => v == null ? "" : Array.isArray(v) ? v.join(", ") : v === true ? "Yes" : v === false ? "No" : String(v);

async function modelPdf(m) {
  const J = await libs.jspdf(); await libs.autotable();
  const doc = new J({ unit: "pt", format: "a4" }), L = 40, W = 515; let y = 54;
  const room = n => { if (y + n > 800) { doc.addPage(); y = 50; } };
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); if (m.title) for (const l of doc.splitTextToSize(m.title, W)) { doc.text(l, L, y); y += 18; }
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  if (m.subtitle) { doc.setTextColor(90); for (const l of doc.splitTextToSize(m.subtitle, W)) { doc.text(l, L, y); y += 13; } doc.setTextColor(0); }
  if (m.note) { y += 4; doc.setFontSize(8.5); doc.setTextColor(110); for (const l of doc.splitTextToSize(m.note, W)) { room(12); doc.text(l, L, y); y += 11; } doc.setTextColor(0); doc.setFontSize(10); }
  y += 8;
  const at = (opts) => { doc.autoTable(Object.assign({ startY: y, margin: { left: L, right: L }, styles: { fontSize: 8.5, cellPadding: 3, overflow: "linebreak", valign: "top" }, headStyles: { fillColor: [14, 90, 107], fontSize: 8.5 } }, opts)); y = doc.lastAutoTable.finalY + 12; };
  for (const b of m.blocks || []) {
    if (b.h) { room(30); doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); for (const l of doc.splitTextToSize(b.h, W)) { doc.text(l, L, y); y += 15; } doc.setFont("helvetica", "normal"); doc.setFontSize(10); y += 2; }
    else if (b.p != null) { for (const para of String(b.p).split(/\n{2,}/)) { for (const l of doc.splitTextToSize(para, W)) { room(14); doc.text(l, L, y); y += 13; } y += 5; } }
    else if (b.list) { for (const it of b.list) { const ls = doc.splitTextToSize(String(it), W - 14); ls.forEach((l, i) => { room(14); if (!i) doc.text("•", L + 2, y); doc.text(l, L + 14, y); y += 13; }); } y += 5; }
    else if (b.kv) at({ body: b.kv.map(([k, v]) => [k, mText(v)]), theme: "grid", columnStyles: { 0: { cellWidth: 200, fontStyle: "bold", fillColor: [242, 245, 244] } } });
    else if (b.table) at({ head: [b.table.cols], body: b.table.rows.map(r => r.map(mText)), theme: "grid" });
  }
  const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text(`${m.footer || m.title}`.slice(0, 110), L, 820); doc.text(`Page ${i} of ${n}`, 555, 820, { align: "right" }); }
  return { blob: doc.output("blob"), pages: n };
}
async function modelDocx(m) {
  const D = await libs.docx(), run = (t, o = {}) => new D.TextRun({ text: String(t ?? ""), font: "Calibri", size: o.size || 21, bold: o.bold, italics: o.italics, color: o.color });
  const P = (t, o = {}) => new D.Paragraph({ spacing: { after: o.after ?? 120 }, heading: o.heading, children: String(t ?? "").split("\n").flatMap((l, i) => i ? [new D.TextRun({ break: 1 }), run(l, o)] : [run(l, o)]) });
  const cell = (t, o = {}) => new D.TableCell({ width: o.w ? { size: o.w, type: D.WidthType.DXA } : undefined, shading: o.fill ? { fill: o.fill } : undefined, children: [P(t, { size: 18, bold: o.bold, after: 40 })] });
  const ch = m.title ? [P(m.title, { bold: true, size: 30, after: 80 })] : [];
  if (m.subtitle) ch.push(P(m.subtitle, { size: 19, color: "555555" }));
  if (m.note) ch.push(P(m.note, { size: 16, italics: true, color: "777777" }));
  for (const b of m.blocks || []) {
    if (b.h) ch.push(P(b.h, { bold: true, size: 24, after: 100 }));
    else if (b.p != null) String(b.p).split(/\n{2,}/).forEach(x => ch.push(P(x)));
    else if (b.list) b.list.forEach(x => ch.push(new D.Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [run(x)] })));
    else if (b.kv) ch.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, columnWidths: [3400, 5600], rows: b.kv.map(([k, v]) => new D.TableRow({ children: [cell(k, { w: 3400, bold: true, fill: "F2F5F4" }), cell(mText(v), { w: 5600 })] })) }), P("", { after: 80 }));
    else if (b.table) { const n = b.table.cols.length, w = Math.floor(9000 / n);
      ch.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, columnWidths: Array(n).fill(w), rows: [new D.TableRow({ tableHeader: true, children: b.table.cols.map(c => cell(c, { w, bold: true, fill: "DCE8EA" })) }), ...b.table.rows.map(r => new D.TableRow({ children: r.map(c => cell(mText(c), { w })) }))] }), P("", { after: 80 })); }
  }
  const doc = new D.Document({ creator: "Quayzen", title: m.title, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: ch }] });
  return { blob: await D.Packer.toBlob(doc) };
}
async function modelXlsx(m) {
  const E = await libs.exceljs(), wb = new E.Workbook(), ws = wb.addWorksheet((m.sheet || "Form").slice(0, 30));
  ws.columns = Array.from({ length: 12 }, (_, i) => ({ width: i === 0 ? 38 : 16 }));
  const add = (vals, o = {}) => { const r = ws.addRow(vals); if (o.bold) r.font = { bold: true }; if (o.fill) r.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } }); r.alignment = { wrapText: true, vertical: "top" }; return r; };
  add([m.title], { bold: true }).font = { bold: true, size: 14 }; if (m.subtitle) add([m.subtitle]); if (m.note) add([m.note]).font = { italic: true, color: { argb: "FF777777" } }; add([]);
  for (const b of m.blocks || []) {
    if (b.h) { add([b.h]).font = { bold: true, size: 12 }; }
    else if (b.p != null) add([String(b.p)]);
    else if (b.list) b.list.forEach(x => add(["• " + x]));
    else if (b.kv) b.kv.forEach(([k, v]) => { const r = add([k, typeof v === "number" ? v : mText(v)]); r.getCell(1).font = { bold: true }; });
    else if (b.table) { add(b.table.cols, { bold: true, fill: "FFDCE8EA" }); b.table.rows.forEach(r => add(r.map(c => typeof c === "number" ? c : mText(c)))); }
    add([]);
  }
  return { blob: new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
}
const renderModel = (m, f) => f === "pdf" ? modelPdf(m) : f === "docx" ? modelDocx(m) : modelXlsx(m);
const extOf = f => ({ pdf: "pdf", docx: "docx", xlsx: "xlsx" })[f];

/* Model from a filled Word form: paragraphs and tables, in order */
function docxToModel(d, title, src) {
  const blocks = [], body = d.doc.getElementsByTagNameNS(WNS, "body")[0];
  const ptext = p => [...p.getElementsByTagNameNS(WNS, "t")].map(t => t.textContent).join("").trim();
  for (const el of [...body.childNodes].filter(n => n.nodeType === 1)) {
    if (el.localName === "p") { const t = ptext(el); if (!t) continue; const bold = [...el.getElementsByTagNameNS(WNS, "b")].length > 0 && t.length < 120; blocks.push(bold ? { h: t } : { p: t }); }
    else if (el.localName === "tbl") {
      const rows = wrows(el).map(tr => wcells(tr).map(tc => wkids(tc, "p").map(ptext).filter(Boolean).join("\n")));
      const w = Math.max(...rows.map(r => r.length));
      if (w === 2) blocks.push({ kv: rows.filter(r => r.join("").trim()) }); else blocks.push({ table: { cols: rows[0], rows: rows.slice(1).map(r => Array.from({ length: rows[0].length }, (_, i) => r[i] || "")) } });
    }
  }
  return { title, note: COPY_NOTE(src), blocks };
}
/* Model from a field spec (filings, development forms, visa form) */
function specToModel(title, src, spec, data, extra = []) {
  const blocks = []; let sec = null, kv = null;
  for (const [k, l, t, , o = {}] of spec) {
    if (o.never) continue;
    const s = o.sec || "Details"; if (s !== sec) { sec = s; kv = []; blocks.push({ h: s }, { kv }); }
    const v = getPath(data, k); kv.push([l, t === "date" ? ddmmyyyy(v) : t === "check" ? (v ? "Yes" : "") : t === "num" && v != null ? fmtNum(v) : v ?? ""]);
  }
  return { title, note: COPY_NOTE(src), blocks: [...blocks.filter(b => !b.kv || b.kv.length), ...extra] };
}
/* Buttons for an output: the original first, then copies */
function fmtButtons(act, attrs, fmts, orig) {
  return `<div class="row fmtrow">${fmts.map(f => `<button class="btn sm${f === orig ? " p" : ""}" data-act="${act}" ${attrs} data-f="${f}" title="${f === orig ? "The Commission's own form, filled in" : "Editable copy built from the same information"}">${FMT_LABEL[f]}${f === orig ? "" : orig ? " copy" : ""}</button>`).join("")}</div>`;
}
async function saveFiles(files) { for (const f of files) { if (!(await saveFile((Store.company().is_demo ? "DEMO_" : "") + f.name, f.blob))) return false; } return true; }
/* Turn [{name, model}] into files of one format */
async function modelsToFiles(list, f) { const out = []; for (const x of list) { const r = await renderModel(x.model, f); out.push({ name: `${x.name}.${extOf(f)}`, blob: r.blob, notes: x.notes || (r.pages ? [`${r.pages} page(s).`] : []), pages: r.pages }); } return out; }

