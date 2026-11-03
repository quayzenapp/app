import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BudgetGrid } from "@/components/budget-grid";
import { BUDGET_ROWS, createBudget } from "@/lib/budget-engine";
import { withTenant } from "@/lib/db";
import { can, requirePermission } from "@/lib/tenant";
import { saveBudget } from "../../actions";

export default async function BudgetEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("budget");
  if (!can(ctx, "budget", "write")) redirect("/forbidden");
  const b = await withTenant(ctx.org.id, (tx) => tx.budget.findFirst({ where: { id, organizationId: ctx.org.id } }));
  if (!b) notFound();
  if (b.status !== "Draft") redirect(`/budget?b=${id}`);
  const months = createBudget({ list: () => [] }).monthsBetween(b.fyStart, 12).map((m: { p: string; label: string }) => ({ p: m.p, label: m.label }));
  const lines = b.lines as Record<string, { months: number[] }>;
  return (
    <>
      <div className="head"><div className="t"><Link className="link" href={`/budget?b=${id}`}>← Budget</Link><h1>{b.title}: budget figures</h1><p className="muted">Amounts in {b.currency}. Type an annual figure and click <b>Spread</b> to divide it evenly across the months, or type each month. Revenue is income; all other lines are spending. Leave lines you don&apos;t budget for blank.</p></div></div>
      <BudgetGrid action={saveBudget.bind(null, id)} rows={BUDGET_ROWS} months={months} initial={Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, v.months]))} />
    </>
  );
}
