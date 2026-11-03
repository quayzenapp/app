import { createLic } from "@/lib/lic/core";
type TableSpec = { k: string; l: string; t: string; rows: number; cols: [string, string][] };
export const PERSON_TABLES = (createLic().PERSON_SPEC as TableSpec[]).filter((f) => f.t === "rows");
export function isPersonTable(value: unknown): boolean {
  return value == null || (Array.isArray(value) && value.every((row) => row && typeof row === "object" && !Array.isArray(row) && Object.values(row).every((cell) => cell == null || ["string", "number", "boolean"].includes(typeof cell))));
}
export const tableError = (field: { k: string; l: string }) => `Field "${field.k}" (${field.l}) was saved in an unsupported table format. Please re-enter it in the table and confirm the replacement; the saved value has been kept.`;
export function assertPersonTables(people: Record<string, unknown>[]) {
  for (const person of people) for (const field of PERSON_TABLES) if (!isPersonTable(person[field.k])) throw new Error(tableError(field));
}
/** Uses only the server's column definitions. Legacy values need an explicit replacement, never an automatic empty array. */
export function readPersonTable(key: string, form: FormData, previous: unknown) {
  const field = PERSON_TABLES.find((f) => f.k === key);
  if (!field) throw new Error("Unknown person table.");
  if (!isPersonTable(previous) && form.get(`replace:${key}`) !== "1") throw new Error(tableError(field));
  return Array.from({ length: field.rows }, (_, i) => Object.fromEntries(field.cols.map(([k]) => [k, String(form.get(`${key}.${i}.${k}`) ?? "").trim() || null]))).filter((row) => Object.values(row).some((v) => v != null));
}
