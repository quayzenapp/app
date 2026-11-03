import { addDays, createBudget } from "@/lib/budget-engine";
import type { Tx } from "@/lib/db";
import { todayISO } from "@/lib/forms";

/** Only the two kinds of record a budget reads. Totals only: no individual's pay is involved. */
export async function loadBudgetEngine(tx: Tx, organizationId: string) {
  const rows = await tx.record.findMany({ where: { organizationId, archivedAt: null, formKey: { in: ["fin_entries", "fx_rates"] } } });
  const list = (t: string) => rows.filter((r) => r.formKey === t).map((r) => ({ ...(r.data as object), id: r.id }));
  return createBudget({ list });
}
export const budgetRow = (b: { fyStart: string; currency: string; lines: unknown; title: string; status: string; id: string }) => ({ ...b, fy_start: b.fyStart });
export const defaultAsAt = (eng: { addMonths: (d: string, n: number) => string }, fyStart: string) => { const t = todayISO(), end = eng.addMonths(fyStart, 12); return t < end ? t : addDays(end, -1); };
