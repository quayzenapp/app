import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { PrismaClient } from "../src/generated/prisma/client";
import { saveFile, sha256 } from "../src/lib/storage";
import { planHashBody } from "../src/lib/bplan";

/** Idempotent: global forms, lookups and role templates, plus two clearly marked demo organizations. */
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_OWNER_URL! }) });
const A = JSON.parse(readFileSync(new URL("./seed-data/artifact-schema.json", import.meta.url), "utf8"));
const LEVEL: Record<string, string> = { n: "none", r: "read", w: "write", a: "approve" };
const DAY = 864e5;
const d = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

const roleTemplates = Object.entries<string>(A.ROLES).map(([key, name]) => ({
  key, name, isSystem: true,
  permissions: Object.fromEntries(A.MODULES.map((m: string, i: number) => [m, LEVEL[A.PERM_CODES[key][i]]])),
  sensitive: A.SENSITIVE_ACCESS[key] as string[],
}));

async function upsertGlobalForm(r: any) {
  const data = { label: r.label, plural: r.plural, module: r.module, intro: r.intro ?? null, titleField: r.title, listFields: r.list, fields: r.fields, importable: !!r.importable, reviewable: !!r.reviewable, status: "PUBLISHED" as const };
  const row = await db.formDefinition.findFirst({ where: { organizationId: null, key: r.key } });
  if (row) await db.formDefinition.update({ where: { id: row.id }, data });
  else await db.formDefinition.create({ data: { ...data, key: r.key } });
}

async function ensureOrg(name: string, slug: string) {
  const org = await db.organization.upsert({ where: { slug }, update: { name }, create: { name, slug, isDemo: true, profile: { demo: true } } });
  for (const t of roleTemplates) {
    await db.role.upsert({ where: { organizationId_key: { organizationId: org.id, key: t.key } }, update: {}, create: { ...t, organizationId: org.id } });
  }
  return org;
}

async function ensureUser(email: string, name: string, orgId?: string, roleKey?: string, isPlatformAdmin = false) {
  const user = await db.user.upsert({ where: { email }, update: { name, isPlatformAdmin }, create: { email, name, isPlatformAdmin } });
  if (orgId && roleKey) {
    const role = await db.role.findUniqueOrThrow({ where: { organizationId_key: { organizationId: orgId, key: roleKey } } });
    await db.membership.upsert({ where: { userId_organizationId: { userId: user.id, organizationId: orgId } }, update: { roleId: role.id }, create: { userId: user.id, organizationId: orgId, roleId: role.id } });
  }
  return user;
}

async function seedRecords(orgId: string, sets: Record<string, Record<string, unknown>[]>) {
  if (await db.record.count({ where: { organizationId: orgId } })) return; // never overwrite existing data
  const ids: Record<string, string> = {};
  for (const [formKey, rows] of Object.entries(sets)) {
    for (const row of rows) {
      const { _id, _review, ...data } = row as any;
      const rec = await db.record.create({ data: { organizationId: orgId, formKey, data, reviewStatus: _review ?? null } });
      if (_id) ids[_id] = rec.id;
    }
  }
  return ids;
}

const emp = (ref: string, full_name: string, job_title: string, staff_category: string, nationality: string, grp: string, start: number) => ({ ref, full_name: `${full_name} (DEMO)`, job_title, staff_category, nationality, nationality_group: grp, worker_type: "Employee", employment_type: "Full-time permanent", status: "Active", start_date: d(start) });

