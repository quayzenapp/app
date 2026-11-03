import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { PDFCheckBox, PDFDocument, PDFTextField } from "pdf-lib";
import { createGen } from "../src/lib/lic/gen";
import { buildChange } from "../src/lib/lic/change-build";
import { createDateFormatter, freezeDateFormats, parseDateFormats, resolveDateFormat, snapshotDateFormats, FORM_DATE_FIELDS } from "../src/lib/lic/date-formats";
import { markForm } from "../src/lib/form-marks";
const access = ["personal", "id", "pay", "ubo", "bank"];
const sh = "Shareholder / member / partner / founder", dir = "Director / member of the key management body";
const people = [
  { id: "c", app_id: "a", name: "Corporate member", kind: "Corporate", roles: [sh], c_inc_date: "2000-12-31", c_lic_date: "2020-01-02", shareholding_pct: 50 },
  { id: "p", app_id: "a", name: "Individual member", kind: "Individual", roles: [sh, dir], dob: "2000-02-29", passport_expiry: "2030-01-01", shareholding_pct: 50 },
];
const store = { list: (t: string) => t === "app_people" ? people : t === "ubo" ? [{ full_name: "Test Owner", date_of_birth: "2000-02-29" }] : [], company: () => ({}), get: () => null, canSee: () => true };
const app = { id: "a", legal: "General Partnership", origin: "Foreign", p1: { name: "Date test applicant" }, tef: { year1: "2027-01-01", v: { revenue: [100] } } };
const asArray = (r: any) => Array.isArray(r) ? r : [r];
const bytes = async (f: { blob: Blob }) => new Uint8Array(await f.blob.arrayBuffer());
const pdfState = async (b: Uint8Array) => { const d = await PDFDocument.load(b); return { pages: d.getPageCount(), fields: d.getForm().getFields().map(f => [f.getName(), f instanceof PDFTextField ? f.getText() : f instanceof PDFCheckBox ? f.isChecked() : ""]) }; };
let count = 0;
const pass = (name: string) => { count++; console.log(`PASS  ${name}`); };
async function run() {
  const defaults = parseDateFormats();
  for (const field of FORM_DATE_FIELDS) assert.equal(resolveDateFormat(defaults, field.form, field.field), field.explicit ? undefined : "DD/MM/YYYY");
  assert.throws(() => parseDateFormats({ defaultFormat: "MM/DD/YYYY", fields: {} }));
  assert.throws(() => parseDateFormats({ defaultFormat: "DD/MM/YY", fields: { unknown: "DD/MM/YY" } }));
  assert.throws(() => createDateFormatter({ defaultFormat: "DD/MM/YY", fields: {} })("o3", "arc.date", "2026-11-03"), /Admin > Controls/);
  pass("Date catalog defaults, fixed allowed formats, unknown fields and non-inherited arc.date");
  const old = createGen(store), normal = createGen(store, createDateFormatter(defaults));
  for (const build of ["buildSchedule1", "buildTef", "buildApDeclaration", "buildUboDeclarations", "buildDsInfo", "buildBusinessProfile"]) {
    const [a, b] = await Promise.all([old[build](app), normal[build](app)]);
    const [before, after] = [asArray(a), asArray(b)]; assert.equal(before.length, after.length);
    for (let i = 0; i < before.length; i++) {
      if (before[i].name.endsWith(".pdf")) assert.deepEqual(await pdfState(await bytes(before[i])), await pdfState(await bytes(after[i])));
      else {
        const [x, y] = await Promise.all([JSZip.loadAsync(await bytes(before[i])), JSZip.loadAsync(await bytes(after[i]))]);
        for (const n of Object.keys(x.files)) if (!x.files[n].dir) assert.equal(await x.file(n)!.async("base64"), await y.file(n)!.async("base64"), n);
      }
    }
    pass(`${build}: injected default preserves every PDF field/page or Office part`);
  }
  const custom = parseDateFormats({ defaultFormat: "DD/MM/YY", fields: { "s1.Text309": "DD/MM/YYYY", "s3.Text377": "DD/MM/YYYY", "o3.arc.date": "DD/MM/YY" } });
  const G = createGen(store, createDateFormatter(custom));
  const s1s = asArray(await G.buildSchedule1(app));
  const forms = await Promise.all(s1s.filter(f => f.name.endsWith(".pdf")).map(async f => (await PDFDocument.load(await bytes(f))).getForm()));
  assert.ok(forms.some(f => f.getTextField("Text14").getText() === "31/12/00" && f.getTextField("Text16").getText() === "02/01/20"));
  assert.ok(forms.some(f => f.getTextField("Text231").getText() === "29/02/00" && f.getTextField("Text240").getText() === "01/01/30"));
  assert.ok(forms.some(f => f.getTextField("Text309").getText() === "29/02/2000" && f.getTextField("Text314").getText() === "01/01/30"));
  pass("Schedule I corporate, individual and director dates read back with field override winning");
  const ubo = asArray(await G.buildUboDeclarations(app))[0];
  const word = await JSZip.loadAsync(await bytes(ubo)); assert.ok((await word.file("word/document.xml")!.async("string")).includes("29/02/00"));
  pass("UBO declaration date of birth uses the injected formatter");
  const notice = { name: "Date test applicant", licence_no: "TEST-1", items: [{ code: "A", date: "2026-11-01", former: "Former", new: "New", reason: "Test" }], offshore: true, o3: { arc: { date: "2026-11-01" }, appoint: { date: "2026-11-02" }, pc: { date: "2026-11-03" } } };
  await assert.rejects(() => buildChange(notice, access), /Admin > Controls/);
  const out = await buildChange(notice, access, custom);
  for (const f of out) assert.deepEqual(f.check?.problems ?? [], []);
  const s3 = (await PDFDocument.load(await bytes(out[0]))).getForm(); assert.equal(s3.getTextField("Text377").getText(), "01/11/2026");
  const off = (await PDFDocument.load(await bytes(out[1]))).getForm();
  assert.equal(off.getTextField("Text43").getText(), "01/11/26"); assert.equal(off.getTextField("Text22").getText(), "02/11/26");
  assert.equal(off.getTextField("Text76").getText(), "03"); assert.equal(off.getTextField("Text78").getText(), "11"); assert.equal(off.getTextField("Text77").getText(), "2026");
  for (const f of ["Text92", "Text93", "Text94"]) assert.equal(off.getTextField(f).getText() ?? "", "");
  pass("Schedule III override, offshore two-digit year and unchanged split boxes/signature dates");
  const frozen = freezeDateFormats(custom), json = JSON.stringify(frozen), hash = createHash("sha256").update(json).digest("hex");
  custom.defaultFormat = "DD/MM/YYYY"; custom.fields["o3.arc.date"] = "DD/MM/YYYY";
  assert.equal(JSON.stringify(frozen), json); assert.equal(createDateFormatter(frozen)("o3", "arc.date", "2026-11-01"), "01/11/26");
  assert.notEqual(createHash("sha256").update(JSON.stringify(freezeDateFormats(custom))).digest("hex"), hash);
  assert.equal(createDateFormatter(snapshotDateFormats(undefined))("o3", "arc.date", "2026-11-01"), "01/11/2026");
  pass("Frozen formats survive settings changes, affect fingerprints and preserve legacy four-digit years");
  for (const f of out) {
    const marked = await markForm(f, { approved: false, demo: true });
    assert.deepEqual(await pdfState(await bytes(marked)), await pdfState(await bytes(f)));
  }
  pass("DRAFT/DEMO delivery marks preserve the newly formatted PDF fields and page counts");
  console.log(`${count} date-format check groups passed`);
}
run().catch(e => { console.error(e); process.exitCode = 1; });
