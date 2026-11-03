import assert from "node:assert/strict";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import JSZip from "jszip";

// Inspect the actual painted page streams and Office parts in HTTP downloads.
export async function markedForm(bytes, name, expected) {
  if (name.endsWith(".pdf")) {
    const pdf = await PDFDocument.load(bytes);
    for (const page of pdf.getPages()) {
      const content = page.node.Contents();
      const streams = content instanceof PDFArray ? content.asArray().map(r => pdf.context.lookup(r)) : [content];
      const text = streams.filter(s => s instanceof PDFRawStream).map(s => Buffer.from(decodePDFRawStream(s).decode()).toString()).join("\n");
      assert.ok(text.includes(Buffer.from(expected).toString("hex").toUpperCase()), `Missing ${expected} on a page of ${name}`);
      if (expected === "DEMO") assert.ok(!text.includes(Buffer.from("DRAFT").toString("hex").toUpperCase()), "Approved copy must lose DRAFT");
    }
  } else {
    const z = await JSZip.loadAsync(bytes);
    const files = Object.keys(z.files);
    if (name.endsWith(".docx")) {
      const headers = files.filter(n => /^word\/quayzen-mark-\d+\.xml$/.test(n));
      assert.ok(headers.length >= 3, "Default, first and even page headers");
      for (const h of headers) assert.ok((await z.file(h).async("string")).includes(expected));
    } else if (name.endsWith(".xlsx")) {
      for (const n of files.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) assert.ok((await z.file(n).async("string")).includes(expected), "Print header mark");
      assert.ok((await Promise.all(files.filter(n => /^xl\/drawings\/.*\.xml$/.test(n)).map(n => z.file(n).async("string")))).some(s => s.includes(expected)), "Screen drawing mark");
    } else throw new Error(`Unexpected form ${name}`);
  }
  return true;
}
export async function markedPack(zip, expected) {
  let count = 0;
  for (const [name, f] of Object.entries(zip.files)) if (!f.dir && name !== "READ_ME.txt") { await markedForm(await f.async("uint8array"), name, expected); count++; }
  assert.ok(count > 0);
  return true;
}
