import { db, type Tx } from "@/lib/db";

export type Field = { name: string; label: string; type: string; required?: boolean; choices?: string[]; lookup?: string; ref?: string; sensitive?: string; group?: string; help?: string; dflt?: string | number; readonly?: boolean };
export type Form = { id: string; organizationId: string | null; key: string; label: string; plural: string; module: string; intro: string | null; titleField: string; listFields: string[]; fields: Field[]; reviewable: boolean; importable: boolean; status: string; version: number };
export const FIELD_TYPES = ["text", "textarea", "int", "decimal", "money", "rate", "date", "currency", "choice", "ref", "user"];
type Row = Record<string, unknown>;

const toForm = (f: { fields: unknown } & Omit<Form, "fields">) => ({ ...f, fields: f.fields as Field[] }) as Form;

/** Organization overrides win over global definitions with the same key. */
export async function getForms(organizationId: string, opts: { includeDrafts?: boolean } = {}): Promise<Form[]> {
  const rows = await db.formDefinition.findMany({
    where: { OR: [{ organizationId }, { organizationId: null }], ...(opts.includeDrafts ? {} : { status: "PUBLISHED" }) },
  });
  const byKey = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (r.organizationId || !byKey.has(r.key)) byKey.set(r.key, r);
  return [...byKey.values()].map(toForm).sort((a, b) => a.plural.localeCompare(b.plural));
}
export const getForm = async (organizationId: string, key: string) => (await getForms(organizationId)).find((f) => f.key === key) ?? null;

export async function getLookups(organizationId: string) {
  const rows = await db.lookup.findMany({ where: { OR: [{ organizationId }, { organizationId: null }] }, orderBy: { organizationId: { sort: "asc", nulls: "first" } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.values])) as Record<string, string[]>;
}
export const choicesFor = (f: Field, lookups: Record<string, string[]>) => f.choices ?? (f.lookup ? lookups[f.lookup] ?? [] : []);
export const canSeeField = (f: Field, sensitive: string[]) => !f.sensitive || sensitive.includes(f.sensitive);

/** Removes values the role may not see. Every record read must pass through this. */
export function stripSensitive<T extends Row>(form: Form, data: T, sensitive: string[]): T {
  const out = { ...data } as Row;
  for (const f of form.fields) if (!canSeeField(f, sensitive)) delete out[f.name];
  return out as T;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Same rules as the artifact's cleanValue. Returns the cleaned value or throws a message. */
function clean(f: Field, raw: unknown, lookups: Record<string, string[]>): unknown {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  if (f.type === "int" || f.type === "decimal" || f.type === "money" || f.type === "rate") {
    const n = Number(s.replace(/,/g, ""));
    if (!Number.isFinite(n)) throw `${f.label}: please enter a ${f.type === "int" ? "whole " : ""}number.`;
    return f.type === "int" ? Math.round(n) : n;
  }
  if (f.type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(s).getTime())) throw `${f.label}: use the date format YYYY-MM-DD.`;
    return s;
  }
  if (f.type === "currency") {
    if (!/^[A-Za-z]{3}$/.test(s)) throw `${f.label}: use a three-letter code such as USD or LKR.`;
    return s.toUpperCase();
  }
  if (f.type === "choice") {
    const ch = choicesFor(f, lookups);
    if (!ch.includes(s)) throw `${f.label}: '${s}' is not one of: ${ch.join(", ")}.`;
  }
  return s;
}

