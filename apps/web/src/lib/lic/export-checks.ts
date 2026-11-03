import { createDateFormatter, parseDateFormats, type DateFormats } from "@/lib/lic/date-formats";
import { createLic } from "@/lib/lic/core";
import { O3_SPEC } from "@/lib/lic/change-spec";
import { fullDetails, o3Sensitivity, type Rec } from "@/lib/lic/changes";
const L = createLic();
/** Empty table placeholders aren't data. Zero and false are values, not blanks. */
export function hasStoredValue(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return !!v.trim();
  if (Array.isArray(v)) return v.some(hasStoredValue);
  if (typeof v === "object") return Object.values(v).some(hasStoredValue);
  return true;
}
export function assertPeopleVisible(people: Rec[], sensitive: string[]) {
  for (const p of people) for (const f of L.PERSON_SPEC as Rec[]) {
    if (f.sens && !sensitive.includes(f.sens) && hasStoredValue(p[f.k])) throw new Error(`Cannot prepare the forms: restricted field "${f.k}" (${f.l}) has a value your role cannot see. Ask someone with access to prepare the complete forms.`);
  }
}
/** Called on the unstripped copy, before any generator sees data. Never put values or names in errors. */
export function assertChangeVisible(d: Rec, sensitive: string[]) {
  if ((!fullDetails(sensitive) && hasStoredValue(d.items)) || (!sensitive.includes("personal") && hasStoredValue(d.signer))) throw new Error("Cannot prepare the notice: it holds restricted particulars your role cannot see.");
  for (const [k] of O3_SPEC) {
    const sens = o3Sensitivity(k);
    if (sens && !sensitive.includes(sens) && hasStoredValue(L.getPath(d.o3 ?? {}, k))) throw new Error(`Cannot prepare the notice: offshore field "${k}" has a value your role cannot see.`);
  }
  assertPeopleVisible(d.people ?? [], sensitive);
}

/** Both approval and download require the explicit administrator choice for arc.date. */
export function assertNoticeDateMapping(d: Rec, formats: DateFormats = parseDateFormats()) {
  if (d.offshore && d.o3?.arc?.date) createDateFormatter(formats)("o3", "arc.date", d.o3.arc.date);
}
