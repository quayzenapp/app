/** Only the single-box dates already formatted by the official form engines belong here. */
import { O3_SPEC, S3_MAP } from "@/lib/lic/change-spec";

export const DATE_FORMATS = ["DD/MM/YYYY", "DD/MM/YY"] as const;
export type DateFormat = typeof DATE_FORMATS[number];
export type DateFormats = { defaultFormat: DateFormat; fields: Record<string, DateFormat> };
export type OfficialDateFormatter = (form: string, field: string, value: unknown) => string;
export const FORM_DATE_FIELDS = [
  ...[
    ["Text14", "Part III: Date of incorporation / registration"], ["Text16", "Part III: Date of licence"],
    ["Text231", "Part IV: Date of birth"], ["Text240", "Part IV: Passport expiry date"],
    ["Text309", "Part V: Date of birth"], ["Text314", "Part V: Passport expiry date"],
  ].map(([field, label]) => ({ form: "s1", formLabel: "Schedule I", field, pdf: field, label, explicit: false })),
  ...Object.entries(S3_MAP).flatMap(([code, rows]) => rows.filter(row => row[2] != null).map((row, i) => ({ form: "s3", formLabel: "Schedule III", field: `Text${row[2]}`, pdf: `Text${row[2]}`, label: `Item ${code}${rows.length > 1 ? `, row ${i + 1}` : ""}: Date of Change`, explicit: false }))),
  ...O3_SPEC.filter(([, , type, pdf]) => type === "date" && typeof pdf === "string").map(([field, label, , pdf]) => ({ form: "o3", formLabel: "Offshore Form III", field, pdf: String(pdf), label, explicit: field === "arc.date" })),
  { form: "ubo", formLabel: "UBO Declaration", field: "date_of_birth", pdf: "Beneficial owner, date of birth", label: "Date of birth", explicit: false },
];
export const dateFieldKey = (form: string, field: string) => `${form}.${field}`;
const valid = (v: unknown): v is DateFormat => DATE_FORMATS.includes(v as DateFormat);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = new Set(FORM_DATE_FIELDS.map(f => dateFieldKey(f.form, f.field)));

export function parseDateFormats(value?: unknown): DateFormats {
  if (value === undefined) return { defaultFormat: "DD/MM/YYYY", fields: {} };
  if (!object(value) || !valid(value.defaultFormat) || !object(value.fields)) throw new Error("The official form date settings are invalid. Ask an administrator to check Admin > Controls.");
  const fields: Record<string, DateFormat> = {};
  for (const [key, format] of Object.entries(value.fields)) {
    if (!keys.has(key) || !valid(format)) throw new Error("An official form date format or field is invalid.");
    fields[key] = format;
  }
  return { defaultFormat: value.defaultFormat, fields };
}
export function resolveDateFormat(settings: DateFormats, form: string, field: string): DateFormat | undefined {
  const entry = FORM_DATE_FIELDS.find(f => f.form === form && f.field === field);
  if (!entry) throw new Error(`Unknown official date field: ${form}.${field}`);
  return settings.fields[dateFieldKey(form, field)] ?? (entry.explicit ? undefined : settings.defaultFormat);
}
export function createDateFormatter(settings: DateFormats): OfficialDateFormatter {
  return (form, field, value) => {
    if (!value) return "";
    const format = resolveDateFormat(settings, form, field);
    if (!format) throw new Error("Offshore Form III arc.date (Text43) needs an explicit date format in Admin > Controls > Official form dates. The form label asks for DD/MM/YY.");
    const s = String(value);
    return `${s.slice(8, 10)}/${s.slice(5, 7)}/${format === "DD/MM/YY" ? s.slice(2, 4) : s.slice(0, 4)}`;
  };
}
/** Resolve inheritance at approval; future setting changes cannot affect the copy. */
export function freezeDateFormats(settings: DateFormats): DateFormats {
  const fields: Record<string, DateFormat> = {};
  for (const entry of FORM_DATE_FIELDS) {
    const format = resolveDateFormat(settings, entry.form, entry.field);
    if (format) fields[dateFieldKey(entry.form, entry.field)] = format;
  }
  return { defaultFormat: settings.defaultFormat, fields };
}
/** Approved copies made before these settings used four-digit years, including the legacy mapping. */
export function snapshotDateFormats(value: unknown): DateFormats {
  return value === undefined ? { defaultFormat: "DD/MM/YYYY", fields: { "o3.arc.date": "DD/MM/YYYY" } } : parseDateFormats(value);
}