async function main() {
  for (const r of Object.values(A.REG)) await upsertGlobalForm(r);
  await upsertGlobalForm({ key: "company_profile", label: "Company profile", plural: "Company profile", module: "company", title: "name", list: ["name"], fields: A.COMPANY_FIELDS });
  for (const [key, values] of Object.entries<string[]>(A.LOOKUPS)) {
    const row = await db.lookup.findFirst({ where: { organizationId: null, key } });
    if (row) await db.lookup.update({ where: { id: row.id }, data: { values } });
    else await db.lookup.create({ data: { key, values } });
  }
  for (const t of roleTemplates) {
    const row = await db.role.findFirst({ where: { organizationId: null, key: t.key } });
    if (row) await db.role.update({ where: { id: row.id }, data: t });
    else await db.role.create({ data: t });
  }

  await ensureUser("platform@quayzen.test", "Platform Admin", undefined, undefined, true);
  const demo = await ensureOrg("Demo Company", "demo-company");
  const harbour = await ensureOrg("Harbourline Analytics (Private) Limited", "harbourline");
  for (const [email, name, role] of [["admin@demo.test", "Dinithi Admin", "admin"], ["compliance@demo.test", "Chamara Compliance", "compliance"], ["hr@demo.test", "Harini HR", "hr"], ["finance@demo.test", "Farah Finance", "finance"], ["reviewer@demo.test", "Ravi Reviewer", "reviewer"], ["adviser@demo.test", "Amal Adviser", "adviser"]]) await ensureUser(email, name, demo.id, role);
  await ensureUser("admin@harbourline.test", "Helen Tan", harbour.id, "admin");
  // One person in two organizations, to exercise the switcher.
  await ensureUser("adviser@demo.test", "Amal Adviser", harbour.id, "adviser");

  await seedRecords(demo.id, {
    offices: [{ name: "SEZ office (demo)", address: "DEMO Tower 1, Port City Colombo", location: "Inside Colombo Port City", designated_status: "Not applicable", floor_area: 320, area_unit: "sqm", area_sqm: 320, area_sqft: 3444.45, measurement_basis: "Exact", seats: 24, status: "In use", in_use_from: d(-400) }],
    positions: [
      { ref: "P-01", title: "Engineering Manager", staff_category: "Management", min_experience_years: 8, languages: "English", planned_headcount: 2, status: "Active" },
      { ref: "P-02", title: "Senior Software Engineer", staff_category: "Professional", min_experience_years: 5, languages: "English", planned_headcount: 6, status: "Active" },
      { ref: "P-03", title: "Software Engineer", staff_category: "Professional", min_experience_years: 2, languages: "English", planned_headcount: 8, status: "Open - recruiting" },
      { ref: "P-04", title: "Office Administrator", staff_category: "Administrative", min_experience_years: 2, languages: "English, Sinhala", planned_headcount: 1, status: "Active" },
    ],
    employees: [
      emp("E-001", "Nimal Perera", "Engineering Manager", "Management", "Sri Lankan", "Sri Lankan", -500),
      emp("E-002", "James Carter", "Engineering Manager", "Management", "British", "Non-Sri Lankan", -480),
      emp("E-003", "Sachini Silva", "Senior Software Engineer", "Professional", "Sri Lankan", "Sri Lankan", -450),
      emp("E-004", "Wei Lim", "Senior Software Engineer", "Professional", "Singaporean", "Non-Sri Lankan", -420),
      emp("E-005", "Kasun Fernando", "Software Engineer", "Professional", "Sri Lankan", "Sri Lankan", -410),
      emp("E-006", "Tharushi Jayasuriya", "Software Engineer", "Professional", "Sri Lankan", "Sri Lankan", -400),
      emp("E-007", "Malini Wickrama", "Office Administrator", "Administrative", "Sri Lankan", "Sri Lankan", -390),
    ],
    licences: [{ licence_type: "Authorised Person licence", title: "Authorised Person licence", number: "DEMO-AP-0147", issuing_authority: "Colombo Port City Economic Commission", issue_date: d(-630), expiry_date: d(50), status: "Active", renewal_notice_days: 60 }],
    obligations: [
      { title: "Pay the annual licence renewal fee two months before expiry", obligation_type: "Law or regulation", basis: "General law or regulation - applicability confirmed", source_document: "Fees Regulations No. 2 of 2024, items 04-06 (Gazette 2387/38)", deadline: d(-10), recurrence: "Annually", status: "Not started", needs_review: "No" },
      { title: "Keep beneficial ownership information up to date", obligation_type: "Reporting deadline", basis: "Stated in our licence, approval or agreement", source_document: "Annual Return Form 2026 (supporting document 2); Form_UBO", deadline: d(20), recurrence: "Annually", status: "In progress", needs_review: "No" },
      { title: "File tax returns under the Inland Revenue Act", obligation_type: "Law or regulation", basis: "General law or regulation - applicability to be confirmed", source_document: "Section 52C, inserted by Amendment Act No. 1 of 2026", deadline: d(75), recurrence: "Annually", status: "Not started", needs_review: "Yes" },
    ],
    requests: [
      { title: "Employee information as at 30 September 2026 (demo)", category: "Employee information", authority: "Colombo Port City Economic Commission", received_date: d(-12), deadline: d(4), status: "In Progress" },
      { title: "Office space confirmation (demo)", category: "Office space and location", authority: "Colombo Port City Economic Commission", received_date: d(-3), deadline: d(25), status: "New" },
    ],
    investments: [
      { entry_date: d(-200), source_name: "Demo Parent Holdings Ltd", source_country: "Singapore", relationship: "Parent company", original_amount: 500000, original_currency: "USD", usd_rate: 1, usd_amount: 500000, conversion_method: "USD: same currency", from_outside_sl: "Yes", classification: "Equity investment", _review: "Confirmed" },
      { entry_date: d(-30), source_name: "Demo Investor Pte Ltd", source_country: "Singapore", relationship: "Shareholder", original_amount: 150000, original_currency: "USD", usd_rate: 1, usd_amount: 150000, conversion_method: "USD: same currency", from_outside_sl: "To be confirmed", classification: "Pending review", bank_reference: "DEMO-BANK-9921", _review: "Pending" },
    ],
    visas: [{ person_name: "James Carter (DEMO)", person_type: "Employee", nationality: "British", visa_category: "Residence visa - Employee", application_status: "Approved", passport_number: "DEMO-P4471", passport_expiry: d(900), approval_date: d(-300), expiry_date: d(65) }],
    people: [{ full_name: "Demo Parent Holdings Ltd", person_type: "Corporate", role: "Shareholder", nationality: "Singapore", shareholding_pct: 100, appointed_date: d(-700) }],
    ubo: [{ full_name: "Helen Example (DEMO)", nationality: "Singaporean", ownership_pct: 100, date_of_birth: "1975-04-12", passport_number: "DEMO-P123", declaration_status: "Signed copy on file" }],
  } as any);

  // Everything the 2025/26 annual return reads. Added once, and only if the demo has no financial records yet.
  if (!(await db.record.count({ where: { organizationId: demo.id, formKey: "fin_entries" } }))) {
    const office = (await db.record.findFirst({ where: { organizationId: demo.id, formKey: "offices" } }))!;
    const usd = (entry_date: string, category: string, description: string, amount: number, extra = {}) => ({ entry_date, category, description, original_amount: amount, original_currency: "USD", usd_rate: 1, usd_amount: amount, conversion_method: "USD: same currency", staff_group: "Not applicable", pre_operating: "No", _review: "Confirmed", ...extra });
    const lkr = (entry_date: string, category: string, description: string, amount: number, extra = {}) => ({ entry_date, category, description, original_amount: amount, original_currency: "LKR", usd_rate: 300, usd_amount: Math.round((amount / 300) * 100) / 100, lkr_rate: 1, lkr_amount: amount, conversion_method: "USD: LKR amount / 300 LKR per USD; LKR: same currency", rate_date: entry_date, rate_source: "Demo rate", staff_group: "Not applicable", pre_operating: "No", _review: "Confirmed", ...extra });
    const sl = { staff_group: "Sri Lankan" }, nsl = { staff_group: "Non-Sri Lankan" };
    await db.organization.update({ where: { id: demo.id }, data: { profile: { demo: true, licence_number: "DEMO-AP-0147", legal_form: "Private Company with Limited Liability", business_sector: "Information Technology (demo)", designation_type: "Authorised Person only", operations_commenced: "Yes", registered_address: "DEMO Tower 1, Port City Colombo", tin: "DEMO-TIN-001", roc_filing_info: "Annual return filed with the Registrar of Companies (demo).", contact_name: "Dinithi Admin (DEMO)", contact_email: "admin@demo.test", contact_phone: "+94 11 000 0000", signatory_name: "Dinithi Admin (DEMO)", signatory_designation: "Director" } } });
    for (const [formKey, rows] of Object.entries<any[]>({
      fin_entries: [
        usd("2025-09-30", "Revenue", "Software services H1 (demo)", 410000, { country_region: "Singapore" }),
        usd("2026-03-31", "Revenue", "Software services H2 (demo)", 465000, { country_region: "United Kingdom" }),
        usd("2025-06-15", "Capital expenditure", "Servers and laptops (demo)", 62000),
        lkr("2026-03-31", "Basic remuneration", "Local salaries (demo)", 38400000, sl),
        usd("2026-03-31", "Basic remuneration", "Expatriate salaries (demo)", 186000, nsl),
        lkr("2026-03-31", "Allowance payments", "Local allowances (demo)", 4200000, sl),
        lkr("2026-03-31", "EPF payment", "EPF (demo)", 3072000, sl),
        lkr("2026-03-31", "ETF payment", "ETF (demo)", 1152000, sl),
        usd("2026-03-31", "Office rent", "Office rent (demo)", 96000, { office_id: office.id }),
        lkr("2026-03-31", "Other operational expenditure", "Utilities and supplies (demo)", 2900000),
      ],
      housing: [{ description: "Apartment for expatriate staff (demo)", staff_group: "Non-Sri Lankan", tenure: "Leased", from_date: "2025-01-01" }],
    })) for (const { _review, ...data } of rows) await db.record.create({ data: { organizationId: demo.id, formKey, data, reviewStatus: _review ?? null } });
  }

  // Link demo staff to their office and positions, so the reports read like a real company. Never overwrites a link.
  const [demoOffice, demoPositions, demoStaff] = await Promise.all([
    db.record.findFirst({ where: { organizationId: demo.id, formKey: "offices" }, orderBy: { createdAt: "asc" } }),
    db.record.findMany({ where: { organizationId: demo.id, formKey: "positions" } }),
    db.record.findMany({ where: { organizationId: demo.id, formKey: "employees" } }),
  ]);
  for (const e of demoStaff) {
    const data = e.data as Record<string, unknown>;
    const pos = demoPositions.find((p) => (p.data as Record<string, unknown>).title === data.job_title);
    if (!data.office_id || !data.position_id) await db.record.update({ where: { id: e.id }, data: { data: { ...data, office_id: data.office_id ?? demoOffice?.id ?? null, position_id: data.position_id ?? pos?.id ?? null } as object } });
  }
  if (!(await db.record.count({ where: { organizationId: demo.id, formKey: "policies" } }))) {
    for (const data of [
      { policy_type: "Health insurance", title: "Group medical cover (demo)", description: "Inpatient and outpatient cover for staff and dependants.", eligibility: "All permanent staff", coverage_limit: "USD 20,000 per year", applies_to: "All staff", effective_from: "2025-01-01" },
      { policy_type: "Accommodation", title: "Expatriate housing (demo)", description: "Company-leased apartment.", eligibility: "Staff relocating from overseas", applies_to: "Non-Sri Lankan staff only", effective_from: "2025-01-01" },
      { policy_type: "Travel and relocation", title: "Relocation allowance (demo)", description: "One-off relocation support and annual home leave flight.", eligibility: "Staff relocating from overseas", coverage_limit: "USD 5,000", applies_to: "Non-Sri Lankan staff only", effective_from: "2025-01-01" },
    ]) await db.record.create({ data: { organizationId: demo.id, formKey: "policies", data } });
  }

  // A locked plan and an approved budget, with this year's spending, so plan vs actual and the budget read like a real company.
  if (!(await db.businessPlan.count({ where: { organizationId: demo.id } }))) {
    const y = (local: number, foreign: number, office: number, rev: number, fdi: number, source = "Equity") => ({ revenue_usd: rev, expenses_usd: Math.round(rev * 0.78), net_income_usd: Math.round(rev * 0.22), local_employees: local, foreign_employees: foreign, local_remuneration_usd: local * 18000, foreign_remuneration_usd: foreign * 60000, office_sqm: office, fdi_usd: fdi, lkr_land_lease: null, funding_source: source, funding_details: "Parent company funding (demo)", funding_evidence: "Yes" });
    const years = [y(8, 2, 300, 800000, 500000), y(15, 4, 400, 1200000, 348500), y(22, 5, 500, 1800000, 300000), y(28, 6, 600, 2400000, 250000), y(34, 7, 700, 3100000, 200000), y(38, 8, 750, 3700000, 150000), y(42, 8, 800, 4200000, 100000), y(45, 9, 850, 4700000, 100000), y(48, 9, 900, 5100000, 50000), y(50, 10, 950, 5500000, 50000)];
    const milestones = [{ milestone: "Open the SEZ office", target_date: "2025-09-30", actual_status: "Achieved", actual_date: "2025-09-15" }, { milestone: "Reach 19 employees", target_date: "2027-03-31", actual_status: "In progress" }, { milestone: "Second product line", target_date: "2027-09-30", actual_status: "Not started" }];
    const sections = { background: "Demo software services company.", activities: "Software services for customers outside Sri Lanka (demo)." };
    const title = "Business plan (demo)", year1Start = "2025-04-01";
    await db.businessPlan.create({ data: { organizationId: demo.id, versionNo: 1, title, status: "Locked", commissionStatus: "Submitted with the licence application", commissionDate: "2025-01-15", commissionRef: "DEMO-APP-0147", year1Start, years, milestones, sections, isReference: true, lockedByName: "Ravi Reviewer", lockedAt: new Date("2025-02-01"), hash: sha256(new TextEncoder().encode(planHashBody({ title, year1Start, sections, years, milestones }))) } });
  }
  if (!(await db.budget.count({ where: { organizationId: demo.id } }))) {
    const office = (await db.record.findFirst({ where: { organizationId: demo.id, formKey: "offices" }, orderBy: { createdAt: "asc" } }))!;
    const flat = (n: number) => Array(12).fill(n);
    await db.budget.create({ data: { organizationId: demo.id, title: "Budget 2026/27 (demo)", fyStart: "2026-04-01", currency: "USD", status: "Approved", approvedByName: "Ravi Reviewer", approvedAt: new Date("2026-03-20"), lines: { Revenue: { months: flat(100000) }, "Basic remuneration": { months: flat(30000) }, "Office rent": { months: flat(8000) }, "Other operational expenditure": { months: flat(6000) }, "Capital expenditure": { months: [20000, ...Array(10).fill(0), 10000] }, "EPF payment": { months: flat(1000) } } } });
    if (!(await db.record.count({ where: { organizationId: demo.id, formKey: "fx_rates" } }))) await db.record.create({ data: { organizationId: demo.id, formKey: "fx_rates", data: { rate_date: "2026-04-01", currency: "LKR", per_usd: 300, lkr_per_unit: 1, source: "Demo rate" } } });
    for (let i = 0; i < 7; i++) {
      const dt = `2026-${String(4 + i).padStart(2, "0")}-28`;
      const e = (category: string, description: string, usd: number, extra = {}) => db.record.create({ data: { organizationId: demo.id, formKey: "fin_entries", reviewStatus: "Confirmed", data: { entry_date: dt, category, description, original_amount: usd, original_currency: "USD", usd_rate: 1, usd_amount: usd, conversion_method: "USD: same currency", staff_group: "Not applicable", pre_operating: "No", ...extra } } });
      await e("Revenue", "Software services (demo)", 92000 + i * 2000, { country_region: "Singapore" });
      await e("Basic remuneration", "Salaries (demo)", 29000 + i * 300, { staff_group: "Sri Lankan" });
      await e("Office rent", "Office rent (demo)", 8000, { office_id: office.id });
      await e("Other operational expenditure", "Utilities and supplies (demo)", 6500);
    }
    await db.record.create({ data: { organizationId: demo.id, formKey: "fin_entries", reviewStatus: "Confirmed", data: { entry_date: "2026-04-20", category: "Capital expenditure", description: "Laptops (demo)", original_amount: 18000, original_currency: "USD", usd_rate: 1, usd_amount: 18000, conversion_method: "USD: same currency", staff_group: "Not applicable", pre_operating: "No" } } });
  }

  if (!(await db.document.count({ where: { organizationId: demo.id } }))) {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]).drawText("DEMO - sample document, not a real licence", { x: 50, y: 780, size: 16, font: await pdf.embedFont(StandardFonts.Helvetica) });
    const bytes = await pdf.save();
    const licence = await db.record.findFirst({ where: { organizationId: demo.id, formKey: "licences" } });
    const lic = await db.document.create({ data: { organizationId: demo.id, title: "AP licence certificate (demo)", category: "AP and BSI approvals", expiryDate: d(50), linkType: licence ? "licences" : null, linkId: licence?.id ?? null } });
    await db.documentVersion.create({ data: { organizationId: demo.id, documentId: lic.id, versionNo: 1, filename: "demo-licence.pdf", size: bytes.length, mime: "application/pdf", sha256: sha256(bytes), storageKey: await saveFile(demo.id, bytes), uploadedByName: "Demo data" } });
    const ubo = await db.document.create({ data: { organizationId: demo.id, title: "Signed UBO declaration (demo)", category: "UBO declarations", access: "Restricted" } });
    const b2 = new TextEncoder().encode("DEMO restricted sample: not a real declaration.\n");
    await db.documentVersion.create({ data: { organizationId: demo.id, documentId: ubo.id, versionNo: 1, filename: "demo-ubo.txt", size: b2.length, mime: "text/plain", sha256: sha256(b2), storageKey: await saveFile(demo.id, b2), uploadedByName: "Demo data" } });
    await db.document.create({ data: { organizationId: demo.id, title: "Audited financial statements 2025/26 (demo)", category: "Audited financial statements" } });
  }
  if (!(await db.document.count({ where: { organizationId: harbour.id } }))) await db.document.create({ data: { organizationId: harbour.id, title: "Harbourline board resolution (demo)", category: "Board resolutions" } });

  // A demo applicant, part-way through, so the application screens have something to show.
  if (!(await db.application.count({ where: { organizationId: harbour.id } }))) {
    await db.organization.update({ where: { id: harbour.id }, data: { stage: "applicant" } });
    const app = await db.application.create({ data: { organizationId: harbour.id, title: "Harbourline Analytics application (DEMO)", data: { app_type: "Authorised Person only", origin: "Foreign", legal: "Company", p1: { name: "Harbourline Analytics (Private) Limited (DEMO)", address: "DEMO 10 Marina Boulevard, Singapore 018983", country: "Singapore", email: "demo.applicant@example.com" }, q: { reg_no: "DEMO-202612345K", group_sl: "No", regulated: "No" } }, events: [{ at: "2026-11-01 09:00:00", by: "Demo data", status: "Preparing", note: "Started" }] } });
    await db.applicationPerson.create({ data: { organizationId: harbour.id, applicationId: app.id, data: { kind: "Individual", name: "Helen Tan (DEMO)", roles: ["Shareholder / member / partner / founder", "Director / member of the key management body"], shareholding_pct: 60, nationality: "Singaporean", address: "DEMO address", id_no: "HARBOUR-SECRET-ID" } } });
  }

  await seedRecords(harbour.id, {
    obligations: [{ title: "Submit the licence application pack (demo)", obligation_type: "Reporting deadline", basis: "Internal good practice", source_document: "Application process page", deadline: d(21), recurrence: "One-off", status: "In progress", needs_review: "No" }],
    ubo: [{ full_name: "Helen Tan (DEMO)", nationality: "Singaporean", ownership_pct: 60, passport_number: "HARBOUR-ONLY-P1", declaration_status: "Not prepared" }],
  });
  console.log("Seed complete:", await db.organization.count(), "orgs,", await db.user.count(), "users,", await db.formDefinition.count(), "forms,", await db.record.count(), "records");
}
main().finally(() => db.$disconnect());
