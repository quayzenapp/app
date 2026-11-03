import { createLic } from "@/lib/lic/core";
import { stripSensitive, type Form } from "@/lib/forms";
import { S3_CAP, O3_SPEC } from "@/lib/lic/change-spec";

export type Rec = Record<string, any>;
export type ChangeItem = { id?: string; code: string; former: string | null; new: string | null; date: string | null; reason: string | null };
// Existing notices gain persisted IDs on their next successful edit.
export const changeItemId = (item: ChangeItem, index: number) => item.id ?? `legacy-${index}`;
export const L = createLic();
export const CHANGE_NEXT: Record<string, string[]> = { Draft: ["Ready for review"], "Ready for review": ["Draft", "Approved"], Approved: ["Draft", "Submitted"], Submitted: ["Acknowledged"], Acknowledged: ["Closed"] };
export const locked = (status: string) => ["Submitted", "Acknowledged", "Closed"].includes(status);
export const fullDetails = (s: string[]) => ["personal", "id"].every((x) => s.includes(x));
export const o3Sensitivity = (k: string) => /passport|\.nic$|new_id/.test(k) ? "id" : /^(cease|appoint|dchg|arc|ara|archg|sb)\.|^signer$/.test(k) ? "personal" : undefined;
// Flatten nested form values before applying the shared restricted-field filter.
const form = (fields: Form["fields"]) => ({ fields }) as Form;
export function stripChange(data: Rec, sensitive: string[]): Rec {
  const flat = Object.fromEntries(O3_SPEC.map(([k]) => [k, L.getPath(data.o3 ?? {}, k)]));
  const clean = stripSensitive(form(O3_SPEC.map(([k, label, type]) => ({ name: k, label, type, sensitive: o3Sensitivity(k) }))), flat, sensitive);
  const o3: Rec = {};
  for (const [k, v] of Object.entries(clean)) if (v !== undefined) L.setPath(o3, k, v);
  const personForm = form(L.PERSON_SPEC.map((f: Rec) => ({ name: f.k, label: f.l, type: f.t, sensitive: f.sens })));
  const out = stripSensitive(form([{ name: "items", label: "Changes", type: "text", sensitive: fullDetails(sensitive) ? undefined : "__restricted" }, { name: "signer", label: "Signatory", type: "text", sensitive: "personal" }]), data, sensitive);
  return { ...out, o3, people: (data.people ?? []).map((p: Rec) => stripSensitive(personForm, p, sensitive)) };
}
export function validDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
}
/** Schedule III: earliest change + 30 calendar days; 2026-01-31 -> 2026-03-02. */
export function changeDue(items: ChangeItem[]): string | null {
  const first = items.map((i) => i.date).filter((x): x is string => !!x).sort()[0];
  if (!first) return null;
  if (!validDate(first)) throw new Error("Date of change: use a valid date.");
  const d = new Date(`${first}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
}
export function validateItems(items: ChangeItem[]) {
  const counts: Record<string, number> = {};
  for (const i of items) {
    if (!L.S3_ITEMS.some((s: string[]) => s[0] === i.code)) throw new Error("Unknown Schedule III item.");
    if ((counts[i.code] = (counts[i.code] ?? 0) + 1) > S3_CAP(i.code)) throw new Error(`Item ${i.code}: the official form is full. Start another notice for further changes.`);
    if (i.date && !validDate(i.date)) throw new Error("Date of change: use a valid date.");
  }
}
