import "dotenv/config";
import { db, withTenant } from "../src/lib/db";
import { buildRecord, getForm, getLookups, stripSensitive } from "../src/lib/forms";
import { can } from "../src/lib/rbac";

/** Tenant and RBAC checks against the seeded demo data, connected as the restricted app role. */
let failed = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failed++; };

async function main() {
  const demo = await db.organization.findUniqueOrThrow({ where: { slug: "demo-company" } });
  const harbour = await db.organization.findUniqueOrThrow({ where: { slug: "harbourline" } });

  check("no tenant set: raw read of records returns nothing", (await db.record.count()) === 0);
  const a = await withTenant(demo.id, (tx) => tx.record.findMany());
  const b = await withTenant(harbour.id, (tx) => tx.record.findMany());
  check("demo org sees its own records", a.length > 0 && a.every((r) => r.organizationId === demo.id));
  check("harbourline sees only its own records", b.length > 0 && b.every((r) => r.organizationId === harbour.id));
  check("query asking for another tenant's rows returns nothing", (await withTenant(demo.id, (tx) => tx.record.findMany({ where: { organizationId: harbour.id } }))).length === 0);
  const leak = await withTenant(demo.id, (tx) => tx.record.findUnique({ where: { id: b[0].id } }));
  check("fetching another tenant's record by id returns nothing", leak === null);
  const upd = await withTenant(demo.id, (tx) => tx.record.updateMany({ where: { id: b[0].id }, data: { archivedAt: new Date() } }));
  check("updating another tenant's record changes nothing", upd.count === 0);
  let blocked = false;
  try { await withTenant(demo.id, (tx) => tx.record.create({ data: { organizationId: harbour.id, formKey: "ubo", data: {} } })); } catch { blocked = true; }
  check("inserting into another tenant is rejected", blocked);
  let auditLocked = false;
  await withTenant(demo.id, (tx) => tx.auditLog.create({ data: { organizationId: demo.id, action: "test", entityType: "isolation" } }));
  try { await withTenant(demo.id, (tx) => tx.auditLog.deleteMany({ where: { entityType: "isolation" } })); } catch { auditLocked = true; }
  check("audit log cannot be deleted by the app", auditLocked);

  const roles = await db.role.findMany({ where: { organizationId: demo.id } });
  const role = (k: string) => roles.find((r) => r.key === k)!;
  const perms = (k: string) => role(k).permissions as Record<string, string>;
  check("adviser has no workforce access but can read investment, as in the artifact matrix", !can(perms("adviser"), "workforce") && can(perms("adviser"), "investment"));
  check("hr cannot read investment; finance can approve it", !can(perms("hr"), "investment") && can(perms("finance"), "investment", "approve"));
  check("adviser cannot write obligations", !can(perms("adviser"), "obligations", "write"));
  check("only admin has settings approve", roles.filter((r) => can(r.permissions as Record<string, string>, "settings", "approve")).every((r) => r.key === "admin"));

  const ubo = (await getForm(demo.id, "ubo"))!;
  const lookups = await getLookups(demo.id);
  const raw = { full_name: "X", passport_number: "SECRET-1" };
  check("adviser does not receive sensitive UBO values", stripSensitive(ubo, raw, role("adviser").sensitive).passport_number === undefined);
  check("compliance does receive sensitive UBO values", stripSensitive(ubo, raw, role("compliance").sensitive).passport_number === "SECRET-1");
  const kept = buildRecord(ubo, { full_name: "Y", passport_number: "HACK" }, raw, role("adviser").sensitive, lookups).rec;
  check("role without access can neither overwrite nor blank a hidden value", kept.passport_number === "SECRET-1" && kept.full_name === "Y");

  const inv = (await getForm(demo.id, "investments"))!;
  const r = buildRecord(inv, { entry_date: "2026-01-01", source_name: "S", original_amount: "790", original_currency: "gbp", usd_rate: "0.79", lkr_rate: "400" }, null, role("admin").sensitive, lookups);
  check("money: 790 GBP at 0.79 per USD = 1000 USD, x400 = 316000 LKR", r.rec.usd_amount === 1000 && r.rec.lkr_amount === 316000 && r.rec.original_currency === "GBP");
  let bad: unknown = null;
  try { buildRecord(inv, { source_name: "S", original_amount: "abc", original_currency: "USD", entry_date: "x" }, null, role("admin").sensitive, lookups); } catch (e) { bad = e; }
  check("invalid number and date are reported with field names", Array.isArray(bad) && bad.length === 2);

  console.log(failed ? `\n${failed} FAILED` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
}
main();
