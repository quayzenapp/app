import assert from "node:assert/strict";
import { assertChangeVisible, assertPeopleVisible, hasStoredValue } from "../src/lib/lic/export-checks";
const hr = ["personal", "id", "pay"];
const secret = "DO-NOT-EXPOSE-BANK";
for (const value of [0, false, [ { bank: secret } ], "legacy text"]) assert.equal(hasStoredValue(value), true);
for (const value of [null, undefined, " ", [], [{ bank: null, amount: "" }]]) assert.equal(hasStoredValue(value), false);
console.log("PASS  Export checks distinguish populated restricted values from empty table placeholders");
for (const field of ["banks", "nw_assets", "nw_liabilities"]) {
  const d = { people: [{ [field]: field === "banks" ? [{ bank: secret }] : secret }] };
  for (const check of [() => assertPeopleVisible(d.people, hr), () => assertChangeVisible(d, hr)]) assert.throws(check, (e: Error) => e.message.includes(field) && e.message.includes("your role cannot see") && !e.message.includes(secret));
}
console.log("PASS  HR cannot receive a notice or application omitting populated bank fields; errors never contain values");
assert.throws(() => assertChangeVisible({ offshore: true, o3: { appoint: { passport: secret } } }, ["personal"]), (e: Error) => e.message.includes("appoint.passport") && !e.message.includes(secret));
assert.doesNotThrow(() => assertChangeVisible({ people: [{ banks: [{ bank: "", amount: null }] }] }, hr));
assert.doesNotThrow(() => assertPeopleVisible([{ banks: [{ bank: secret }] }], [...hr, "bank"]));
console.log("PASS  Offshore restricted fields are checked before stripping; authorized complete exports remain available");

import { PERSON_TABLES, isPersonTable, readPersonTable, assertPersonTables } from "../src/lib/lic/person-tables";
for (const spec of PERSON_TABLES) {
  for (const legacy of ["legacy saved text", "", 42, ["bad row"], [{ value: {} }]]) {
    assert.equal(isPersonTable(legacy), false);
    assert.throws(() => assertPersonTables([{ [spec.k]: legacy }]), (e: Error) => e.message.includes(spec.k) && e.message.includes("re-enter"));
    assert.throws(() => readPersonTable(spec.k, new FormData(), legacy), (e: Error) => e.message.includes(spec.k) && e.message.includes("kept"));
  }
  const form = new FormData(); form.set(`replace:${spec.k}`, "1"); form.set(`${spec.k}.0.${spec.cols[0][0]}`, "re-entered");
  const expected = [Object.fromEntries(spec.cols.map(([k], i) => [k, i ? null : "re-entered"]))];
  assert.deepEqual(readPersonTable(spec.k, form, "legacy"), expected);
  assert.doesNotThrow(() => assertPersonTables([{ [spec.k]: expected }]));
  assert.deepEqual(readPersonTable(spec.k, new FormData(), []), []);
}
console.log(`PASS  All ${PERSON_TABLES.length} person tables parse as arrays, reject malformed legacy values and require explicit replacement`);
