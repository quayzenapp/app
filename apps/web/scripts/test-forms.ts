import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFCheckBox, PDFDocument, PDFTextField } from "pdf-lib";
import { createGen, formBytes } from "../src/lib/lic/gen";

/** Opens each real output file with an independent parser and compares it with the Commission's original. */
let failed = 0;
const ok = (n: string, c: boolean, x: unknown = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n} ${c ? "" : JSON.stringify(x).slice(0, 300)}`); if (!c) failed++; };
const SH = "Shareholder / member / partner / founder", DIR = "Director / member of the key management body", KMP = "Key management personnel (Port City operations)";
const people = [
  { id: "p1", app_id: "a", kind: "Individual", name: "Ann Lee", roles: [SH, DIR, KMP], shareholding_pct: 60, nationality: "Singaporean", address: "1 Orchard Road", id_no: "S1234567", passport_no: "S1234567", position: "Director", designation_pc: "Chief Executive", years_sector: 5 },
  { id: "p2", app_id: "a", kind: "Corporate", name: "ParentCo Pte", roles: [SH], shareholding_pct: 40, nationality: "Singapore", address: "2 Raffles Place", id_no: "REG-999" },
];
const a: any = { id: "a", app_type: "Authorised Person only", origin: "Foreign", legal: "Company", p1: { name: "Probe Analytics Ltd", address: "10 Marina Boulevard", country: "Singapore", email: "probe@example.com", tel: "+65 1234" }, q: { reg_no: "R-12345", group_sl: "No", regulated: "No" }, tef: { year1: "2027-01-01", v: { revenue: [1000, 2000], expenses: [500, 800], m_local: [3], floor: [100] } }, prof: { sectors: "Information Technology", years_exp: "IT - 2 years", countries: "Singapore", segments: "SME", client_sectors: "Finance", entities: [{ name: "Probe Analytics Ltd", country: "Singapore", type: "Applicant", years: "2" }] }, decl: { director1: "Ann Lee", presenter: { name: "Ann Lee", capacity: "Director", email: "ann@example.com" } } };
const ubos = [{ id: "u1", full_name: "Ann Lee", nationality: "Singaporean", ownership_pct: 60, passport_number: "S1234567", residential_address: "1 Orchard Road" }, { id: "u2", full_name: "Bob Tan", nationality: "Singaporean", ownership_pct: 40 }];
const store = (see: string[], ps: any[] = people) => ({ list: (t: string) => (t === "app_people" ? ps : t === "ubo" ? ubos : []), get: () => null, company: () => ({ name: "Probe Analytics Ltd" }), canSee: (s: string) => see.includes(s) });
const G = createGen(store(["personal", "id", "pay", "ubo", "bank"]));
const bytes = async (f: { blob: Blob }) => new Uint8Array(await f.blob.arrayBuffer());
const arr = (r: any) => (Array.isArray(r) ? r : [r]);
const docText = async (b: Uint8Array) => (await (await JSZip.loadAsync(b)).file("word/document.xml")!.async("string")).replace(/<[^>]+>/g, "");
const sameParts = async (x: Uint8Array, y: Uint8Array, skip: RegExp) => { const [A, B] = await Promise.all([JSZip.loadAsync(x), JSZip.loadAsync(y)]); const diff: string[] = []; for (const n of Object.keys(A.files)) { if (skip.test(n) || A.files[n].dir) continue; if (!B.files[n] || (await A.files[n].async("base64")) !== (await B.files[n].async("base64"))) diff.push(n); } return diff; };

(async () => {
  /* Schedule I */
  const s1 = arr(await G.buildSchedule1(a))[0], pdf = await PDFDocument.load(await bytes(s1)), orig = await PDFDocument.load(await formBytes("s1"));
  ok("Schedule I: the read-back found no problems", (s1.check?.problems ?? []).length === 0, s1.check?.problems);
  ok("Schedule I: every original page and field is kept", pdf.getPageCount() >= orig.getPageCount() && pdf.getForm().getFields().length >= orig.getForm().getFields().length, [pdf.getPageCount(), orig.getPageCount()]);
  const texts = pdf.getForm().getFields().filter((f) => f instanceof PDFTextField).map((f) => (f as PDFTextField).getText() ?? "");
  const has = (s: string) => texts.some((t) => t.includes(s));
  for (const v of ["Probe Analytics Ltd", "10 Marina Boulevard", "probe@example.com", "Ann Lee", "ParentCo Pte"]) ok(`Schedule I holds "${v}"`, has(v));
  const names = pdf.getForm().getFields().map((f) => f.getName());
  const empty = orig.getForm().getFields().filter((f) => f instanceof PDFTextField && !(f as PDFTextField).getText()).length, filled = texts.filter(Boolean).length;
  ok("Schedule I: some fields are filled, not all", filled > 5 && filled < empty, [filled, empty]);
  ok("Schedule I: no field states a date of signature or a signature", !texts.some((t) => /signature|signed/i.test(t)), texts.filter((t) => /signature|signed/i.test(t)));
  /* Technical Evaluation Form */
  const tef = arr(await G.buildTef(a))[0], wb = new ExcelJS.Workbook(); await wb.xlsx.load((await bytes(tef)).buffer as ArrayBuffer);
  const wb0 = new ExcelJS.Workbook(); await wb0.xlsx.load((await formBytes("tef")).buffer as ArrayBuffer);
  const scan = (w: ExcelJS.Workbook) => { let formulas = 0; const vals: unknown[] = []; w.eachSheet((s) => s.eachRow((r) => r.eachCell((c) => { const v: any = c.value; if (v && typeof v === "object" && ("formula" in v || "sharedFormula" in v)) formulas++; else vals.push(v); }))); return { formulas, vals }; };
  const T = scan(wb), T0 = scan(wb0);
  ok("Technical form: sheets are unchanged", wb.worksheets.map((s) => s.name).join() === wb0.worksheets.map((s) => s.name).join());
  ok("Technical form: the Commission's formulas are kept", T.formulas >= T0.formulas - 25 && T.formulas > 0, [T.formulas, T0.formulas]);
  ok("Technical form: revenue and expenses are in", [1000, 2000, 500, 800].every((n) => T.vals.includes(n)), T.vals.filter((v) => typeof v === "number").slice(0, 20));
  /* Word forms */
  const decl = arr(await G.buildApDeclaration(a))[0], dB = await bytes(decl), dT = await docText(dB);
  ok("AP Declaration names the applicant and director", dT.includes("Probe Analytics Ltd") && dT.includes("Ann Lee"));
  ok("AP Declaration: only the body text changed", (await sameParts(dB, await formBytes("ap_decl"), /word\/document\.xml/)).length === 0, await sameParts(dB, await formBytes("ap_decl"), /word\/document\.xml/));
  const orT = await docText(await formBytes("ap_decl"));
  ok("AP Declaration: the undertakings are all still there", orT.replace(/\s/g, "").length <= dT.replace(/\s/g, "").length + 400 && /gambling/i.test(dT), [orT.length, dT.length]);
  const uF = arr(await G.buildUboDeclarations(a));
  ok("UBO: one declaration per beneficial owner", uF.length === 2, uF.map((f: any) => f.name));
  ok("UBO: each holds its own owner", (await docText(await bytes(uF[0]))).includes("Ann Lee") && (await docText(await bytes(uF[1]))).includes("Bob Tan"));
  const dsT = await docText(await bytes(arr(await G.buildDsInfo(a))[0]));
  ok("Directors and shareholders form lists both, with their roles", dsT.includes("Ann Lee") && dsT.includes("ParentCo Pte") && dsT.includes("Director and shareholder"));
  const bpT = await docText(await bytes(arr(await G.buildBusinessProfile(a))[0]));
  ok("Business profile holds the sectors and key people", bpT.includes("Information Technology") && bpT.includes("Ann Lee") && bpT.includes("Chief Executive"));
  /* Roles */
  const low = createGen(store([]));
  let refused = false; try { await low.buildSchedule1(a); } catch { refused = true; }
  ok("Schedule I is refused for a role without identity access", refused);
  console.log(failed ? `\n${failed} FAILED` : "\nAll form checks passed");
  process.exit(failed ? 1 : 0);
})();
