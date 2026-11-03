import { chromium } from "playwright";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
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

const adviser = await session("adviser@demo.test");
await go(adviser.page, "/r/employees"); check("adviser blocked from workforce", adviser.page.url().includes("forbidden"));
await go(adviser.page, "/r/ubo");
await go(adviser.page, await adviser.page.locator("tbody a").first().getAttribute("href"));
const html = await adviser.page.content();
check("restricted value never reaches the adviser's browser", !html.includes("DEMO-P123") && !html.includes("1975-04-12"));
{ const x = await adviser.ctx.request.get(BASE + "/r/ubo/export"); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await x.body()); let all = ""; wb.eachSheet((w) => w.eachRow((r) => { all += JSON.stringify(r.values); })); check("restricted values are left out of the adviser's Excel export", x.status() === 200 && all.includes("Helen Example") && !all.includes("DEMO-P123") && !all.includes("Passport number")); }
{ const x = await adviser.ctx.request.get(BASE + "/r/employees/export"); check("adviser can't export a section they can't read", x.status() === 403); }
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
console.log(fails ? `\n${fails} FAILED` : "\nAll E2E checks passed"); await browser.close(); process.exit(fails ? 1 : 0);
