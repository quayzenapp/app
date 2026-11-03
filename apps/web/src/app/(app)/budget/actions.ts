"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BUDGET_ROWS, createBudget } from "@/lib/budget-engine";
import { assertDifferentPerson, secondPersonRequired } from "@/lib/controls";
import { audit, withTenant, type Tx } from "@/lib/db";
import { can, getTenantContext, type TenantContext } from "@/lib/tenant";
import type { Prisma } from "@/generated/prisma/client";

export type State = { error?: string; ok?: string };
const dates = createBudget({ list: () => [] });
const log = (tx: Tx, ctx: TenantContext, action: string, id: string, summary: string) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action, entityType: "budgets", entityId: id, summary });
async function guard(level: "write" | "approve") {
  const ctx = await getTenantContext();
  if (!can(ctx, "budget", level)) redirect("/forbidden");
  return ctx;
}
const load = async (tx: Tx, ctx: TenantContext, id: string) => {
  const b = await tx.budget.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!b) throw new Error("This budget no longer exists.");
  return b;
};

export async function createBudgetAction(_s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  const title = String(f.get("title") ?? "").trim().slice(0, 200), fy = String(f.get("fy_start") ?? ""), cur = String(f.get("currency") ?? "").trim().toUpperCase();
  if (!title) return { error: "Please enter a title." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fy)) return { error: "Please enter the date the financial year starts." };
  if (!/^[A-Z]{3}$/.test(cur)) return { error: "Use a three-letter currency code." };
  const id = await withTenant(ctx.org.id, async (tx) => {
    const b = await tx.budget.create({ data: { organizationId: ctx.org.id, title, fyStart: `${fy.slice(0, 7)}-01`, currency: cur, preparedById: ctx.user.id } });
    await log(tx, ctx, "create", b.id, `Created ${title}`);
    return b.id;
  });
  redirect(`/budget/${id}/edit`);
}
export async function copyBudget(id: string, _s: State): Promise<State> {
  const ctx = await guard("write");
  let nid: string;
  try {
    nid = await withTenant(ctx.org.id, async (tx) => {
      const b = await load(tx, ctx, id);
      const fy = dates.addMonths(b.fyStart, 12), y = fy.slice(0, 4);
      if (await tx.budget.findFirst({ where: { organizationId: ctx.org.id, fyStart: fy } })) throw new Error(`There is already a budget starting ${fy}.`);
      const c = await tx.budget.create({ data: { organizationId: ctx.org.id, title: `Budget ${y}/${String(Number(y) + 1).slice(2)}`, fyStart: fy, currency: b.currency, lines: b.lines as Prisma.InputJsonValue, preparedById: ctx.user.id, copiedFromId: b.id } });
      await log(tx, ctx, "create", c.id, `Copied from ${b.title}`);
      return c.id;
    });
  } catch (e) { return { error: (e as Error).message }; }
  redirect(`/budget?b=${nid}`);
}
export async function saveBudget(id: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  const lines: Record<string, { months: number[] }> = {}, errs: string[] = [];
  BUDGET_ROWS.forEach((c, r) => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const s = String(f.get(`m_${r}_${i}`) ?? "").replace(/,/g, "").trim();
      if (!s) return 0;
      const v = Number(s);
      if (!Number.isFinite(v)) { errs.push(`${c}, month ${i + 1}: please enter a number.`); return 0; }
      return v;
    });
    if (months.some((v) => v)) lines[c] = { months };
  });
  if (errs.length) return { error: errs.slice(0, 5).join(" ") };
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const b = await load(tx, ctx, id);
      if (b.status !== "Draft") throw new Error("Reopen the budget to change its figures.");
      await tx.budget.update({ where: { id: b.id }, data: { lines, preparedById: ctx.user.id } });
      await log(tx, ctx, "figures", b.id, `${b.title}: ${Object.keys(lines).length} line(s) saved`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  redirect(`/budget?b=${id}`);
}
const step = (id: string, level: "write" | "approve", run: (tx: Tx, ctx: TenantContext, separate: boolean) => Promise<string>) => async (): Promise<State> => {
  const ctx = await guard(level);
  const separate = await secondPersonRequired(ctx.org.id);
  try {
    const ok = await withTenant(ctx.org.id, (tx) => run(tx, ctx, separate));
    revalidatePath("/budget");
    return { ok };
  } catch (e) { return { error: (e as Error).message }; }
};
export async function budgetReady(id: string, _s: State) {
  return step(id, "write", async (tx, ctx) => {
    const b = await load(tx, ctx, id);
    if (b.status !== "Draft") throw new Error("Only a draft can be sent for approval.");
    await tx.budget.update({ where: { id: b.id }, data: { status: "Ready for approval", readyById: ctx.user.id } });
    await log(tx, ctx, "ready", b.id, `${b.title} sent for approval`);
    return "Sent for approval.";
  })();
}
export async function budgetApprove(id: string, _s: State) {
  return step(id, "approve", async (tx, ctx, separate) => {
    const b = await load(tx, ctx, id);
    if (b.status !== "Ready for approval") throw new Error("Only a budget waiting for approval can be approved.");
    assertDifferentPerson(separate, b.readyById ?? b.preparedById, ctx.user.id, "approve this budget");
    await tx.budget.update({ where: { id: b.id }, data: { status: "Approved", approvedById: ctx.user.id, approvedByName: ctx.user.name, approvedAt: new Date() } });
    await log(tx, ctx, "approve", b.id, `${b.title} approved${separate ? "" : " (second-person check off)"}`);
    return "Budget approved.";
  })();
}
export async function budgetReopen(id: string, _s: State) {
  return step(id, "write", async (tx, ctx) => {
    const b = await load(tx, ctx, id);
    await tx.budget.update({ where: { id: b.id }, data: { status: "Draft", readyById: null, approvedById: null, approvedByName: null, approvedAt: null } });
    await log(tx, ctx, "reopen", b.id, `${b.title} reopened`);
    return "Reopened for changes.";
  })();
}
