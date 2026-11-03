import { createLic } from "../src/lib/lic/core";
import { NEXT, S, hiddenPersonKeys, safePath, stripPerson } from "../src/lib/lic/store";

/** Expected results are worked out by hand from the rules in the artifact's source. No database needed. */
let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`); if (!ok) failed++; };
const SH = "Shareholder / member / partner / founder", DIR = "Director / member of the key management body", KMP = "Key management personnel (Port City operations)";
const people = [
  { id: "p1", app_id: "a", kind: "Individual", name: "Ann", roles: [SH, DIR], shareholding_pct: 60 },
  { id: "p2", app_id: "a", kind: "Corporate", name: "ParentCo", roles: [SH], shareholding_pct: 40 },
  { id: "p3", app_id: "a", kind: "Individual", name: "Kim", roles: [KMP] },
  { id: "x", app_id: "other", kind: "Individual", name: "Other app", roles: [SH] },
];
const lic = createLic({ list: (t: string) => (t === "app_people" ? people : []), get: () => null, company: () => ({}), canSee: () => true });
const iso = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const a: any = { id: "a", app_type: "Authorised Person only", legal: "Company", planned_date: iso(10), checklist: {} };

eq("people are per application, largest holding first", lic.appPeople("app_id", "a").map((p: any) => p.name), ["Ann", "ParentCo", "Kim"]);
eq("a company applicant doesn't need Parts III or IV", lic.personParts(people[0], a), ["V"]);
eq("a partnership needs Part IV for an individual member", lic.personParts(people[0], { legal: "General Partnership" }), ["IV", "V"]);
eq("a partnership needs Part III for a corporate member", lic.personParts(people[1], { legal: "General Partnership" }), ["III"]);
eq("readiness requires key people: all three roles present", lic.stepMissing(a, "people").some((m: string) => /At least one|Key management personnel for/.test(m)), false);
const noPeople = createLic({ list: () => [], get: () => null, company: () => ({}), canSee: () => true });
eq("with nobody added, all three roles are asked for", noPeople.stepMissing(a, "people").length, 3);
eq("a person's missing details are counted, not named in detail", lic.stepMissing(a, "people").some((m: string) => /^Ann: \d+ detail/.test(m)), true);
const marked = { ...people[0], marks: Object.fromEntries(lic.PERSON_SPEC.map((f: any) => [f.k, "Not applicable"])), nic: "1" };
eq("marking a field Not applicable satisfies it", lic.personMissing(marked, a), []);
eq("projections need revenue, expenses, manpower and floor space", lic.stepMissing(a, "projections").length, 3);
const withTef = { ...a, tef: { v: { revenue: [100], expenses: [50], m_local: [2], floor: [10] } } };
eq("... and are satisfied when given", lic.stepMissing(withTef, "projections"), []);
const prim = { app_type: "Primary BSI", tef: { v: { fdi_equity_ll: [10, null], fdi_equity_dev: [5, null], fdi_loans_ll: [2], m_local: [3], o_foreign: [1] } } };
eq("Primary BSI adds the land lease and development halves", lic.tefVal(prim, "fdi_equity", 0), 15);
eq("... and a year with neither is empty, not zero", lic.tefVal(prim, "fdi_equity", 1), null);
eq("totals by year", [lic.tefTotals(prim)[0].fdi, lic.tefTotals(prim)[0].staff, lic.tefTotals(prim)[0].local, lic.tefTotals(prim)[0].foreign], [17, 4, 3, 1]);

const rows = lic.checklistRows(a), keys = rows.map((r: any) => r.key);
eq("documents needed per person expand to one line each", keys.filter((k: string) => k.startsWith("bankref:") || k.includes(":p")).length > 0, true);
eq("a company applicant gets the company lines", keys.includes("form_i"), true);
eq("a natural person doesn't", createLic({ list: () => [], get: () => null, company: () => ({}), canSee: () => true }).checklistRows({ id: "z", legal: "Natural Person" }).some((r: any) => r.key === "form_i"), false);
const c30 = rows.find((r: any) => r.it.cert30);
const withCert = (d: string, st = "Ready") => lic.checklistRows({ ...a, checklist: { [c30.key]: { status: st, cert_date: d } } }).find((r: any) => r.key === c30.key);
eq("a copy certified 25 days before submission is fine", [withCert(iso(-15)).warn.length, withCert(iso(-15)).done], [0, true]);
eq("one certified over 30 days before submission is flagged and not done", [withCert(iso(-25)).warn.length, withCert(iso(-25)).done], [1, false]);
const na = (note?: string) => lic.checklistRows({ ...a, checklist: { fee: { status: "Not applicable", note } } }).find((r: any) => r.key === "fee");
eq("Not applicable needs a reason", [na().done, na("Exempt").done], [false, true]);
eq("readiness is false until everything is done", lic.appReadiness(a).ready, false);

eq("statuses can't skip approval", NEXT[S.ready].includes(S.submitted), false);
eq("preparing can't jump to approved", NEXT[S.prep].includes(S.approved), false);
eq("only an approved application can be recorded as submitted", Object.entries(NEXT).filter(([, v]) => v.includes(S.submitted)).map(([k]) => k), [S.approved]);
eq("issued, withdrawn and rejected are final", [NEXT[S.issued], NEXT[S.withdrawn], NEXT[S.rejected]], [undefined, undefined, undefined]);
eq("restricted person fields are removed by role", [stripPerson({ name: "A", id_no: "X", address: "Y" }, []).id_no, stripPerson({ name: "A", id_no: "X" }, ["id"]).id_no], [undefined, "X"]);
eq("a role can't overwrite hidden fields", hiddenPersonKeys([]).includes("id_no"), true);
eq("form names can't reach an object's prototype", ["prof.parent.__proto__", "__proto__.x", "a.constructor.b", "prof.parent.sectors"].map(safePath), [false, false, false, true]);
const o: any = {}; lic.setPath(o, "prof.entities.1.name", "E");
eq("deep paths build arrays and objects", [Array.isArray(o.prof.entities), o.prof.entities[1].name], [true, "E"]);
console.log(failed ? `\n${failed} FAILED` : "\nAll licence checks passed");
process.exit(failed ? 1 : 0);
