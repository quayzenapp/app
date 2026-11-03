/** Delivery-time marks. Approved snapshots and the Commission's source files are never edited. */
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField, StandardFonts, degrees, rgb } from "pdf-lib";

export type FormState = { approved: boolean; demo: boolean };
export const formMark = ({ approved, demo }: FormState) => [!approved && "DRAFT", demo && "DEMO"].filter(Boolean).join(" / ");
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const P = "http://schemas.openxmlformats.org/package/2006/relationships";
const { DOMParser, XMLSerializer } = new JSDOM("").window;
const parse = (xml: string) => { const doc = new DOMParser().parseFromString(xml, "application/xml"); if (doc.querySelector("parsererror")) throw new Error("The form XML could not be read; the file was not delivered."); return doc; };
const xml = (doc: Document) => new XMLSerializer().serializeToString(doc);
const read = async (zip: JSZip, name: string) => { const f = zip.file(name); if (!f) throw new Error(`Missing ${name}; the form could not be marked.`); return parse(await f.async("string")); };
const fieldState = (pdf: PDFDocument) => pdf.getForm().getFields().map(f => [f.getName(), f.constructor.name,
  f instanceof PDFTextField ? f.getText() ?? "" : f instanceof PDFCheckBox ? f.isChecked() : f instanceof PDFRadioGroup ? f.getSelected() ?? "" : f instanceof PDFDropdown || f instanceof PDFOptionList ? f.getSelected() : null]);

export async function markPdf(bytes: Uint8Array, state: FormState): Promise<Uint8Array> {
  const mark = formMark(state);
  if (!mark) return bytes;
  const pdf = await PDFDocument.load(bytes), before = JSON.stringify(fieldState(pdf)), count = pdf.getPageCount();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const page of pdf.getPages()) {
    const { x, y, width, height } = page.getCropBox();
    const size = Math.min(56, width / 9), textWidth = font.widthOfTextAtSize(mark, size);
    // Translucent diagonal overlay keeps both the original print and entered values legible.
    page.drawText(mark, { x: x + (width - font.widthOfTextAtSize(mark, 10)) / 2, y: y + 7, size: 10, font, color: rgb(0, 0, 0), opacity: .7 });
    page.drawText(mark, { x: x + width / 2 - textWidth * .35, y: y + height * .44, size, font, rotate: degrees(35), color: rgb(0, 0, 0), opacity: .18 });
  }
  const out = new Uint8Array(await pdf.save({ updateFieldAppearances: false }));
  const back = await PDFDocument.load(out);
  if (back.getPageCount() !== count || JSON.stringify(fieldState(back)) !== before) throw new Error("The marked PDF failed its field read-back; the file was not delivered.");
  return out;
}

