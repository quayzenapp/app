import { markedForm } from "./form-marks.mjs";
import { testChanges } from "./changes.mjs";
import { chromium } from "playwright";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { createHash, randomBytes } from "node:crypto";
const S = process.argv[2], BASE = "http://localhost:3000"; let fails = 0;
const check = (n, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n} ${ok ? "" : extra}`); if (!ok) fails++; };
const browser = await chromium.launch();
async function session(email, password = "Demo@12345") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 90000 });
  await page.fill("#username", email); await page.fill("#password", password);
  await page.click("#kc-login"); await page.waitForURL("**/dashboard", { timeout: 90000 });
  return { ctx, page, errs };
}
const text = (p) => p.locator("body").innerText();
const go = (p, path) => p.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 });

{ const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
  await go(page, "/login");
  const fields = await page.locator("input:visible").evaluateAll((e) => e.map((x) => x.name));
  check("sign-in asks only for email and password", !fields.some((f) => /org|tenant|company/i.test(f)) && fields.includes("username") && fields.includes("password"), fields.join());
  await page.screenshot({ path: `${S}/signin.png` });
  await page.fill("#username", "admin@demo.test"); await page.fill("#password", "wrong"); await page.click("#kc-login");
  await page.waitForLoadState("networkidle"); check("wrong password is rejected", page.url().includes("8180"));
  await ctx.close(); }

const admin = await session("admin@demo.test");
let t = await text(admin.page);
check("org admin lands on their org with no org prompt", t.includes("Demo Company") && t.includes("Welcome back"));
check("7 employees, 5 Sri Lankan", /7\s*Employees today \(5 Sri Lankan, 2 other\)/.test(t), t.slice(0, 400));
const expectedDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short", year: "numeric" }).format(new Date());
check(`date follows Sri Lanka (${expectedDate})`, t.includes(expectedDate));
check("no 'Not saved' banner", !t.includes("Not saved"));
for (const [look, dark, f] of [["pencil", false, "pencil-light"], ["pro", false, "pro-light"], ["pro", true, "pro-dark"], ["pencil", true, "pencil-dark"]]) {
  await admin.page.click(`.look-seg button:has-text("${look === "pro" ? "Professional" : "Pencil"}")`);
  if ((await admin.page.evaluate(() => document.documentElement.dataset.dark === "1")) !== dark) await admin.page.click(".tgroup .iconbtn");
  await admin.page.waitForTimeout(500);
  const src = await admin.page.locator(".dock img").first().getAttribute("src");
  check(`${f}: correct icon pack`, src.includes(`${look === "pro" ? "professional" : "pencil"}-${dark ? "dark" : "light"}`), src);
  await admin.page.screenshot({ path: `${S}/${f}.png` });
}
await admin.page.click(".tgroup .iconbtn"); await admin.page.click('.look-seg button:has-text("Pencil")');
check("no broken images", (await admin.page.evaluate(() => [...document.images].filter((i) => i.complete && !i.naturalWidth).length)) === 0);
const clear = await admin.page.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 200)); const c = [...document.querySelectorAll("main .card")].pop().getBoundingClientRect(); return c.bottom <= document.querySelector(".dock").getBoundingClientRect().top; });
check("dock doesn't cover the end of the page", clear);
await go(admin.page, "/r/ubo"); t = await text(admin.page);
check("register lists own data, not another tenant's", t.includes("Helen Example") && !t.includes("Helen Tan (DEMO)"));
await go(admin.page, "/r/obligations/new");
await admin.page.click('button:has-text("Save")'); await admin.page.waitForSelector(".banner.bad");
check("validation errors appear", (await text(admin.page)).includes("is required"));
await admin.page.fill("#f_title", "kept"); await admin.page.click('button:has-text("Save")'); await admin.page.waitForFunction(() => document.querySelectorAll(".banner.bad li").length > 0, null, { timeout: 30000 }); await admin.page.waitForTimeout(1500);
check("a record form keeps what was typed after an error", (await admin.page.inputValue("#f_title")) === "kept");
await admin.page.fill("#f_title", "E2E obligation"); await admin.page.selectOption("#f_obligation_type", "Licence condition");
await admin.page.selectOption("#f_basis", "Internal good practice"); await admin.page.fill("#f_source_document", "E2E clause 1");
await admin.page.click('button:has-text("Save")'); await admin.page.waitForURL(/\/r\/obligations$/);
check("record saves", (await text(admin.page)).includes("E2E obligation"));
for (const p of ["/admin", "/admin/users", "/admin/roles", "/admin/forms", "/admin/ai/documents", "/admin/audit"]) {
  const r = await go(admin.page, p); check(`org admin opens ${p}`, r.status() === 200 && !admin.page.url().includes("forbidden"), admin.page.url());
}
check("audit shows the new record", (await text(admin.page)).includes("Added Obligation"));
for (const p of ["/admin/organizations", "/admin/ai/models"]) { await go(admin.page, p); check(`org admin blocked from ${p}`, admin.page.url().includes("forbidden")); }
await go(admin.page, "/ask");
await admin.page.fill(".askbar textarea", "What is the recipe for chocolate cake?"); await admin.page.click('.askbar button:has-text("Ask")');
await admin.page.waitForFunction(() => document.querySelector(".msg.ai")?.innerText.includes("couldn't find"), null, { timeout: 60000 });
check("Ask: an off-topic question says it isn't in the documents", true);
await admin.page.fill(".askbar textarea", "When is the AP licence renewal fee due?"); await admin.page.click('.askbar button:has-text("Ask")');
await admin.page.waitForFunction(() => document.querySelectorAll(".msg.ai").length === 2 && document.querySelectorAll(".msg.ai")[1].querySelector(".srcs"), null, { timeout: 90000 });
check("Ask: a real question shows sources even with no model key", (await admin.page.locator(".cite").count()) > 0);
await admin.page.screenshot({ path: `${S}/ask.png` });
check("no client errors for admin", admin.errs.length === 0, admin.errs.join(" | ").slice(0, 300));

/* ---------- annual return: prepare, second-person approval, official PDF, exports ---------- */
const reviewer = await session("reviewer@demo.test");
await go(admin.page, "/returns");
await admin.page.fill('input[name="title"]', "E2E Return"); await admin.page.click('button:has-text("Create")');
await admin.page.waitForURL(/\/returns\/[^/]+$/, { timeout: 60000 });
const retUrl = admin.page.url().replace(BASE, "");
await admin.page.click('button:has-text("Mark ready for review")'); await admin.page.waitForSelector(".banner.bad");
check("a return with unset lines can't be marked ready", (await text(admin.page)).includes("not set or missing"));
await admin.page.click('button:has-text("Use calculated values")'); await admin.page.waitForSelector(".banner.info");
await go(admin.page, retUrl); t = await text(admin.page);
check("revenue comes from demo records", t.includes("United Kingdom: USD 465,000.00"), t.slice(0, 300));
check("capital expenditure comes from demo records", t.includes("62,000.00"));
check("7 employees split 5 and 2 from the register", /No\. of employees - Sri Lankan[\s\S]{0,120}5/.test(t) && /No\. of employees - Non-Sri Lankan[\s\S]{0,120}2/.test(t));
const unset = await admin.page.locator("tr:has(.badge:text-is('Not set')) a.btn").evaluateAll((a) => a.map((x) => x.getAttribute("href")));
for (const h of unset) {
  await go(admin.page, h);
  const na = admin.page.locator('input[value="not_applicable"]'), conf = admin.page.locator('input[value="conf_yes"]');
  if (await conf.count()) await conf.check(); else await na.check();
  if (await admin.page.locator("#ex").count()) await admin.page.fill("#ex", "E2E test");
  await admin.page.click('button:has-text("Save line")'); await admin.page.waitForURL("**" + retUrl, { timeout: 30000 });
}
const draftPdf = await admin.ctx.request.get(BASE + retUrl + "/pdf"); check("draft annual return has DRAFT and DEMO on every page", await markedForm(await draftPdf.body(), "return.pdf", "DRAFT / DEMO"));
await admin.page.click('button:has-text("Mark ready for review")'); await admin.page.waitForFunction(() => document.querySelector(".head .badge")?.innerText === "Ready for review", null, { timeout: 30000 });
check(`all ${unset.length} remaining lines set; return is ready`, true);
await admin.page.click('button:has-text("Approve and keep a snapshot")'); await admin.page.waitForSelector(".banner.bad");
check("the person who prepared it can't approve it", (await text(admin.page)).includes("different person must approve"));
await go(reviewer.page, retUrl); await reviewer.page.click('button:has-text("Approve and keep a snapshot")');
await reviewer.page.waitForFunction(() => document.body.innerText.includes("Approved snapshot") || document.querySelector(".banner.bad"), null, { timeout: 30000 }).catch(() => {});
check("a second person approves and a snapshot is kept", (await text(reviewer.page)).includes("Approved snapshot"), (await reviewer.page.locator(".banner").allInnerTexts()).join(" | ").slice(0, 700).replace(/\s+/g, " "));
await go(admin.page, retUrl);
check("lines are locked after approval", (await admin.page.locator('a:has-text("Check / set")').count()) === 0);
let res = await admin.ctx.request.get(BASE + retUrl + "/pdf");
const hdr = res.headers()["content-disposition"] ?? "";
check("official PDF downloads, marked DEMO and not DRAFT", res.status() === 200 && hdr.includes("DEMO_Annual_Return") && !hdr.includes("DRAFT"), `${res.status()} ${hdr} ${res.status() === 200 ? "" : await res.text()}`);
check("approved annual return keeps DEMO on every page", await markedForm(await res.body(), "return.pdf", "DEMO"));
const pf = (await PDFDocument.load(await res.body())).getForm();
check("PDF holds the demo figures", pf.getTextField("p1_field_001").getText() === "Demo Company" && pf.getTextField("p2_field_037").getText() === "62,000.00" && pf.getTextField("p3_field_017").getText() === "5", pf.getTextField("p2_field_037").getText());
check("PDF declarations and signature are blank", !pf.getCheckBox("p4_checkbox_01").isChecked() && !pf.getTextField("p4_field_015").getText());
for (const [f, sig] of [["xlsx", "PK"], ["docx", "PK"], ["pdf", "%PDF"]]) { const x = await admin.ctx.request.get(BASE + retUrl + "/report?format=" + f); check(`working report exports as ${f}`, x.status() === 200 && (await x.body()).subarray(0, sig.length).toString() === sig); }
await admin.page.fill('input[name="submission_method"]', "E2E portal"); await admin.page.click('button:has-text("Record submission")');
await admin.page.waitForFunction(() => document.querySelector(".head .badge")?.innerText === "Submitted", null, { timeout: 30000 });
check("submission is recorded, not sent", true);
await admin.page.screenshot({ path: `${S}/return.png`, fullPage: false });

/* ---------- Excel import and export ---------- */
const sheet = async (rows) => { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Data"); rows.forEach((r) => ws.addRow(r)); return Buffer.from(await wb.xlsx.writeBuffer()); };
const up = async (buf) => { await go(admin.page, "/r/fin_entries"); await admin.page.click("details summary"); await admin.page.setInputFiles('input[type="file"]', { name: "e2e.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: buf }); await admin.page.click('button:has-text("Import")'); await admin.page.waitForSelector(".banner", { state: "visible" }); await admin.page.waitForSelector("details .banner", { timeout: 30000 }); return admin.page.locator("details .banner").first().innerText(); };
const H = ["Date (or period end)", "Annual return category", "Description", "Original amount", "Original currency"];
t = await up(await sheet([H, [new Date("2026-01-05"), "Revenue", "E2E import", 100, "USD"], ["2026-01-06", "Not a category", "E2E import", "abc", "USD"]]));
check("a bad row stops the whole import and names the row", t.includes("Nothing was imported") && t.includes("Row 3"), t);
t = await up(await sheet([H, [new Date("2026-01-05"), "Revenue", "E2E import", 100, "USD"]]));
check("a good file imports", t.includes("1 record(s) imported"), t);
check("imported figures are calculated", /E2E import/.test(await text(admin.page)));
res = await admin.ctx.request.get(BASE + "/r/fin_entries/export"); check("register exports to Excel", res.status() === 200 && (await res.body()).subarray(0, 2).toString() === "PK");

/* ---------- documents: real files, versions, restricted access ---------- */
const hash = (b) => createHash("sha256").update(b).digest("hex");
const bigPdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(2 * 1024 * 1024)]);
const bannerText = async (p) => { await p.waitForFunction((n) => document.querySelector(".card form .banner"), null, { timeout: 60000 }); return p.locator(".card form .banner").first().innerText(); };
const pick = (p, name, mimeType, buffer) => p.setInputFiles('input[type="file"]', { name, mimeType, buffer });
await go(admin.page, "/documents"); t = await text(admin.page);
check("documents list shows seeded documents", t.includes("AP licence certificate (demo)") && t.includes("Signed UBO declaration (demo)"));
await admin.page.screenshot({ path: `${S}/documents.png` });
await go(admin.page, "/documents/new");
await admin.page.fill("#d_t", "E2E passport copy"); await admin.page.selectOption("#d_c", "Passports and IDs"); await admin.page.selectOption("#d_a", "Normal");
await admin.page.click('button:has-text("Save")'); await admin.page.waitForURL(/\/documents\/(?!new)[^/]+$/, { timeout: 60000 });
const restrictedUrl = admin.page.url().replace(BASE, "");
check("a passport category is always restricted, whatever is chosen", (await text(admin.page)).includes("Restricted"));
await pick(admin.page, "passport.pdf", "application/pdf", bigPdf); await admin.page.click('button:has-text("Upload the file")');
t = await bannerText(admin.page); check("a 2 MB file uploads (over the 1 MB default limit)", t.includes("Version 1 uploaded"), t);
await go(admin.page, restrictedUrl);
const v1 = await admin.page.locator('a:has-text("passport.pdf")').first().getAttribute("href");
res = await admin.ctx.request.get(BASE + v1);
check("the download matches the upload byte for byte", res.status() === 200 && hash(await res.body()) === hash(bigPdf), String(res.status()));
const h = res.headers();
check("files always download, and can't run on our site", h["content-disposition"].startsWith("attachment") && h["x-content-type-options"] === "nosniff" && (h["content-security-policy"] ?? "").includes("sandbox"));
await pick(admin.page, "passport-v2.pdf", "application/pdf", Buffer.from("%PDF-1.7 version two")); await admin.page.fill('input[name="note"]', "Renewed"); await admin.page.click('button:has-text("Upload a new version")');
t = await bannerText(admin.page); check("a new version is added", t.includes("Version 2 uploaded"), t);
await go(admin.page, restrictedUrl); t = await text(admin.page);
await admin.page.screenshot({ path: `${S}/document.png` });
check("both versions are kept, newest first", t.indexOf("v2") < t.indexOf("v1") && t.includes("passport.pdf") && t.includes("Renewed"));
check("the earlier version still downloads", hash(await (await admin.ctx.request.get(BASE + v1)).body()) === hash(bigPdf));
await pick(admin.page, "invoice.pdf", "application/pdf", Buffer.from("MZ this is a program")); await admin.page.click('button:has-text("Upload a new version")');
t = await bannerText(admin.page); check("a program renamed to .pdf is refused", t.includes("contents don't match"), t);
await go(admin.page, restrictedUrl); await pick(admin.page, "page.html", "text/html", Buffer.from("<script>alert(1)</script>")); await admin.page.click('button:has-text("Upload a new version")');
t = await bannerText(admin.page); check("a web page is refused", t.includes("can't be stored"), t);
await go(admin.page, restrictedUrl); await pick(admin.page, "huge.pdf", "application/pdf", Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(21 * 1024 * 1024)])); await admin.page.click('button:has-text("Upload a new version")');
t = await bannerText(admin.page); check("a file over 20 MB is refused", t.includes("up to 20 MB"), t);
await go(admin.page, "/r/licences"); await go(admin.page, await admin.page.locator("tbody a").first().getAttribute("href"));
t = await text(admin.page); check("a record shows its linked documents", t.includes("AP licence certificate (demo)"));
await admin.page.click('a:has-text("Add a document")'); await admin.page.waitForSelector("#d_t");
await admin.page.fill("#d_t", "E2E linked doc"); await admin.page.selectOption("#d_c", "AP and BSI approvals"); await admin.page.fill("#d_e", new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10));
await admin.page.click('button:has-text("Save")'); await admin.page.waitForURL(/\/documents\/(?!new)[^/]+$/, { timeout: 60000 });
check("a document can be linked from its record", (await text(admin.page)).includes("Licence or approval: Authorised Person licence"));
await go(admin.page, "/dashboard"); check("expiring documents appear on the dashboard", (await text(admin.page)).includes("E2E linked doc"));
admin.page.once("dialog", (d) => d.accept());
await go(admin.page, "/documents"); await admin.page.click('a:has-text("E2E linked doc")'); await admin.page.waitForURL(/\/documents\/(?!new)[^/]+$/); await admin.page.click('button:has-text("Archive")'); await admin.page.waitForURL(/\/documents$/, { timeout: 30000 });
check("archiving hides a document", !(await text(admin.page)).includes("E2E linked doc"));

const finance = await session("finance@demo.test");
await go(finance.page, "/documents"); t = await text(finance.page);
check("a role without identity access can't see restricted documents", t.includes("AP licence certificate") && !t.includes("E2E passport copy") && !t.includes("Signed UBO") && t.includes("restricted document(s) are hidden"));
res = await finance.ctx.request.get(BASE + restrictedUrl); check("... nor open one by its address", res.status() === 404, String(res.status()));
res = await finance.ctx.request.get(BASE + v1); check("... nor download its file by its address", res.status() === 404, String(res.status()));
await go(finance.page, "/documents/new");
check("... nor pick a restricted category", (await finance.page.locator('#d_c option:has-text("Passports")').count()) === 0 && (await finance.page.locator('#d_a option:has-text("Restricted")').count()) === 0);
const other = await session("admin@harbourline.test");
res = await other.ctx.request.get(BASE + restrictedUrl); check("another organization's admin can't open it", res.status() === 404, String(res.status()));
res = await other.ctx.request.get(BASE + v1); check("... nor download its file", res.status() === 404, String(res.status()));
{ const anon = await browser.newContext(); const r = await anon.request.get(BASE + v1, { maxRedirects: 0 }); check("signed-out visitors get no file", r.status() !== 200, String(r.status())); await anon.close(); }

await go(admin.page, "/admin/ai/documents");
await admin.page.fill("#d_title", "E2E large AI doc"); await admin.page.setInputFiles("#d_file", { name: "large.txt", mimeType: "text/plain", buffer: Buffer.from("The Port City licence renewal notice applies to E2E zebra harbour rules. ".repeat(16000)) });
await admin.page.click('button:has-text("Upload")'); await admin.page.waitForSelector(".card form .banner", { timeout: 60000 });
t = await admin.page.locator(".card form .banner").first().innerText(); check("an AI document over 1 MB uploads", t.includes("Uploaded"), t);
// Large-document ingestion can exceed 150 seconds on a busy local worker; still require ready.
let aiStatus = ""; for (let i = 0; i < 60 && !["ready", "failed"].includes(aiStatus); i++) { await admin.page.waitForTimeout(5000); await go(admin.page, "/admin/ai/documents"); aiStatus = (await admin.page.locator('tr:has-text("E2E large AI doc") .badge').last().innerText().catch(() => "")).trim(); }
check("it is processed", aiStatus === "ready", aiStatus);
admin.page.once("dialog", (d) => d.accept());
await admin.page.locator('tr:has-text("E2E large AI doc") button:has-text("Delete")').click();
await admin.page.waitForFunction(() => !document.body.innerText.includes("E2E large AI doc"), null, { timeout: 30000 });
check("delete asks first, then removes it", true);

/* ---------- business plan and budget ---------- */
await go(admin.page, "/dashboard"); t = await text(admin.page);
check("the dashboard shows budget and plan cards", t.includes("Budget 2026/27 (demo)") && t.includes("Business plan vs actual") && t.includes("Employees (total)"));
await admin.page.screenshot({ path: `${S}/dash-plan.png`, fullPage: true });
await go(admin.page, "/bplan"); t = await text(admin.page);
check("the seeded plan is the reference, with plan vs actual", t.includes("Reference") && t.includes("Current plan year") && t.includes("Plan vs actual"));
await admin.page.screenshot({ path: `${S}/bplan.png`, fullPage: true });
await admin.page.click('button:has-text("Record another plan version")'); await admin.page.waitForURL(/\/bplan\/[^/]+\/edit$/, { timeout: 60000 });
const planEdit = admin.page.url().replace(BASE, ""), planUrl = planEdit.replace("/edit", "");
await admin.page.fill("#p_t", "E2E plan"); await admin.page.fill('input[name="y0_fdi_usd"]', "abc");
await admin.page.click('button:has-text("Save draft")'); await admin.page.waitForSelector(".banner.bad", { timeout: 30000 });
check("a non-number in the plan is refused and named", (await text(admin.page)).includes("year 1: please enter a number"));
check("a failed save keeps everything that was typed", (await admin.page.inputValue("#p_t")) === "E2E plan" && (await admin.page.inputValue('input[name="y0_fdi_usd"]')) === "abc");
await admin.page.fill('input[name="y0_fdi_usd"]', "123456"); await admin.page.fill("#p_m", "E2E milestone ; 2027-01-01");
await admin.page.click('button:has-text("Save draft")'); await admin.page.waitForURL("**" + planUrl, { timeout: 60000 });
check("the draft saves", (await text(admin.page)).includes("123,456"));
await admin.page.click('button:has-text("Ask for a check")'); await admin.page.waitForSelector(".banner.bad", { timeout: 30000 });
check("a plan needs its Year 1 date before a check", (await text(admin.page)).includes("Set the Year 1 start date"));
res = await admin.ctx.request.get(BASE + "/bplan/template");
const tw = new ExcelJS.Workbook(); await tw.xlsx.load(await res.body());
{ const ws = tw.getWorksheet("Business plan figures"); ws.eachRow((r) => { const l = String(r.getCell(1).value ?? ""); if (l === "FDI (USD) - funds raised outside Sri Lanka") { r.getCell(2).value = 777000; r.getCell(3).value = "not a number"; } if (l === "Local employees") r.getCell(2).value = 12; if (l.startsWith("Year 1 starts")) r.getCell(2).value = "2025-04-01"; }); }
await go(admin.page, planEdit); await admin.page.click("details summary");
await admin.page.setInputFiles('details input[type="file"]', { name: "plan.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await tw.xlsx.writeBuffer()) });
await admin.page.click('button:has-text("Import figures")'); await admin.page.waitForSelector("details .banner", { timeout: 60000 });
t = await admin.page.locator("details .banner").first().innerText();
check("the template imports and reports what it skipped", t.includes("figures imported") && t.includes("not a number"), t);
check("a wrong file is refused rather than guessed", true);
await go(admin.page, planEdit); check("imported figures are in the form", (await admin.page.inputValue('input[name="y0_fdi_usd"]')) === "777000" && (await admin.page.inputValue("#p_y")) === "2025-04-01");
await go(admin.page, planUrl);
await admin.page.click('button:has-text("Ask for a check")'); await admin.page.waitForSelector('button:has-text("Checked against the plan")', { timeout: 30000 });
await admin.page.click('button:has-text("Checked against the plan")'); await admin.page.waitForSelector(".banner.bad", { timeout: 30000 });
check("the person who entered a plan can't lock it", (await text(admin.page)).includes("different person must check and lock"));
await go(reviewer.page, planUrl); await reviewer.page.click('button:has-text("Checked against the plan")');
await reviewer.page.waitForFunction(() => document.body.innerText.includes("Fingerprint "), null, { timeout: 30000 }).catch(() => {});
await go(admin.page, planUrl); t = await text(admin.page);
check("a second person locks it, with a fingerprint", t.includes("Locked") && t.includes("Fingerprint "), t.slice(0, 500));
check("a locked plan has no Edit", (await admin.page.locator('a:has-text("Edit")').count()) === 0);
await go(admin.page, planEdit); check("nor can its edit page be opened", admin.page.url().endsWith(planUrl));
await admin.page.click('button:has-text("Check fingerprint")'); await admin.page.waitForSelector(".card form .banner", { timeout: 30000 });
check("the fingerprint checks out", (await admin.page.locator(".card form .banner").first().innerText()).includes("Fingerprint matches"));
await go(admin.page, "/bplan"); const seeded = await admin.page.locator('tr:has-text("v1") a').first().getAttribute("href");
await go(admin.page, seeded); await admin.page.click('button:has-text("Check fingerprint")'); await admin.page.waitForSelector(".card form .banner", { timeout: 30000 });
check("the seeded plan's fingerprint checks out too", (await admin.page.locator(".card form .banner").first().innerText()).includes("Fingerprint matches"));
await admin.page.selectOption('select[aria-label="Status of Reach 19 employees"]', "Delayed"); await admin.page.click('button:has-text("Save progress")'); await admin.page.waitForFunction(() => [...document.querySelectorAll(".banner")].some((b) => b.innerText.includes("Progress saved")), null, { timeout: 30000 });
check("milestone progress saves on a locked plan", true);
await go(admin.page, planUrl); await admin.page.click('button:has-text("Use this version for comparison")'); await admin.page.waitForFunction(() => document.body.innerText.includes("Used for comparison"), null, { timeout: 30000 });
await go(admin.page, "/bplan"); check("the chosen version becomes the only reference", (await admin.page.locator('tr:has(.badge:text-is("Reference"))').count()) === 1 && (await admin.page.locator('tr:has(.badge:text-is("Reference"))').first().innerText()).includes("E2E plan"), (await admin.page.locator("table").first().innerText()).replace(/\s+/g, " ").slice(0, 500));
await go(admin.page, "/bplan/compare"); t = await text(admin.page); check("versions can be compared", t.includes("FDI (USD) - funds raised outside Sri Lanka - year 1") && t.includes("777000"));
await go(admin.page, "/reports/plan_vs_actual"); t = await text(admin.page); check("the plan vs actual report now has figures", t.includes("Year 1") && t.includes("Investment (FDI, USD)") && !t.includes("No checked and locked"));
for (const [f, sig] of [["xlsx", "PK"], ["pdf", "%PDF"], ["docx", "PK"]]) { const x = await admin.ctx.request.get(`${BASE}${planUrl}/export?format=${f}`); check(`a plan exports as ${f}`, x.status() === 200 && (await x.body()).subarray(0, sig.length).toString() === sig); }
res = await other.ctx.request.get(BASE + planUrl); check("another organization can't open the plan", res.status() === 404, String(res.status()));
res = await other.ctx.request.get(`${BASE}${planUrl}/export?format=xlsx`); check("... nor export it", res.status() === 404, String(res.status()));
await go(admin.page, planUrl); await admin.page.click('button:has-text("Record a revised plan")'); await admin.page.waitForURL(/\/edit$/, { timeout: 60000 });
check("a revision starts as a new draft with the same figures", (await admin.page.inputValue('input[name="y0_fdi_usd"]')) === "777000" && !admin.page.url().includes(planUrl));

await go(admin.page, "/budget"); t = await text(admin.page);
check("the demo budget shows budget, actuals and charts", t.includes("Annual spending budget") && t.includes("Budget to date") && t.includes("Month by month") && (await admin.page.locator(".cc.pc, .hb, svg.lc").count()) >= 3);
await admin.page.screenshot({ path: `${S}/budget.png`, fullPage: true });
await admin.page.click('a.btn:text-is("LKR")'); await admin.page.waitForURL(/cur=LKR/, { timeout: 30000 }); await admin.page.waitForFunction(() => document.querySelector(".stats.hlc .stat b")?.innerText.startsWith("LKR"), null, { timeout: 30000 }).catch(() => {});
check("figures can be viewed in another currency", (await admin.page.locator(".stats.hlc .stat b").first().innerText()).startsWith("LKR"));
await admin.page.click("details summary"); await admin.page.fill("#b_t", "E2E budget"); await admin.page.fill("#b_f", "2030-04-01"); await admin.page.fill("#b_c", "12"); await admin.page.click('button:has-text("Create")'); await admin.page.waitForSelector("details .banner.bad", { timeout: 30000 });
check("a bad currency is refused", (await text(admin.page)).includes("three-letter"));
check("the other fields survive the error", (await admin.page.inputValue("#b_t")) === "E2E budget" && (await admin.page.inputValue("#b_f")) === "2030-04-01");
await admin.page.fill("#b_c", "usd"); await admin.page.click('button:has-text("Create")'); await admin.page.waitForURL(/\/budget\/[^/]+\/edit$/, { timeout: 60000 });
const budEdit = admin.page.url().replace(BASE, "");
await admin.page.waitForLoadState("networkidle"); await admin.page.waitForTimeout(1500);
await admin.page.fill('input[aria-label="Office rent annual"]', "1000"); await admin.page.click('button[aria-label="Spread Office rent"]');
await admin.page.waitForFunction(() => document.querySelector('input[aria-label="Office rent Apr 30"]')?.value === "83.33", null, { timeout: 15000 });
const vals = await admin.page.locator('input[aria-label^="Office rent "]:not([aria-label$="annual"])').evaluateAll((e) => e.map((x) => Number(x.value)));
check("Spread divides evenly and the year adds up exactly", vals.length === 12 && vals[11] === 83.37 && Math.round(vals.reduce((a, b) => a + b, 0) * 100) === 100000, vals.join());
check("the spending total updates", (await admin.page.locator("#bud-tot").innerText()).includes("1,000"));
await admin.page.click('button:has-text("Save budget")'); await admin.page.waitForURL(/\/budget\?b=/, { timeout: 60000 });
const budUrl = admin.page.url().replace(BASE, ""), budId = budEdit.split("/")[2];
t = await text(admin.page); check("the budget saves", t.includes("USD 1,000") && t.includes("E2E budget"), t.slice(0, 500));
await admin.page.click('button:has-text("Ask for approval")'); await admin.page.waitForSelector('button:has-text("Approve budget")', { timeout: 30000 });
await admin.page.click('button:has-text("Approve budget")'); await admin.page.waitForSelector(".banner.bad", { timeout: 30000 });
check("the person who prepared a budget can't approve it", (await text(admin.page)).includes("different person must approve this budget"));
await go(admin.page, "/admin/settings"); admin.page.once("dialog", (d) => d.accept()); await admin.page.click('button:has-text("Turn off")'); await admin.page.waitForSelector('button:has-text("Turn on")', { timeout: 30000 });
await go(admin.page, budUrl); await admin.page.click('button:has-text("Approve budget")'); await admin.page.waitForFunction(() => document.querySelector(".ctlcard .badge.ok")?.innerText === "Approved", null, { timeout: 30000 });
check("with the control off, a one-person team can approve its own work", true);
await go(admin.page, "/admin/audit"); t = await text(admin.page);
check("the control change and the self-approval are both audited", t.includes("Second-person check turned off") && t.includes("(second-person check off)"));
{ const fin2 = await go(finance.page, "/admin/settings"); check("only administrators can change the control", finance.page.url().includes("forbidden") && fin2.status() === 200); }
await go(admin.page, "/admin/settings"); await admin.page.click('button:has-text("Turn on")'); await admin.page.waitForSelector('button:has-text("Turn off")', { timeout: 30000 });
check("the control can be turned back on", (await text(admin.page)).includes("On"));
await go(admin.page, budUrl); await admin.page.click('button:has-text("Copy to the next year")'); await admin.page.waitForFunction(() => document.body.innerText.includes("Budget 2031/32"), null, { timeout: 30000 });
check("a budget copies to the next year", true);
await go(admin.page, budUrl); await admin.page.click('button:has-text("Copy to the next year")'); await admin.page.waitForSelector(".banner.bad", { timeout: 30000 });
check("but only once", (await text(admin.page)).includes("already a budget starting"));
for (const [f, sig] of [["xlsx", "PK"], ["pdf", "%PDF"], ["docx", "PK"]]) { const x = await admin.ctx.request.get(`${BASE}/budget/${budId}/export?format=${f}`); check(`a budget exports as ${f}`, x.status() === 200 && (await x.body()).subarray(0, sig.length).toString() === sig); }
res = await other.ctx.request.get(`${BASE}/budget/${budId}/export?format=xlsx`); check("another organization can't export the budget", res.status() === 404, String(res.status()));
await go(other.page, budUrl); check("... nor see it", !(await text(other.page)).includes("E2E budget"));
check("no client errors in plan and budget", admin.errs.length === 0, admin.errs.join(" | ").slice(0, 300));

/* ---------- reports and SEZ wording ---------- */
const xlsxText = async (buf) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); let all = ""; wb.eachSheet((w) => w.eachRow((r) => { all += JSON.stringify(r.values); })); return all; };
const CODES = ["plan_vs_actual", "employees", "office_headcount", "investment", "annual_return", "requests", "obligations", "visas", "missing_docs"];
await go(admin.page, "/reports");
check("all nine reports are listed for an administrator", (await admin.page.locator("a.tile").count()) === 9);
await admin.page.screenshot({ path: `${S}/reports.png` });
for (const code of CODES) {
  const r = await go(admin.page, `/reports/${code}`);
  t = await text(admin.page);
  check(`${code}: opens with DEMO marked`, r.status() === 200 && t.includes("DEMO DATA"), String(r.status()));
  for (const [f, sig] of [["xlsx", "PK"], ["pdf", "%PDF"], ["docx", "PK"]]) { const x = await admin.ctx.request.get(`${BASE}/reports/${code}/export?format=${f}`); const b = await x.body(); check(`${code}: exports as ${f}`, x.status() === 200 && b.subarray(0, sig.length).toString() === sig && (x.headers()["content-disposition"] ?? "").includes("DEMO_"), `${x.status()} ${x.status() === 200 ? "" : b.toString().slice(0, 200)}`); }
}
await go(admin.page, "/reports/office_headcount"); await admin.page.screenshot({ path: `${S}/report.png` });
t = await xlsxText(await (await admin.ctx.request.get(`${BASE}/reports/office_headcount/export?format=xlsx`)).body());
check("office report figures from the demo", t.includes("SEZ office (demo)") && t.includes("320"));
check("reports say SEZ, not Port City", !t.includes("Port City") && t.includes("Inside SEZ"), t.slice(0, 200));
t = await xlsxText(await (await admin.ctx.request.get(`${BASE}/reports/employees/export?format=xlsx`)).body());
check("employee report leaves names out by default", !t.includes("Nimal Perera"));
t = await xlsxText(await (await admin.ctx.request.get(`${BASE}/reports/employees/export?format=xlsx&names=1`)).body());
check("names are included when asked, for a role that may see them", t.includes("Nimal Perera"));
t = await xlsxText(await (await finance.ctx.request.get(`${BASE}/reports/employees/export?format=xlsx&names=1`)).body());
check("asking for names is ignored for a role that may not see them", !t.includes("Nimal Perera"));
{ await go(finance.page, "/reports/employees"); check("that role isn't offered the option", (await finance.page.locator('input[name="names"]').count()) === 0); }
await go(admin.page, "/reports/visas?days=30"); check("a report's options work", (await text(admin.page)).includes("Expiring within 30 days"));
await go(admin.page, "/reports/not-a-report"); check("an unknown report isn't found", (await text(admin.page)).includes("404") || (await admin.page.title()).includes("404"));
t = await xlsxText(await (await other.ctx.request.get(`${BASE}/reports/office_headcount/export?format=xlsx`)).body());
check("another organization's report holds none of this organization's data", !t.includes("SEZ office (demo)") && t.includes("Harbourline"));
await go(admin.page, "/admin/audit"); check("report exports are in the audit log", (await text(admin.page)).includes("Exported employees as xlsx, with names"));

await go(admin.page, "/r/offices/new");
const optTexts = await admin.page.locator("#f_location option").allInnerTexts();
check("forms show SEZ wording", optTexts.includes("Inside SEZ") && !optTexts.join().includes("Port City"), optTexts.join());
await admin.page.fill("#f_name", "E2E office"); await admin.page.fill("#f_address", "1 Test Road"); await admin.page.selectOption("#f_location", { label: "Inside SEZ" }); await admin.page.fill("#f_floor_area", "10");
await admin.page.click('button:has-text("Save")'); await admin.page.waitForURL(/\/r\/offices(\/|$)(?!new)/, { timeout: 30000 });
t = await xlsxText(await (await admin.ctx.request.get(`${BASE}/r/offices/export`)).body());
check("the saved value is unchanged by the display wording", /E2E office.*Inside Colombo Port City/.test(t), t.slice(-400));
await go(admin.page, "/r/requests/new");
check("the Commission's own name is not reworded", (await admin.page.inputValue("#f_authority")) === "Colombo Port City Economic Commission");
check("no client errors after reports and wording", admin.errs.length === 0, admin.errs.join(" | ").slice(0, 300));

const adviser = await session("adviser@demo.test");
await go(adviser.page, "/r/employees"); check("adviser blocked from workforce", adviser.page.url().includes("forbidden"));
await go(adviser.page, "/r/ubo");
await go(adviser.page, await adviser.page.locator("tbody a").first().getAttribute("href"));
const html = await adviser.page.content();
check("restricted value never reaches the adviser's browser", !html.includes("DEMO-P123") && !html.includes("1975-04-12"));
{ const x = await adviser.ctx.request.get(BASE + "/r/ubo/export"); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await x.body()); let all = ""; wb.eachSheet((w) => w.eachRow((r) => { all += JSON.stringify(r.values); })); check("restricted values are left out of the adviser's Excel export", x.status() === 200 && all.includes("Helen Example") && !all.includes("DEMO-P123") && !all.includes("Passport number")); }
{ const x = await adviser.ctx.request.get(BASE + "/r/employees/export"); check("adviser can't export a section they can't read", x.status() === 403); }
await go(adviser.page, "/reports"); t = await text(adviser.page);
check("reports follow the role: an adviser has no employee report", !t.includes("Employee information") && t.includes("Licence and obligation status"));
await go(adviser.page, "/reports/employees"); check("... nor can they open it by address", adviser.page.url().includes("forbidden"));
{ const x = await adviser.ctx.request.get(BASE + "/reports/employees/export?format=xlsx"); check("... nor export it", x.status() === 403, String(x.status())); }
await go(adviser.page, await (async () => { await go(adviser.page, "/r/ubo"); return adviser.page.locator("tbody a").first().getAttribute("href"); })());
await go(adviser.page, "/bplan"); check("an adviser can read the plan but not change it", (await adviser.page.locator('button:has-text("Record")').count()) === 0 && (await adviser.page.locator('input[placeholder="Add an explanation"]').count()) === 0);
await go(adviser.page, await (async () => { await go(adviser.page, "/r/ubo"); return adviser.page.locator("tbody a").first().getAttribute("href"); })());
check("adviser has no Save", (await adviser.page.locator('button:has-text("Save")').count()) === 0);
await go(adviser.page, "/admin"); check("adviser blocked from admin", adviser.page.url().includes("forbidden"));
await go(adviser.page, "/dashboard");
check("two-org user can pick either organization", (await adviser.page.locator(".cosel select option").count()) === 2);
await adviser.page.selectOption(".cosel select", { label: "Harbourline Analytics (Private) Limited" });
await adviser.page.waitForFunction(() => document.querySelector(".hero h1")?.innerText.includes("Harbourline"), null, { timeout: 30000 });
await go(adviser.page, "/r/obligations"); t = await text(adviser.page);
check("after switching, only the new org's data shows", t.includes("Submit the licence application pack") && !t.includes("E2E obligation"));
await adviser.ctx.addCookies([{ name: "qz_org", value: "not-a-member-org", domain: "localhost", path: "/" }]);
await go(adviser.page, "/r/obligations"); t = await text(adviser.page);
check("tampered org cookie gives no access to another org", !adviser.page.url().includes("error") && t.length > 0);

const plat = await session("platform@quayzen.test");
for (const p of ["/admin/organizations", "/admin/ai/models", "/admin/ai/documents"]) { const r = await go(plat.page, p); check(`platform admin opens ${p}`, r.status() === 200 && !plat.page.url().includes("forbidden")); await plat.page.screenshot({ path: `${S}/adm${p.replaceAll("/", "-")}.png` }); }
await go(plat.page, "/admin/organizations");
const name = `E2E Org ${Date.now()}`; await plat.page.fill('input[name="name"]', name); await plat.page.click('button:has-text("Create organization")'); await plat.page.waitForSelector(".banner.info");
check("platform admin creates an org", (await text(plat.page)).includes(name));
await go(plat.page, "/admin/users");
const em = `e2e-${Date.now()}@demo.test`;
await plat.page.fill('input[name="name"]', "New Person"); await plat.page.fill('input[name="email"]', em); await plat.page.click('button:has-text("Add user")'); await plat.page.waitForSelector(".banner.info,.banner.bad");
t = await plat.page.locator(".banner.info,.banner.bad").first().innerText(); check("user created in Keycloak with a temporary password", t.includes("Temporary password"), t);
await plat.page.click('.tgroup button:has-text("Sign out")'); await plat.page.waitForURL(/8180/, { timeout: 30000 });
check("sign-out ends the Keycloak session too", (await plat.page.locator("#username").count()) === 1);
await testChanges({ admin, reviewer, finance, other, adviser, check, S });
console.log(fails ? `\n${fails} FAILED` : "\nAll E2E checks passed"); await browser.close(); process.exit(fails ? 1 : 0);
