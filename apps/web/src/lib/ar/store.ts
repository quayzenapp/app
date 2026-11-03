import type { Tx } from "@/lib/db";
import { db } from "@/lib/db";
import { AR_TEMPLATE } from "@/lib/ar/engine";

export type Line = { status: string; num?: number | null; text?: string | null; source?: string; explanation?: string | null; set_by?: string; set_at?: string };
export type Lines = Record<string, Line>;
export type TemplateLine = { key: string; label: string; section: string; kind: string; ref?: string; pdf?: unknown; note?: string; calc?: string; shared025?: boolean; currency?: string };
export const TEMPLATE_LINES = AR_TEMPLATE.lines as TemplateLine[];
export const STATUS_LABEL: Record<string, string> = { value: "Has value", nil: "Nil", not_applicable: "Not applicable", not_available: "Not available", missing: "Missing" };

type Row = Record<string, unknown> & { id: string };
/** The artifact engine reads from this: an organization's live records, with the reviewer's decision included. */
export async function loadStore(tx: Tx, organizationId: string) {
  const rows = await tx.record.findMany({ where: { organizationId, archivedAt: null } });
  const by = new Map<string, Row[]>();
  for (const r of rows) by.set(r.formKey, [...(by.get(r.formKey) ?? []), { ...(r.data as object), id: r.id, review_status: r.reviewStatus } as Row]);
  return { list: (t: string) => by.get(t) ?? [], get: (t: string, id: string) => (by.get(t) ?? []).find((x) => x.id === id) ?? null };
}
export async function loadCompany(organizationId: string) {
  const o = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
  return { name: o.name, is_demo: o.isDemo, ...(o.profile as object) } as Record<string, unknown> & { name: string; is_demo: boolean };
}
export type ReturnRow = { title: string; periodStart: string; periodEnd: string; headcountAsAt: string; officeAsAt: string; currencyMethod: string };
export const toEngine = (r: ReturnRow) => ({ title: r.title, period_start: r.periodStart, period_end: r.periodEnd, headcount_as_at: r.headcountAsAt, office_as_at: r.officeAsAt, currency_method: r.currencyMethod });

const fmtMoney = (n: unknown) => (n == null ? "" : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export function lineValue(l: TemplateLine, s?: Partial<Line> | null): string {
  if (!s) return "";
  if (s.status !== "value") return STATUS_LABEL[s.status ?? ""] ?? s.status ?? "";
  if (l.kind === "table") return s.text ? (JSON.parse(s.text) as { country: string; currency: string; amount: number }[]).map((x) => `${x.country}: ${x.currency} ${fmtMoney(x.amount)}`).join("; ") : "";
  if (l.kind === "amount" || l.kind === "area") return fmtMoney(s.num);
  if (l.kind === "count") return String(s.num);
  return s.text ?? "";
}
export const sameAsCalculated = (s: Line, c?: Partial<Line> | null) => !!c && String(s.num ?? "") === String(c.num ?? "") && String(s.text ?? "") === String(c.text ?? "") && s.status === c.status;
export const missingLines = (lines: Lines) => TEMPLATE_LINES.filter((l) => !lines[l.key] || lines[l.key].status === "missing");