async function markWord(zip: JSZip, mark: string) {
  const doc = await read(zip, "word/document.xml"), rels = await read(zip, "word/_rels/document.xml.rels"), types = await read(zip, "[Content_Types].xml");
  const inherited: Record<string, string> = {};
  let index = 0;
  for (const section of Array.from(doc.getElementsByTagNameNS(W, "sectPr"))) {
    for (const kind of ["default", "first", "even"]) {
      let ref = Array.from(section.getElementsByTagNameNS(W, "headerReference")).find(e => e.getAttributeNS(W, "type") === kind);
      const oldId = ref?.getAttributeNS(R, "id") ?? inherited[kind];
      if (oldId) inherited[kind] = oldId;
      const oldRel = Array.from(rels.documentElement.children).find(e => e.getAttribute("Id") === oldId);
      const target = oldRel?.getAttribute("Target");
      const header = target ? await read(zip, target.startsWith("/") ? target.slice(1) : `word/${target}`) : parse(`<w:hdr xmlns:w="${W}"/>`);
      const p = header.createElementNS(W, "w:p");
      p.innerHTML = `<w:pPr xmlns:w="${W}"><w:jc w:val="center"/></w:pPr><w:r xmlns:w="${W}"><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>${mark}</w:t></w:r>`;
      header.documentElement.insertBefore(p, header.documentElement.firstChild);
      const name = `quayzen-mark-${++index}.xml`, id = `quayzenMark${index}`;
      if (zip.file(`word/${name}`) || Array.from(rels.documentElement.children).some(e => e.getAttribute("Id") === id)) throw new Error("The form already has a delivery mark.");
      zip.file(`word/${name}`, xml(header));
      if (target) {
        const original = target.replace(/^.*\//, "");
        const oldRels = zip.file(`word/_rels/${original}.rels`);
        if (oldRels) zip.file(`word/_rels/${name}.rels`, await oldRels.async("uint8array"));
      }
      const rel = rels.createElementNS(P, "Relationship"); rel.setAttribute("Id", id); rel.setAttribute("Type", `${R}/header`); rel.setAttribute("Target", name); rels.documentElement.appendChild(rel);
      const ct = types.createElementNS(types.documentElement.namespaceURI, "Override"); ct.setAttribute("PartName", `/word/${name}`); ct.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"); types.documentElement.appendChild(ct);
      if (!ref) { ref = doc.createElementNS(W, "w:headerReference"); ref.setAttributeNS(W, "w:type", kind); section.insertBefore(ref, section.firstChild); }
      ref.setAttributeNS(R, "r:id", id);
    }
  }
  if (!index) throw new Error("The Word form has no page sections and could not be marked.");
  zip.file("word/document.xml", xml(doc)); zip.file("word/_rels/document.xml.rels", xml(rels)); zip.file("[Content_Types].xml", xml(types));
}

async function markExcel(zip: JSZip, mark: string) {
  // A drawing is visible in Normal view, while headers repeat the mark on every printed page.
  // Work at the package level to keep every cell, formula, sheet name and existing drawing.
  const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const types = await read(zip, "[Content_Types].xml");
  let i = 0;
  for (const name of Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
    const sheet = await read(zip, name), root = sheet.documentElement;
    let hf = sheet.getElementsByTagNameNS(ns, "headerFooter")[0];
    if (!hf) { hf = sheet.createElementNS(ns, "headerFooter"); const next = Array.from(root.children).find(e => ["rowBreaks", "colBreaks", "customProperties", "cellWatches", "ignoredErrors", "smartTags", "drawing", "legacyDrawing", "legacyDrawingHF", "picture", "oleObjects", "controls", "webPublishItems", "tableParts", "extLst"].includes(e.localName)); root.insertBefore(hf, next ?? null); }
    for (const kind of ["oddHeader", "evenHeader", "firstHeader"]) {
      let h = sheet.getElementsByTagNameNS(ns, kind)[0];
      if (!h) { h = sheet.createElementNS(ns, kind); hf.appendChild(h); }
      h.textContent = `${h.textContent ?? ""}&C&B${mark}&B`;
    }
    // Schema order is oddHeader, oddFooter, evenHeader, evenFooter, firstHeader, firstFooter.
    for (const tag of ["oddHeader", "oddFooter", "evenHeader", "evenFooter", "firstHeader", "firstFooter"]) { const e = Array.from(hf.children).find(c => c.localName === tag); if (e) hf.appendChild(e); }
    const relPath = name.replace("/worksheets/", "/worksheets/_rels/") + ".rels";
    const rels = zip.file(relPath) ? await read(zip, relPath) : parse(`<Relationships xmlns="${P}"/>`);
    let drawing = sheet.getElementsByTagNameNS(ns, "drawing")[0];
    let drawingPath: string;
    if (drawing) {
      const rel = Array.from(rels.documentElement.children).find(e => e.getAttribute("Id") === drawing.getAttributeNS(R, "id"));
      const target = rel?.getAttribute("Target");
      if (!target || !target.startsWith("../drawings/")) throw new Error("The spreadsheet drawing could not be marked.");
      drawingPath = `xl/${target.slice(3)}`;
    } else {
      drawingPath = `xl/drawings/quayzen-mark-${++i}.xml`;
      if (zip.file(drawingPath)) throw new Error("The spreadsheet already has a delivery mark.");
      const id = "quayzenMark";
      if (Array.from(rels.documentElement.children).some(e => e.getAttribute("Id") === id)) throw new Error("The spreadsheet mark relationship already exists.");
      const rel = rels.createElementNS(P, "Relationship"); rel.setAttribute("Id", id); rel.setAttribute("Type", `${R}/drawing`); rel.setAttribute("Target", `../drawings/quayzen-mark-${i}.xml`); rels.documentElement.appendChild(rel);
      drawing = sheet.createElementNS(ns, "drawing"); drawing.setAttributeNS(R, "r:id", id);
      const next = Array.from(root.children).find(e => ["legacyDrawing", "legacyDrawingHF", "picture", "oleObjects", "controls", "webPublishItems", "tableParts", "extLst"].includes(e.localName)); root.insertBefore(drawing, next ?? null);
      const ct = types.createElementNS(types.documentElement.namespaceURI, "Override"); ct.setAttribute("PartName", `/${drawingPath}`); ct.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.drawing+xml"); types.documentElement.appendChild(ct);
    }
    const dns = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
    const d = zip.file(drawingPath) ? await read(zip, drawingPath) : parse(`<xdr:wsDr xmlns:xdr="${dns}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>`);
    const anchor = parse(`<xdr:absoluteAnchor xmlns:xdr="${dns}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:pos x="0" y="0"/><xdr:ext cx="5715000" cy="304800"/><xdr:sp><xdr:nvSpPr><xdr:cNvPr id="2147483646" name="Quayzen delivery mark"/><xdr:cNvSpPr txBox="1"/></xdr:nvSpPr><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></xdr:spPr><xdr:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="r"/><a:r><a:rPr lang="en-US" sz="1400" b="1"><a:solidFill><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:solidFill></a:rPr><a:t>${mark}</a:t></a:r></a:p></xdr:txBody></xdr:sp><xdr:clientData/></xdr:absoluteAnchor>`);
    d.documentElement.appendChild(d.importNode(anchor.documentElement, true));
    zip.file(drawingPath, xml(d)); zip.file(relPath, xml(rels)); zip.file(name, xml(sheet));
  }
  zip.file("[Content_Types].xml", xml(types));
}

export async function markForm<T extends { name: string; blob: Blob }>(file: T, state: FormState): Promise<T> {
  const mark = formMark(state);
  if (!mark) return file;
  const bytes = new Uint8Array(await file.blob.arrayBuffer());
  if (file.name.endsWith(".pdf")) return { ...file, blob: new Blob([await markPdf(bytes, state) as Uint8Array<ArrayBuffer>], { type: file.blob.type }) };
  const zip = await JSZip.loadAsync(bytes);
  if (file.name.endsWith(".docx")) await markWord(zip, mark);
  else if (file.name.endsWith(".xlsx")) await markExcel(zip, mark);
  else throw new Error(`Cannot mark ${file.name}; the file was not delivered.`);
  return { ...file, blob: new Blob([new Uint8Array(await zip.generateAsync({ type: "uint8array" }))], { type: file.blob.type }) };
}
