import { chromium } from "playwright";
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

const adviser = await session("adviser@demo.test");
await go(adviser.page, "/r/employees"); check("adviser blocked from workforce", adviser.page.url().includes("forbidden"));
await go(adviser.page, "/r/ubo");
await go(adviser.page, await adviser.page.locator("tbody a").first().getAttribute("href"));
const html = await adviser.page.content();
check("restricted value never reaches the adviser's browser", !html.includes("DEMO-P123") && !html.includes("1975-04-12"));
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
