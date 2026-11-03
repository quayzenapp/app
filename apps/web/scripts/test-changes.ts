import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { changeDue, stripChange, validateItems, L, type Rec } from "../src/lib/lic/changes";
import { buildChange } from "../src/lib/lic/change-build";
import { formBytes } from "../src/lib/lic/gen";
const access = ["personal", "id", "pay", "ubo", "bank"];
const item = (code: string, date = "2026-01-31") => ({ code, former: "Old value", new: "New value", date, reason: "Changed" });
async function run() {
  // Hand worked: Jan 31 + February's 28 days + 2 days = March 2; leap year + 1 day = March 1.
  assert.equal(changeDue([item("A")]), "2026-03-02");
  assert.equal(changeDue([item("A", "2028-01-31")]), "2028-03-01");
  assert.equal(changeDue([item("A", "2026-12-31"), item("B", "2026-11-03")]), "2026-12-03");
  assert.equal(changeDue([]), null);
  assert.throws(() => validateItems([item("A"), item("A")]));
  assert.throws(() => validateItems([item("X")]));
  assert.throws(() => validateItems([item("A", "2026-02-30")]));
  validateItems(Array.from({ length: 5 }, () => item("F")));
  assert.throws(() => validateItems(Array.from({ length: 6 }, () => item("F"))));
  console.log("PASS  Schedule III: hand-worked deadlines, real dates and official row capacities");
  const data = { name: "Probe Ltd", licence_no: "LIC-9", signer: "Ann", items: L.S3_ITEMS.map(([code]: string[]) => item(code)), offshore: true, o3: { name: "Probe Ltd", appoint: { name: "Ann", passport: "SECRET", date: "2026-10-01" }, pc: { date: "2026-10-03" }, signer: "Ann", dir_a: true }, people: [{ id: "p", name: "Ann", kind: "Individual", roles: [L.ROLE.dir], id_no: "SECRET" }] };
  const safe = stripChange(data, []);
  assert.equal(safe.items, undefined); assert.equal(safe.o3.appoint?.passport, undefined); assert.equal(safe.o3.appoint?.name, undefined); assert.equal(safe.people[0].id_no, undefined);
  console.log("PASS  Restricted fields stripped from nested offshore and person data, including free-text changes");
  await assert.rejects(() => buildChange(safe, []), /cannot see/);
  await assert.rejects(() => buildChange({ ...data, o3: { arc: { date: "2026-10-03" } } }, access), /Admin > Controls/);
  console.log("PASS  Unconfigured representative cessation date blocks delivery and points to Admin > Controls");
  const files = await buildChange(data, access);
  for (const file of files) assert.deepEqual(file.check?.problems ?? [], [], file.name);
  const s3 = files.find((f) => f.name.startsWith("Schedule_III"))!, pdf = await PDFDocument.load(await s3.blob.arrayBuffer()), form = pdf.getForm();
  assert.equal(form.getTextField("Text373").getText(), "LIC-9"); assert.equal(form.getTextField("Text374").getText(), "Probe Ltd");
  assert.equal(form.getTextField("Text377").getText(), "31/01/2026");
  assert.equal(form.getTextField("Text443").getText(), "Old value"); // G's first former-detail field is deliberately out of numeric order.
  assert.equal(form.getTextField("Text474").getText() ?? "", "");
  const original = await PDFDocument.load(await formBytes("s3"));
  assert.equal(pdf.getPageCount(), original.getPageCount()); assert.equal(form.getFields().length, original.getForm().getFields().length);
  const o3 = await PDFDocument.load(await files.find((f) => f.name.startsWith("Form_III"))!.blob.arrayBuffer()), off = o3.getForm();
  assert.equal(off.getTextField("Text17").getText(), "SECRET"); assert.equal(off.getTextField("Text76").getText(), "03"); assert.equal(off.getTextField("Text78").getText(), "10"); assert.equal(off.getTextField("Text77").getText(), "2026");
  assert.ok(off.getCheckBox("Check Box4").isChecked());
  for (const key of ["Text92", "Text93", "Text94"]) assert.equal(off.getTextField(key).getText() ?? "", "");
  assert.ok(files.some((f) => f.name.startsWith("Schedule_I_Part_V")));
  console.log("PASS  Original Schedule III, offshore III and new-director Schedule I PDF read-back; signature dates blank");
  const large: Rec = { ...data, people: [], items: [{ ...item("A"), new: "Long full details ".repeat(200) }] };
  const overflow = await buildChange(large, access);
  assert.ok(overflow.some((f) => f.name.includes("continuation"))); for (const file of overflow) assert.deepEqual(file.check?.problems ?? [], []);
  console.log("PASS  Long details produce a companion continuation PDF");
}
run().catch((e) => { console.error(e); process.exitCode = 1; });