/** Calculated fields, ported from the artifact's derive(). Returns notes for the user. */
export function derive(formKey: string, hasMoney: boolean, rec: Row, before?: Row | null): string[] {
  const notes: string[] = [];
  if (hasMoney) {
    if (before) {
      const meth = String(before.conversion_method ?? "");
      const changed = ["original_amount", "original_currency", "usd_rate", "lkr_rate"].some((k) => String(before[k]) !== String(rec[k]));
      if (changed) {
        if (/per USD|USD: same/.test(meth) && String(rec.usd_amount) === String(before.usd_amount)) rec.usd_amount = null;
        if (/LKR per|LKR: same/.test(meth) && String(rec.lkr_amount) === String(before.lkr_amount)) rec.lkr_amount = null;
      }
    }
    const amt = rec.original_amount as number | null, cur = String(rec.original_currency ?? "").toUpperCase(), m: string[] = [];
    if (amt != null && cur) {
      if (cur === "USD") { rec.usd_amount = r2(amt); rec.usd_rate = 1; m.push("USD: same currency"); }
      else if (rec.usd_amount != null) m.push("USD: entered by user");
      else if (rec.usd_rate) { rec.usd_amount = r2(amt / (rec.usd_rate as number)); m.push(`USD: ${cur} amount / ${rec.usd_rate} ${cur} per USD`); }
      else notes.push(`No USD figure: add a USD rate or the USD amount if this ${cur} amount must be reported in USD.`);
      if (cur === "LKR") { rec.lkr_amount = r2(amt); rec.lkr_rate = 1; m.push("LKR: same currency"); }
      else if (rec.lkr_amount != null) m.push("LKR: entered by user");
      else if (rec.lkr_rate) { rec.lkr_amount = r2(amt * (rec.lkr_rate as number)); m.push(`LKR: ${cur} amount x ${rec.lkr_rate} LKR per ${cur}`); }
      rec.conversion_method = m.join("; ") || null;
      if (!["USD", "LKR"].includes(cur) && rec.usd_amount != null && !(rec.rate_date && rec.rate_source)) notes.push("Please record the exchange rate date and source.");
    }
  }
  if ((formKey === "offices" || formKey === "rent_options") && rec.floor_area != null) {
    const k = 10.7639104, a = rec.floor_area as number;
    if (rec.area_unit === "sqft") { rec.area_sqm = r2(a / k); rec.area_sqft = r2(a); }
    else { rec.area_sqm = r2(a); rec.area_sqft = r2(a * k); }
  }
  if (formKey === "employees") {
    if (!rec.nationality_group && rec.nationality) rec.nationality_group = ["sri lankan", "sri lanka", "lk"].includes(String(rec.nationality).trim().toLowerCase()) ? "Sri Lankan" : "Non-Sri Lankan";
    if (rec.end_date && rec.start_date && String(rec.end_date) < String(rec.start_date)) throw ["End date cannot be before the start date."];
  }
  return notes;
}

/** Cleans input, keeps hidden sensitive values from `before`, validates and derives. Throws string[] on error. */
export function buildRecord(form: Form, raw: Row, before: Row | null, sensitive: string[], lookups: Record<string, string[]>) {
  const errs: string[] = [];
  const rec: Row = { ...(before ?? {}) };
  for (const f of form.fields) {
    if (!canSeeField(f, sensitive)) continue; // hidden: neither readable nor writable, existing value kept
    if (f.readonly && before) continue;
    if (f.readonly && f.dflt === undefined) continue;
    if (f.readonly) { rec[f.name] = f.dflt; continue; }
    try { rec[f.name] = clean(f, raw[f.name], lookups); } catch (e) { errs.push(String(e)); }
  }
  if (errs.length) throw errs;
  const notes = derive(form.key, form.fields.some((f) => f.name === "original_amount"), rec, before);
  for (const f of form.fields) {
    if (f.readonly || !f.required || !canSeeField(f, sensitive)) continue;
    if (rec[f.name] == null || rec[f.name] === "") errs.push(`${f.label} is required.`);
  }
  if (errs.length) throw errs;
  return { rec, notes };
}

export async function loadRefOptions(tx: Tx, organizationId: string, forms: Form[], form: Form, sensitive: string[]) {
  const out: Record<string, { value: string; label: string }[]> = {};
  for (const f of form.fields.filter((x) => x.type === "ref" && x.ref)) {
    const target = forms.find((x) => x.key === f.ref);
    if (!target) continue;
    const rows = await tx.record.findMany({ where: { organizationId, formKey: target.key, archivedAt: null } });
    out[f.name] = rows.map((r) => {
      const d = stripSensitive(target, r.data as Row, sensitive);
      return { value: r.id, label: String(d[target.titleField] ?? d.title ?? d.name ?? r.id) };
    });
  }
  return out;
}

export const fmtDate = (s: unknown) => (s ? new Date(String(s)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
/** Deadlines follow the date in Sri Lanka, not the server's UTC date. */
export const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
export const daysUntil = (s: string) => Math.round((new Date(s).getTime() - new Date(todayISO()).getTime()) / 864e5);
