import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { markForm, formMark } from "../src/lib/form-marks";
import { createGen } from "../src/lib/lic/gen";
import { buildChange } from "../src/lib/lic/change-build";
import { fillAnnualReturnPdf } from "../src/lib/ar/pdf";

const { DOMParser, XMLSerializer } = new JSDOM("").window;
const parse = (s: string) => new DOMParser().parseFromString(s, "application/xml");
const serialize = (n: Node) => new XMLSerializer().serializeToString(n);
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const all = ["personal", "id", "pay", "ubo", "bank"];
const app: any = { id: "a", legal: "Company", p1: { name: "Mark test applicant" }, decl: { director1: "Test Director" }, tef: { year1: "2027-01-01", v: { revenue: [1000, 2000] } } };
const G = createGen({ list: (t: string) => t === "ubo" ? [{ full_name: "Test Owner", ownership_pct: 100 }] : t === "app_people" ? [{ id: "p", app_id: "a", name: "Test Director", kind: "Individual", roles: ["Director / member of the key management body", "Shareholder / member / partner / founder"], shareholding_pct: 100 }] : [], get: () => null, company: () => ({ name: "Mark test applicant" }), canSee: () => true });
const asFiles = (r: any): { name: string; blob: Blob; check?: { problems: string[] } }[] => Array.isArray(r) ? r : [r];
const bytes = async (f: { blob: Blob }) => new Uint8Array(await f.blob.arrayBuffer());
const parts = async (z: JSZip, n: string) => parse(await z.file(n)!.async("string"));
let passed = 0;
function pass(s: string) { passed++; console.log(`PASS  ${s}`); }
async function checkPdf(b: Uint8Array, mark: string) {
  const pdf = await PDFDocument.load(b);
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(r => pdf.context.lookup(r)) : [contents];
    const text = streams.filter(s => s instanceof PDFRawStream).map(s => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString()).join("\n");
    // Inspect the actual page painting operators, rather than metadata or file names.
    const actual = ["DRAFT", "DEMO"].filter(m => text.includes(Buffer.from(m).toString("hex").toUpperCase())).join(" / ");
    // PDF-lib emits a single hex string for a combined label.
    if (mark) assert.ok(text.includes(Buffer.from(mark).toString("hex").toUpperCase()), `Page missing ${mark}`);
    else assert.equal(actual, "");
  }
  return pdf;
}
async function run() {
  await mkdir("../../tests/e2e/shots", { recursive: true });
  const outputs = [];
  for (const build of [G.buildSchedule1, G.buildTef, G.buildApDeclaration, G.buildUboDeclarations, G.buildDsInfo, G.buildBusinessProfile]) outputs.push(...asFiles(await build(app)));
  const notice = { name: "Mark test applicant", licence_no: "TEST-1", offshore: true, o3: { name: "Mark test applicant", appoint: { name: "Test Representative" } }, items: [{ code: "A", former: "Former", new: "Long continuation details ".repeat(200), reason: "Test", date: "2026-11-01" }] };
  outputs.push(...await buildChange(notice, all));
  const ar = await fillAnnualReturnPdf({}, { approved: true, demo: false });
  outputs.push({ name: "Annual_return.pdf", blob: new Blob([new Uint8Array(ar.bytes)]) });
  for (const file of outputs) {
    assert.deepEqual(file.check?.problems ?? [], [], file.name);
    const original = await bytes(file);
    for (const [approved, demo, mark] of [
      [false, false, "DRAFT"], [false, true, "DRAFT / DEMO"],
      [true, false, ""], [true, true, "DEMO"],
    ] as const) {
      const state = { approved, demo };
      assert.equal(formMark(state), mark, "The state must select the expected literal label");
      const marked = await markForm(file, state), b = await bytes(marked);
      if (!mark) assert.deepEqual(b, original, "Approved real file is byte-identical");
      if (file.name.endsWith(".pdf")) {
        const [a, out] = await Promise.all([PDFDocument.load(original), checkPdf(b, mark)]);
        assert.equal(out.getPageCount(), a.getPageCount());
        assert.deepEqual(out.getForm().getFields().map(f => f.getName()), a.getForm().getFields().map(f => f.getName()));
        if (file.name.startsWith("Schedule_I_Application") || file.name.startsWith("Schedule_III") || file.name.startsWith("Form_III") || file.name.includes("continuation") || file.name.startsWith("Annual_")) await writeFile(`../../tests/e2e/shots/marks-${file.name.replace(/\.pdf$/, "")}-${approved ? "approved" : "draft"}-${demo ? "demo" : "real"}.pdf`, b);
      } else {
        const [a, z] = await Promise.all([JSZip.loadAsync(original), JSZip.loadAsync(b)]);
        if (file.name.endsWith(".docx")) {
          const before = await parts(a, "word/document.xml"), after = await parts(z, "word/document.xml");
          const bodyText = (d: Document) => Array.from(d.getElementsByTagNameNS(W, "t")).map(e => e.textContent);
          assert.deepEqual(bodyText(after), bodyText(before));
          if (mark) {
            const rels = await parts(z, "word/_rels/document.xml.rels");
            for (const section of Array.from(after.getElementsByTagNameNS(W, "sectPr"))) for (const kind of ["default", "first", "even"]) {
              const ref = Array.from(section.getElementsByTagNameNS(W, "headerReference")).find(e => e.getAttributeNS(W, "type") === kind)!;
              assert.ok(ref, `Missing ${kind} header`);
              const rel = Array.from(rels.documentElement.children).find(e => e.getAttribute("Id") === ref.getAttributeNS(R, "id"))!;
              assert.ok((await z.file(`word/${rel.getAttribute("Target")}`)!.async("string")).includes(mark));
            }
          }
        } else {
          for (const n of Object.keys(a.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
            const [before, after] = await Promise.all([parts(a, n), parts(z, n)]);
            assert.equal(serialize(after.getElementsByTagName("sheetData")[0]), serialize(before.getElementsByTagName("sheetData")[0]), "Every existing cell and formula stays unchanged");
            if (mark) for (const h of ["oddHeader", "evenHeader", "firstHeader"]) assert.ok(after.getElementsByTagName(h)[0].textContent?.includes(mark));
            if (mark) {
              const rels = await parts(z, n.replace("/worksheets/", "/worksheets/_rels/") + ".rels");
              const id = after.getElementsByTagName("drawing")[0].getAttributeNS(R, "id");
              const rel = Array.from(rels.documentElement.children).find(e => e.getAttribute("Id") === id)!;
              assert.ok((await z.file(`xl/${rel.getAttribute("Target")!.slice(3)}`)!.async("string")).includes(`<a:t>${mark}</a:t>`), "Screen drawing contains mark");
            }
          }
          assert.equal(await z.file("xl/workbook.xml")!.async("string"), await a.file("xl/workbook.xml")!.async("string"), "Sheet names unchanged");
        }
      }
      pass(`${file.name}: ${approved ? "approved" : "draft"}, ${demo ? "demo" : "real"}; mark, pages and original data checked`);
    }
    assert.deepEqual(await bytes(file), original, "Source object is unchanged");
  }
  await assert.rejects(() => markForm({ name: "unknown.txt", blob: new Blob(["test"]) }, { approved: false, demo: true }));
  pass("Unsupported or malformed files are refused instead of delivered unmarked");
  console.log(`${passed} form marking checks passed`);
}
run().catch(e => { console.error(e); process.exitCode = 1; });
