import { testDateFormats } from "./date-formats.mjs";
import { markedPack } from "./form-marks.mjs";
import { testApplicationTables } from "./lic-tables.mjs";
// Wait for the actual action response and committed UI, including repeated equal success messages.
async function submit(page, selector) {
  const noticeInput = selector.includes("Save notice") ? await page.locator('select[name="newcode"]').elementHandle() : null;
  const response = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"], { timeout: 30000 });
  await page.click(selector); await response;
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].some((b) => b.disabled && /Working|Importing/.test(b.innerText)), null, { timeout: 30000 });
  if (noticeInput) await page.waitForFunction((old) => !old.isConnected, noticeInput, { timeout: 30000 });
  await page.waitForTimeout(100);
}
export async function repeatedSaves(p, check, S, addPage) {
  await p.goto("http://localhost:3000/changes", { waitUntil: "networkidle" }); await p.waitForTimeout(500);
  await p.fill('input[name="title"]', `E2E repeated notice ${Date.now()}`); await p.click('button:text-is("Start")'); await p.waitForURL(/\/changes\/[^/?]+$/); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500);
  const save = () => submit(p, 'button:text-is("Save notice")');
  const rows = () => p.locator('textarea[name^="i."][name$=".new"]').evaluateAll((es) => es.map((e) => e.value));
  for (let i = 0; i < 2; i++) { await p.selectOption('select[name="newcode"]', "F"); await save(); }
  check("two F adds clear the select after both successes without reload", (await rows()).length === 2 && (await p.inputValue('select[name="newcode"]')) === "", JSON.stringify({ rows: await rows(), select: await p.inputValue('select[name="newcode"]'), banner: await p.locator('form .banner').allInnerTexts() }));
  await save(); check("plain repeated save never adds a third row", (await rows()).length === 2, JSON.stringify(await rows()));
  await p.fill('textarea[name="i.0.new"]', "First member"); await p.fill('textarea[name="i.1.new"]', "Second member"); await p.check('input[name="remove:0"]'); await save();
  check("removal shows the surviving row and clears the checkbox without reload", JSON.stringify(await rows()) === '["Second member"]' && !(await p.isChecked('input[name="remove:0"]')));
  await save(); const screen = await rows();
  // Background requests can keep a production page busy after navigation. Read the rendered row before comparing persisted data.
  await p.reload({ waitUntil: "domcontentloaded" }); await p.locator('textarea[name="i.0.new"]').waitFor({ state: "visible" });
  check("a following plain save keeps the row and screen equals persisted data", JSON.stringify(screen) === '["Second member"]' && JSON.stringify(await rows()) === JSON.stringify(screen));
  await p.screenshot({ path: `${S}/changes-repeat-save.png` });
  await addPage.goto("http://localhost:3000/admin/organizations", { waitUntil: "networkidle" }); await addPage.waitForTimeout(500);
  for (let i = 0; i < 2; i++) {
    await addPage.fill('input[name="name"]', `E2E Org repeated save ${Date.now()} ${i}`);
    await submit(addPage, 'button:text-is("Create organization")');
    await addPage.waitForFunction(() => document.querySelector('input[name="name"]')?.value === "", null, { timeout: 30000 });
    check(`another add form clears after success ${i + 1} without reload`, (await addPage.inputValue('input[name="name"]')) === "" && (await addPage.locator('form .banner').innerText()).includes("created"));
  }
}
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
/** Shared by full and licence browser suites; no data is shared between runs. */
export async function testChanges({ admin, reviewer, finance, other, adviser, check, S }) {
  const BASE = "http://localhost:3000", p = admin.page;
  const approvalContext = await admin.ctx.browser().newContext({ viewport: { width: 1440, height: 900 } });
  const approvalPage = await approvalContext.newPage(), approver = { ctx: approvalContext, page: approvalPage };
  await approvalPage.goto(BASE + "/login", { waitUntil: "networkidle" }); await approvalPage.fill("#username", "platform@quayzen.test"); await approvalPage.fill("#password", "Demo@12345"); await approvalPage.click("#kc-login"); await approvalPage.waitForURL("**/dashboard");
  const hrContext = await admin.ctx.browser().newContext({ viewport: { width: 1440, height: 900 } }), hrPage = await hrContext.newPage(), hr = { ctx: hrContext, page: hrPage };
  await hrPage.goto(BASE + "/login", { waitUntil: "networkidle" }); await hrPage.fill("#username", "hr@demo.test"); await hrPage.fill("#password", "Demo@12345"); await hrPage.click("#kc-login"); await hrPage.waitForURL("**/dashboard");
  const go = async (page, path) => { const r = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 }); await page.waitForTimeout(500); return r; };
  const text = (page) => page.locator("body").innerText();
  const save = async (page) => { await submit(page, 'button:text-is("Save notice")'); return page.locator('form .banner').first().innerText(); };
  await repeatedSaves(p, check, S, approvalPage);
  await testApplicationTables({ admin, hr, other, check, S });
  const status = async (session, label, expected, date) => {
    await go(session.page, base); await session.page.click(`summary:text-is("${label}")`);
    if (date) await session.page.fill('details[open] input[name="date"]', date);
    if (label === "Approve") session.page.once("dialog", (d) => d.accept());
    await session.page.click(`details[open] button:text-is("Record ${expected}")`);
    await session.page.waitForFunction((status) => document.querySelector(".head .badge")?.innerText === status, expected, { timeout: 30000 });
  };
  await go(p, "/changes"); await p.fill('input[name="title"]', `E2E notice ${Date.now()}`); await p.click('button:text-is("Start")'); await p.waitForURL(/\/changes\/[^/?]+$/); await p.waitForLoadState("networkidle"); await p.waitForTimeout(800);
  const base = p.url().replace(BASE, "");
  await p.selectOption('select[name="newcode"]', "A"); await save(p); await go(p, base);
  await p.fill('textarea[name="i.0.former"]', "Former company name"); await p.fill('textarea[name="i.0.new"]', "E2E SECRET CHANGE"); await p.fill('input[name="i.0.date"]', "2026-01-31"); await p.fill('textarea[name="i.0.reason"]', "Company renamed");
  await p.check('input[name="offshore"]'); await p.click('summary:text-is("Offshore Form III particulars")'); await p.fill('input[name="o3.appoint.passport"]', "E2E-OFFSHORE-ID"); await p.fill('input[name="licence_no"]', "E2E-CHANGE-1");
  // Capture a real action call to exercise server enforcement with other sessions.
  const requestPromise = p.waitForRequest((r) => r.method() === "POST" && r.headers()["next-action"]);
  await save(p); const request = await requestPromise;
  const replay = async (s) => s.ctx.request.post(BASE + base, { headers: { "next-action": request.headers()["next-action"], "content-type": request.headers()["content-type"], origin: BASE }, data: request.postDataBuffer(), maxRedirects: 0 });
  await go(p, base); check("notice date gives the hand-worked 30-day deadline", (await text(p)).includes("2026-03-02"));
  check("the official form prevents a second A change", await p.locator('select[name="newcode"] option[value="A"]').evaluate((o) => o.disabled));
  await p.screenshot({ path: `${S}/changes-notice.png`, fullPage: true });
  await go(p, base + "?person=new"); await p.selectOption('select[name="kind"]', "Individual"); await p.fill('input[name="name"]', "E2E Filing Person"); await p.check('input[name="roles"][value^="Director"]'); await p.fill('input[name="id_no"]', "E2E-PERSON-ID"); await p.check('input[name="roles"][value^="Shareholder"]'); await p.fill('input[name="shareholding_pct"]', "10"); await p.fill('input[name="banks.0.bank"]', "E2E-HIDDEN-BANK"); await p.click('button:text-is("Save person")'); await p.waitForURL(BASE + base); await p.waitForLoadState("networkidle");
  const personHref = await p.locator('a:text-is("E2E Filing Person")').getAttribute("href");
  await go(p, base + "?person=new"); await p.selectOption('select[name="kind"]', "Corporate"); await p.fill('input[name="name"]', "E2E Corporate Member"); await p.check('input[name="roles"][value^="Shareholder"]'); await p.fill('input[name="shareholding_pct"]', "10");
  await p.fill('input[name="c_capital.0.year"]', "2025"); await p.fill('input[name="c_capital.0.capital"]', "USD 1000"); await p.click('button:text-is("Save person")'); await p.waitForURL(BASE + base); await p.waitForLoadState("networkidle");
  const corporateHref = await p.locator('a:text-is("E2E Corporate Member")').getAttribute("href"); await go(p, corporateHref);
  check("corporate member table rows persist for Schedule I Part III", (await p.inputValue('input[name="c_capital.0.capital"]')) === "USD 1000");
  await go(finance.page, personHref); check("lower role cannot receive a filing person's identity", !(await finance.page.content()).includes("E2E-PERSON-ID") && !(await finance.page.locator('input[name="id_no"]').count()));
  await finance.page.fill('input[name="name"]', "E2E Filing Person edited"); await finance.page.click('button:text-is("Save person")'); await finance.page.waitForURL(BASE + base);
  await go(p, personHref); check("editing a person's visible fields keeps hidden identity", (await p.inputValue('input[name="id_no"]')) === "E2E-PERSON-ID");
  await go(finance.page, base); check("lower role never receives free-text identity changes or offshore identity", !(await finance.page.content()).includes("E2E SECRET CHANGE") && !(await finance.page.content()).includes("E2E-OFFSHORE-ID"));
  let r = await replay(finance); check("a forged lower-role save cannot overwrite hidden fields", r.status() === 200, String(r.status()));
  await go(p, base); check("hidden change rows and offshore passport survive forged input", (await p.inputValue('textarea[name="i.0.new"]')) === "E2E SECRET CHANGE" && (await p.inputValue('input[name="o3.appoint.passport"]')) === "E2E-OFFSHORE-ID");
  r = await replay(other); check("another org cannot mutate the notice through its action", r.status() === 200 && (await r.text()).includes("no longer exists"), String(r.status()));
  await go(adviser.page, "/dashboard"); // Reset the two-org adviser's active company if another test changed it.
  const opts = await adviser.page.locator('.cosel select option').allTextContents();
  if (opts.some((x) => x.includes("Demo Company"))) { await adviser.page.selectOption('.cosel select', { label: "Demo Company" }); await adviser.page.waitForTimeout(800); }
  r = await replay(adviser); check("read-only role cannot invoke the write action directly", (r.headers()["x-action-redirect"] ?? r.headers()["location"] ?? "").includes("forbidden"), `${r.status()} ${JSON.stringify(r.headers())}`);
  await go(adviser.page, base); check("read-only direct URL shows no edit or workflow controls", !(await adviser.page.locator('button:has-text("Save notice")').count()) && !(await adviser.page.locator('summary:text-is("Mark ready for review")').count()));
  r = await go(other.page, base); check("another organization cannot open the notice by direct URL", r.status() === 404);
  r = await other.ctx.request.get(BASE + base + "/forms"); check("another organization cannot download notice forms", r.status() === 404);
  r = await finance.ctx.request.get(BASE + base + "/forms"); check("lower role cannot download hidden identity fields", r.status() === 422 && (await r.text()).includes("cannot see"));
  r = await hr.ctx.request.get(BASE + base + "/forms"); const hrError = await r.text();
  check("HR notice download refuses populated bank rows without revealing their value", r.status() === 422 && hrError.includes("banks") && !hrError.includes("E2E-HIDDEN-BANK"));
  await go(hrPage, personHref); check("HR cannot receive the notice bank table on its direct URL", !(await hrPage.content()).includes("E2E-HIDDEN-BANK") && !(await hrPage.locator('input[name="banks.0.bank"]').count()));
  const pack = async () => { const r = await admin.ctx.request.get(BASE + base + "/forms"); if (r.status() !== 200) throw new Error(await r.text()); return { r, z: await JSZip.loadAsync(await r.body()) }; };
  let output = await pack(); check("notice draft pack includes original S3, offshore III and Schedule I profiles", Object.keys(output.z.files).some((n) => n.includes("Schedule_I_Part_III")) && Object.keys(output.z.files).some((n) => n.includes("Schedule_I_Part_V")) && Object.keys(output.z.files).some((n) => n.includes("Form_III_Offshore")) && Object.keys(output.z.files).filter((n) => n !== "READ_ME.txt").every((n) => n.startsWith("DEMO_DRAFT_")));
  await go(p, base); await p.fill('input[name="o3.arc.date"]', "2026-11-01"); await save(p);
  check("notice draft PDFs and profiles have DRAFT and DEMO on every page", await markedPack(output.z, "DRAFT / DEMO"));
  r = await admin.ctx.request.get(BASE + base + "/forms"); check("unset offshore cessation date refuses delivery and points to Controls", r.status() === 422 && (await r.text()).includes("Admin > Controls"));
  await status(admin, "Mark ready for review", "Ready for review");
  await go(approvalPage, base); await approvalPage.click('summary:text-is("Approve")'); approvalPage.once("dialog", (d) => d.accept()); await approvalPage.click('button:text-is("Record Approved")'); await approvalPage.waitForSelector('details[open] .banner.bad');
  check("blocked Form III date cannot be approved or reach submission", (await text(approvalPage)).includes("Admin > Controls") && (await approvalPage.locator('.head .badge').innerText()) === "Ready for review" && !(await approvalPage.locator('summary:text-is("Record submission")').count()));
  await go(p, base); await p.fill('input[name="o3.arc.date"]', ""); await save(p);
  await go(p, base); await save(p); // Make the administrator the last editor before testing self-approval.
  await status(admin, "Mark ready for review", "Ready for review");
  await go(p, base); await p.click('summary:text-is("Approve")'); p.once("dialog", (d) => d.accept()); await p.click('button:text-is("Record Approved")'); await p.waitForSelector('details[open] .banner.bad'); check("preparer cannot approve their own notice", (await text(p)).includes("different person must approve"));
  await go(reviewer.page, base); await reviewer.page.click('summary:text-is("Approve")'); reviewer.page.once("dialog", (d) => d.accept()); await reviewer.page.click('button:text-is("Record Approved")'); await reviewer.page.waitForSelector('details[open] .banner.bad');
  check("approval is refused when the reviewer cannot see identity fields", (await text(reviewer.page)).includes("Approval needs personal and identity access"));
  await status(approver, "Approve", "Approved"); await go(p, base); check("notice approval records a fixed copy and fingerprint", (await text(p)).includes("Approved copy 1, fingerprint"));
  const approvedHr = await hr.ctx.request.get(BASE + base + "/forms"); check("approved notice copy also refuses a download that would omit hidden bank data", approvedHr.status() === 422 && (await approvedHr.text()).includes("banks"));
  let removalRequest;
  const removalChecks = new Promise((resolve) => {
    p.route(BASE + base, async (route) => {
      const req = route.request(); removalRequest = { headers: { "next-action": req.headers()["next-action"], "content-type": req.headers()["content-type"], origin: BASE }, data: req.postDataBuffer(), maxRedirects: 0 };
      const low = await finance.ctx.request.post(BASE + base, removalRequest), message = await low.text();
      check("a role cannot remove a notice person with hidden restricted fields", message.includes("Cannot remove this person") && !message.includes("E2E-PERSON-ID") && !message.includes("E2E-HIDDEN-BANK"));
      const cross = await other.ctx.request.post(BASE + base, removalRequest); check("another tenant cannot invoke notice person removal", (await cross.text()).includes("no longer exists"));
      const read = await adviser.ctx.request.post(BASE + base, removalRequest); check("read-only role cannot invoke notice person removal", (read.headers()["x-action-redirect"] ?? read.headers()["location"] ?? "").includes("forbidden"));
      await route.continue(); resolve();
    }, { times: 1 });
  });
  p.once("dialog", (d) => d.accept()); await p.locator(`div.row:has(>a[href="${personHref}"]) button:text-is("Remove person")`).click(); await removalChecks;
  await p.waitForFunction((href) => !document.querySelector(`a[href="${href}"]`), personHref);
  check("removing a person from an approved notice returns it to Draft without reload", (await p.locator('.head .badge').innerText()) === "Draft");
  await go(p, "/admin/audit"); check("notice person removal is audited without identity values", (await text(p)).includes("Person removed from notice") && !(await text(p)).includes("E2E-PERSON-ID"));
  await status(admin, "Mark ready for review", "Ready for review"); await status(approver, "Approve", "Approved"); await go(p, base);
  await p.fill('textarea[name="i.0.new"]', "Changed after approval"); await save(p); await go(p, base); check("editing approved particulars clears approval and returns to Draft", (await p.locator('.head .badge').innerText()) === "Draft");
  await status(admin, "Mark ready for review", "Ready for review"); await status(approver, "Approve", "Approved");
  await status(admin, "Record submission", "Submitted", "2026-11-03"); await go(p, base); check("submitted notice is locked", !(await p.locator('button:has-text("Save notice")').count()) && (await text(p)).includes("so it is locked"));
  r = await replay(admin); check("stale save action cannot edit a submitted notice", (await r.text()).includes("so it is locked"));
  const lockedRemoval = await admin.ctx.request.post(BASE + base, removalRequest); check("stale removal action is refused after submission", (await lockedRemoval.text()).includes("so it is locked"));
  output = await pack(); const names = Object.keys(output.z.files); const s3 = await PDFDocument.load(await output.z.file(names.find((n) => n.includes("Schedule_III"))).async("uint8array"));
  check("approved notice PDFs keep DEMO on every page", await markedPack(output.z, "DEMO"));
  check("submitted form uses the approved copy without DRAFT", !output.r.headers()["content-disposition"].includes("DRAFT") && s3.getForm().getTextField("Text376").getText() === "Changed after approval");
  await status(admin, "Record acknowledgement", "Acknowledged", "2026-11-03"); await status(admin, "Close", "Closed"); check("notice records acknowledgement and close", true); await testDateFormats({ admin, approver, finance, other, check, S }); await approvalContext.close(); await hrContext.close();
}

if (process.argv[1]?.endsWith("/changes.mjs")) {
  const { chromium } = await import("playwright"), browser = await chromium.launch(); let fails = 0;
  const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${ok ? "" : extra}`); if (!ok) fails++; };
  async function session(email) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage();
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" }); await page.fill("#username", email); await page.fill("#password", "Demo@12345"); await page.click("#kc-login"); await page.waitForURL("**/dashboard"); return { ctx, page };
  }
  const admin = await session("admin@demo.test"), reviewer = await session("reviewer@demo.test"), finance = await session("finance@demo.test"), other = await session("admin@harbourline.test"), adviser = await session("adviser@demo.test");
  await testChanges({ admin, reviewer, finance, other, adviser, check, S: process.argv[2] });
  await browser.close(); process.exitCode = fails ? 1 : 0;
}
