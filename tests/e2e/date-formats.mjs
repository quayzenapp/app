import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { markedPack, markedForm } from "./form-marks.mjs";

export async function testDateFormats({ admin, approver, finance, other, check, S }) {
  const BASE = "http://localhost:3000", p = admin.page;
  const go = async (page, path) => { await page.goto(BASE + path, { waitUntil: "networkidle" }); await page.waitForTimeout(500); };
  const action = async (page, button) => {
    const response = page.waitForResponse(r => r.request().method() === "POST" && r.request().headers()["next-action"]);
    await page.click(`button:text-is("${button}"):visible`); await response;
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(b => b.disabled && b.innerText.includes("Working")));
  };
  async function settings(defaultFormat, fields = {}) {
    await go(p, "/admin/settings");
    await p.selectOption('select[name="defaultFormat"]', defaultFormat);
    for (const select of await p.locator('select[name^="dateFormat:"]').all()) await select.selectOption("");
    for (const [key, value] of Object.entries(fields)) await p.selectOption(`select[name="dateFormat:${key}"]`, value);
    const captured = p.waitForRequest(r => r.method() === "POST" && r.headers()["next-action"]);
    await action(p, "Save date formats");
    const request = await captured;
    check("date control save succeeds", (await p.locator('form > .banner.info').innerText()).includes("date formats saved"));
    await p.waitForFunction(({ defaultFormat, fields }) => document.querySelector('select[name="defaultFormat"]')?.value === defaultFormat && [...document.querySelectorAll('select[name^="dateFormat:"]')].every(e => e.value === (fields[e.name.slice(11)] ?? "")), { defaultFormat, fields });
    check("saved date choices stay visible after success without reload", (await p.inputValue('select[name="defaultFormat"]')) === defaultFormat);
    return request;
  }
  async function noticePack(base) {
    const r = await admin.ctx.request.get(BASE + base + "/forms");
    if (r.status() !== 200) throw new Error(await r.text());
    return JSZip.loadAsync(await r.body());
  }
  const pdfFromPack = async (z, key) => (await PDFDocument.load(await z.file(Object.keys(z.files).find(n => n.includes(key))).async("uint8array"))).getForm();
  async function appPdf(base) {
    const r = await admin.ctx.request.get(BASE + base + "/forms/s1"); if (r.status() !== 200) throw new Error(await r.text());
    await markedForm(await r.body(), "application.pdf", r.headers()["content-disposition"].includes("DRAFT") ? "DRAFT / DEMO" : "DEMO");
    return (await PDFDocument.load(await r.body())).getForm();
  }
  await go(finance.page, "/admin/settings");
  check("lower role cannot open date controls by direct URL", (await finance.page.locator('body').innerText()).includes("Forbidden") || finance.page.url().includes("forbidden"));
  const captured = await settings("DD/MM/YY");
  const forged = await finance.ctx.request.post(captured.url(), { headers: { "next-action": captured.headers()["next-action"], "content-type": captured.headers()["content-type"], origin: BASE }, data: captured.postDataBuffer(), maxRedirects: 0 });
  check("lower role cannot invoke the date settings action directly", (forged.headers()["x-action-redirect"] ?? forged.headers().location ?? "").includes("forbidden"));
  await go(other.page, "/admin/settings?organizationId=forged");
  check("another tenant still has its own four-digit default and unset offshore field", (await other.page.inputValue('select[name="defaultFormat"]')) === "DD/MM/YYYY" && (await other.page.inputValue('select[name="dateFormat:o3:arc.date"]')) === "");
  await go(p, "/admin/settings");
  check("default change persisted without implicitly setting arc.date", (await p.inputValue('select[name="defaultFormat"]')) === "DD/MM/YY" && (await p.inputValue('select[name="dateFormat:o3:arc.date"]')) === "");
  check("admin sees the original offshore label and PDF field", (await p.locator('body').innerText()).includes("the form asks for DD/MM/YY") && (await p.locator('body').innerText()).includes("Text43"));
  // Invalid values are rejected by the server and entered controls survive the error.
  await p.locator('select[name="defaultFormat"]').evaluate(e => e.add(new Option("invalid", "MM/DD/YYYY")));
  await p.selectOption('select[name="defaultFormat"]', "MM/DD/YYYY"); await action(p, "Save date formats");
  check("invalid date format is refused without wiping entered controls", (await p.locator('form > .banner.bad').innerText()).includes("invalid") && (await p.inputValue('select[name="defaultFormat"]')) === "MM/DD/YYYY");
  await go(p, "/changes"); await p.fill('input[name="title"]', "E2E date format notice"); await p.click('button:text-is("Start")'); await p.waitForURL(/\/changes\/[^/?]+$/); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500);
  const notice = p.url().replace(BASE, "");
  await p.selectOption('select[name="newcode"]', "A"); await action(p, "Save notice");
  await p.fill('textarea[name="i.0.former"]', "Former company"); await p.fill('textarea[name="i.0.new"]', "New company"); await p.fill('input[name="i.0.date"]', "2026-11-01");
  await p.check('input[name="offshore"]'); await p.click('summary:text-is("Offshore Form III particulars")'); await p.fill('input[name="o3.arc.date"]', "2026-11-01"); await p.fill('input[name="o3.appoint.date"]', "2026-11-02"); await p.fill('input[name="o3.pc.date"]', "2026-11-03"); await action(p, "Save notice");
  const blocked = await admin.ctx.request.get(BASE + notice + "/forms");
  check("organization default cannot unblock arc.date", blocked.status() === 422 && (await blocked.text()).includes("Admin > Controls"));
  await settings("DD/MM/YY", { "o3:arc.date": "DD/MM/YY", "s3:Text377": "DD/MM/YYYY" });
  await p.screenshot({ path: `${S}/date-format-controls.png`, fullPage: true });
  await p.locator('fieldset:has(select[name="dateFormat:o3:arc.date"])').screenshot({ path: `${S}/date-format-offshore.png` });
  await p.locator('select[name="defaultFormat"]').screenshot({ path: `${S}/date-format-default.png` });
  let z = await noticePack(notice), off = await pdfFromPack(z, "Form_III"), s3 = await pdfFromPack(z, "Schedule_III");
  check("two-digit offshore dates read back and Schedule III field override wins", off.getTextField("Text43").getText() === "01/11/26" && off.getTextField("Text22").getText() === "02/11/26" && s3.getTextField("Text377").getText() === "01/11/2026");
  check("separate day/month/year boxes retain a four-digit year", off.getTextField("Text76").getText() === "03" && off.getTextField("Text78").getText() === "11" && off.getTextField("Text77").getText() === "2026");
  check("newly formatted notice drafts retain marks", await markedPack(z, "DRAFT / DEMO"));
  await go(p, notice); check("stored and on-screen date values remain ISO", (await p.inputValue('input[name="o3.arc.date"]')) === "2026-11-01" && (await p.inputValue('input[name="i.0.date"]')) === "2026-11-01");
  await p.click('summary:text-is("Mark ready for review")'); await action(p, "Record Ready for review");
  await go(approver.page, notice); await approver.page.click('summary:text-is("Approve")'); approver.page.once("dialog", d => d.accept()); await action(approver.page, "Record Approved");
  check("configured arc.date permits second-person approval", (await approver.page.locator('.head .badge').innerText()) === "Approved");
  const noticeHistory = await approver.page.locator('body').innerText();
  // Prepare a new application while the organization default is two-digit years.
  await go(p, "/apply"); await p.selectOption('select[name="app_type"]', "Authorised Person only"); await p.fill('input[name="title"]', "E2E date format application"); await p.click('button:text-is("Start")'); await p.waitForURL(/\/apply\/[^/?]+\?step=applicant$/); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500);
  const app = p.url().replace(BASE, "").split("?")[0];
  await p.selectOption('select[name="origin"]', "Foreign"); await p.selectOption('select[name="legal"]', "Company"); await p.fill('input[name="p1.name"]', "E2E Dates Applicant"); await action(p, "Save");
  await go(p, app + "?step=people&person=new"); await p.selectOption('select[name="kind"]', "Individual"); await p.fill('input[name="name"]', "E2E Date Director"); await p.check('input[name="roles"][value^="Director"]'); await p.check('input[name="roles"][value^="Shareholder"]'); await p.fill('input[name="dob"]', "2000-02-29"); await p.click('button:text-is("Save")'); await p.waitForURL(/step=people$/); await p.waitForLoadState("networkidle");
  check("application draft uses the organization's two-digit format", (await appPdf(app)).getTextField("Text309").getText() === "29/02/00");
  await go(p, app); await p.click('summary:has-text("Mark ready for review")'); await action(p, "Save");
  await go(approver.page, app); approver.page.once("dialog", d => d.accept()); await action(approver.page, "Approve for submission");
  check("application approval keeps a fixed copy with date formats", (await approver.page.locator('.head .badge').innerText()) === "Approved for submission");
  await settings("DD/MM/YYYY", { "o3:arc.date": "DD/MM/YYYY" });
  z = await noticePack(notice); off = await pdfFromPack(z, "Form_III");
  check("approved notice keeps its two-digit dates after settings change", off.getTextField("Text43").getText() === "01/11/26" && off.getTextField("Text22").getText() === "02/11/26");
  check("approved notice keeps DEMO and no DRAFT", await markedPack(z, "DEMO"));
  check("approved application keeps its two-digit date after settings change", (await appPdf(app)).getTextField("Text309").getText() === "29/02/00");
  await go(approver.page, notice); check("format settings do not alter the notice approval fingerprint", (await approver.page.locator('body').innerText()).includes(noticeHistory.match(/fingerprint [a-f0-9]+/)?.[0] ?? "MISSING FINGERPRINT"));
  await go(other.page, "/admin/settings"); check("another tenant remains unchanged after both format updates", (await other.page.inputValue('select[name="defaultFormat"]')) === "DD/MM/YYYY" && (await other.page.inputValue('select[name="dateFormat:o3:arc.date"]')) === "");
  await go(p, "/admin/audit"); check("date setting changes are audited", (await p.locator('body').innerText()).includes("Official form date formats updated"));
  await settings("DD/MM/YYYY");
}

if (process.argv[1]?.endsWith("/date-formats.mjs")) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(); let failures = 0;
  const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failures++; };
  async function session(email) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage();
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" }); await page.fill("#username", email); await page.fill("#password", "Demo@12345"); await page.click("#kc-login"); await page.waitForURL("**/dashboard"); return { ctx, page };
  }
  try {
    await testDateFormats({ admin: await session("admin@demo.test"), approver: await session("platform@quayzen.test"), finance: await session("finance@demo.test"), other: await session("admin@harbourline.test"), check, S: process.argv[2] });
    console.log(`${failures} date workflow failure(s)`);
    process.exitCode = failures ? 1 : 0;
  } finally { await browser.close(); }
}
