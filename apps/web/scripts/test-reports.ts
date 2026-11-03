import { todayISO } from "../src/lib/forms";
import { createReports } from "../src/lib/reports/engine";
import { sezDeep } from "../src/lib/sections";

/** Expected values are worked out by hand. Calls the report engine directly with fixed records; no database. */
let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`); if (!ok) failed++; };
const day = (n: number) => new Date(new Date(todayISO()).getTime() + n * 864e5).toISOString().slice(0, 10);
const data: Record<string, any[]> = {
  employees: [
    { id: "e1", ref: "E1", full_name: "Secret Name", job_title: "Engineer", staff_category: "Professional", nationality: "Sri Lankan", nationality_group: "Sri Lankan", worker_type: "Employee", status: "Active", start_date: "2024-01-01", office_id: "o1", position_id: "p1", monthly_basic: 999 },
    { id: "e2", ref: "E2", job_title: "Engineer", staff_category: "Professional", nationality: "British", nationality_group: "Non-Sri Lankan", worker_type: "Employee", status: "Active", start_date: "2024-01-01", office_id: "o1", position_id: "p1" },
    { id: "e3", ref: "E3", job_title: "Clerk", staff_category: "Support", nationality: "Sri Lankan", nationality_group: "Sri Lankan", worker_type: "Employee", status: "Active", start_date: "2024-01-01" }, // no office, no position
    { id: "e4", ref: "E4", job_title: "Consultant", nationality: "Indian", nationality_group: "Non-Sri Lankan", worker_type: "Independent contractor", status: "Active", start_date: "2024-01-01" },
    { id: "e5", ref: "E5", job_title: "Former", nationality: "Sri Lankan", nationality_group: "Sri Lankan", worker_type: "Employee", status: "Left", start_date: "2020-01-01", end_date: "2023-12-31" },
    { id: "e6", ref: "E6", job_title: "Future", nationality: "Sri Lankan", nationality_group: "Sri Lankan", worker_type: "Employee", status: "Offer accepted - not started", start_date: "2024-01-01" },
  ],
  positions: [{ id: "p1", title: "Engineer", min_qualifications: "BSc", min_experience_years: 3, languages: "English" }],
  policies: [{ id: "x1", policy_type: "Health insurance", title: "Medical", applies_to: "All staff" }, { id: "x2", policy_type: "Accommodation", title: "Expired", applies_to: "All staff", effective_to: "2020-01-01" }],
  offices: [{ id: "o1", name: "SEZ HQ", location: "Inside Colombo Port City", designated_status: "Not applicable", area_sqm: 200, area_sqft: 2152.78, measurement_basis: "Exact", seats: 10, status: "In use" }, { id: "o2", name: "City", location: "Outside Colombo Port City", area_sqm: 50, status: "In use" }, { id: "o3", name: "Planned", location: "Inside Colombo Port City", area_sqm: 999, status: "Planned" }],
  office_plans: [{ id: "n1", effective_date: "2099-01-01", location: "Inside Colombo Port City", required_sqm: 400 }, { id: "n2", effective_date: "2000-01-01", location: "Inside Colombo Port City", required_sqm: 1 }],
  investments: [
    { id: "i1", entry_date: "2025-05-01", source_name: "A", classification: "Equity investment", usd_amount: 100.1, review_status: "Confirmed", bank_reference: "BANK-1" },
    { id: "i2", entry_date: "2025-06-01", source_name: "B", classification: "Equity investment", usd_amount: 200.2, review_status: "Confirmed" },
    { id: "i3", entry_date: "2025-07-01", source_name: "C", classification: "Equity investment", usd_amount: 5000, review_status: "Pending" },
    { id: "i4", entry_date: "2025-08-01", source_name: "D", classification: "Service revenue or customer receipt", usd_amount: 7000, review_status: "Confirmed" },
    { id: "i5", entry_date: "2024-01-01", source_name: "E", classification: "Intra-company debt", usd_amount: 50, review_status: "Confirmed" }, // before the period, in the cumulative
    { id: "i6", entry_date: "2025-09-01", source_name: "F", classification: "Equity investment", review_status: "Confirmed" }, // no USD figure
  ],
  requests: [{ id: "r1", title: "Old", received_date: "2024-01-01", status: "Closed" }, { id: "r2", title: "New", received_date: "2025-01-01", status: "New", responsible: "Dinithi" }],
  licences: [{ id: "l1", title: "AP", licence_type: "Authorised Person licence", number: "AP-1", status: "Active" }],
  obligations: [{ id: "b1", title: "Pay fee", basis: "Internal good practice", status: "Met" }],
  visas: [
    { id: "v1", person_name: "Far Future", nationality: "UK", visa_category: "Employee", application_status: "Approved", expiry_date: day(400), passport_expiry: day(800) },
    { id: "v2", person_name: "Soon", nationality: "UK", visa_category: "Employee", application_status: "Approved", expiry_date: day(30), passport_expiry: day(40) },
    { id: "v3", person_name: "Lapsed", nationality: "UK", visa_category: "Employee", application_status: "Approved", expiry_date: day(-5) },
  ],
  returns: [{ id: "t1", title: "AR", period_start: "2025-04-01", period_end: "2026-03-31", headcount_as_at: "2026-03-31", office_as_at: "2026-03-31", currency_method: "split", status: "Draft", lines: { e_doc_afs: { status: "value", text: "Ready" } } }],
  docs: [{ id: "d1", title: "No file", category: "Other", access: "Normal", versions: [] }, { id: "d2", title: "Expiring", category: "Other", access: "Normal", expiry_date: day(10), versions: [1] }, { id: "d3", title: "Far", category: "Other", access: "Normal", expiry_date: day(300), versions: [1] }],
};
const store = (sensitive: string[], modules: string[] | null = null) => ({ list: (t: string) => data[t] ?? [], get: (t: string, id: string) => (data[t] ?? []).find((x) => x.id === id) ?? null, can: (m: string) => !modules || modules.includes(m), canSee: (s: string) => sensitive.includes(s), company: () => ({ name: "Test Co", is_demo: true }), name: (x: unknown) => x ?? "", setting: () => 0 });
const all = createReports(store(["personal", "id", "pay", "ubo", "bank"]), () => true);
const none = createReports(store([]), () => false);
const sec = (rep: any, h: string) => rep.sections.find((s: any) => (s.heading ?? "").includes(h));
const flat = (rep: any) => JSON.stringify(rep);

const emp = all.buildReport("employees", { as_at: "2025-01-01" });
eq("employees: job titles counted, contractors, leavers and not-started excluded", sec(emp, "1. Job").rows, [["Clerk", "Support", 1, "Sri Lankan (1)"], ["Engineer", "Professional", 2, "Sri Lankan (1); British (1)"]]);
eq("employees: contractors listed separately", sec(emp, "contractors").rows.length, 1);
eq("employees: a position with no link says so, never guesses", sec(emp, "2. Minimum").rows, [["Engineer", "BSc", 3], ["Clerk", "Not recorded (no position linked)", "Not recorded"]]);
eq("employees: expired policies are left out", [sec(emp, "5. Health").rows.length, sec(emp, "4. Accommodation").rows.length], [1, 0]);
eq("employees: names and pay excluded unless asked for", [flat(emp).includes("Secret Name"), flat(emp).includes("999")], [false, false]);
const asked = all.buildReport("employees", { as_at: "2025-01-01", names: true, pay: true });
eq("employees: included on request by a role that may see them", [flat(asked).includes("Secret Name"), flat(asked).includes("999")], [true, true]);
const denied = none.buildReport("employees", { as_at: "2025-01-01", names: true, pay: true });
eq("employees: asking is ignored for a role that may not see them", [flat(denied).includes("Secret Name"), !!sec(denied, "Appendix")], [false, false]);

const off = all.buildReport("office_headcount", { as_at: "2025-01-01" });
eq("offices: planned offices aren't in use", sec(off, "Offices in use").rows.map((r: any) => [r[0], r[7]]), [["SEZ HQ", 2], ["City", 0]]);
const tot = Object.fromEntries(sec(off, "Totals").rows.map((r: any) => [r[0], r[1]]));
eq("offices: totals", [tot["Office space inside Colombo Port City (sqm)"], tot["Office space outside Colombo Port City (sqm)"], tot["Total company employees"], tot["Employees with no office assigned"], tot["Independent contractors (not counted)"]], [200, 50, 3, 1, 1]);
eq("offices: only future plans are projected", sec(off, "Planned").rows.map((r: any) => r[2]), [400]);

const inv = all.buildReport("investment", { start: "2025-04-01", end: "2026-03-31" });
const ft = Object.fromEntries(sec(inv, "FDI totals").rows.map((r: any) => [r[0], r[1]]));
eq("investment: period FDI adds only confirmed FDI, to the cent", ft["Period total"], 300.3);
eq("investment: cumulative includes earlier confirmed FDI", ft["Cumulative to end date"], 350.3);
eq("investment: records awaiting review are counted separately", ft["Records awaiting review in period"], 1);
eq("investment: a record with no USD figure is shown", sec(inv, "By classification").rows.find((r: any) => r[0] === "Equity investment" && r[1] === "Confirmed"), ["Equity investment", "Confirmed", 3, 300.3, 1]);
eq("investment: bank reference shown only with access", [flat(inv).includes("BANK-1"), flat(none.buildReport("investment", { start: "2025-04-01", end: "2026-03-31" })).includes("BANK-1")], [true, false]);

eq("requests: newest first", sec(all.buildReport("requests"), "Requests").rows.map((r: any) => r[1]), ["New", "Old"]);
eq("obligations: lists both registers", [sec(all.buildReport("obligations"), "Licences").rows.length, sec(all.buildReport("obligations"), "Obligations").rows.length], [1, 1]);

const vis = all.buildReport("visas", { days: 180 });
eq("visas: within the window, expired included, soonest first", sec(vis, "Expiring within").rows.map((r: any) => [r[0], r[6]]), [["Lapsed", -5], ["Soon", 30]]);
const v2 = none.buildReport("visas", { days: 180 });
eq("visas: names and passport dates hidden without access", [flat(v2).includes("Soon"), sec(v2, "All visa").rows[0][7]], [false, "Restricted"]);

const miss = all.buildReport("missing_docs");
eq("missing: a ready document isn't listed, the other three are", sec(miss, "Annual return").rows.map((r: any) => r[1]).includes("Audited financial statements of the company"), false);
eq("missing: annual return documents not ready", sec(miss, "Annual return").rows.length, 3);
eq("missing: expiring within 60 days only", sec(miss, "expired or expiring").rows.map((r: any) => r[0]), ["Expiring"]);
eq("missing: records with no file", sec(miss, "no file").rows.map((r: any) => r[0]), ["No file"]);
const noDocs = createReports(store([], ["reports"]), () => false).buildReport("missing_docs");
eq("missing: sections follow the role's modules", noDocs.sections.length, 0);

eq("plan vs actual says so plainly when there's no plan", all.buildReport("plan_vs_actual").sections[0].text.includes("No checked and locked business plan"), true);
const wr = all.arWorkingReport(data.returns[0], null);
eq("working report: every section plus manual and blank-field lists", [!!sec(wr, "Enter these manually"), !!sec(wr, "left blank on purpose"), !!sec(wr, "2(a)")], [true, true, true]);
const snapRep = all.arWorkingReport(data.returns[0], { lines: {}, version_no: 2, hash: "abcdef1234567890" });
eq("working report: a snapshot says so and drops live figures", [snapRep.subtitle.includes("Approved snapshot 2"), sec(snapRep, "2(a)").columns.includes("Worked out from records")], [true, false]);
eq("wording: SEZ on display, the Commission's name unchanged", sezDeep(["Inside Colombo Port City", "Port City Colombo", "Colombo Port City Economic Commission"]), ["Inside SEZ", "SEZ", "Colombo Port City Economic Commission"]);
for (const [code] of all.REPORTS) { const r = code === "annual_return" ? all.buildReport(code, { rid: "t1" }) : all.buildReport(code, { start: "2025-04-01", end: "2026-03-31" }); eq(`${code}: has a title, and is marked DEMO`, [!!r.title, r.demo], [true, true]); }
console.log(failed ? `\n${failed} FAILED` : "\nAll report checks passed");
process.exit(failed ? 1 : 0);
