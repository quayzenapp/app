"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { arCompute } from "@/lib/ar/engine";
import { TEMPLATE_LINES, lineValue, loadCompany, loadStore, missingLines, toEngine, type Line, type Lines } from "@/lib/ar/store";
import { audit, withTenant, type Tx } from "@/lib/db";
import { can, getTenantContext, type TenantContext } from "@/lib/tenant";
import type { Prisma } from "@/generated/prisma/client";

export type State = { error?: string; ok?: string };
const nowIso = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
const J = (v: unknown) => v as Prisma.InputJsonValue;
const log = (tx: Tx, ctx: TenantContext, action: string, id: string, summary: string) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action, entityType: "returns", entityId: id, summary });
async function guard(level: "write" | "approve") {
  const ctx = await getTenantContext();
  if (!can(ctx, "returns", level)) redirect("/forbidden");
  return ctx;
}
const load = async (tx: Tx, ctx: TenantContext, id: string) => {
  const r = await tx.annualReturn.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!r) throw new Error("This return no longer exists.");
  return r;
};

export async function createReturn(_s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  const g = (k: string) => String(f.get(k) ?? "").trim();
  const d = { title: g("title"), periodStart: g("period_start"), periodEnd: g("period_end"), headcountAsAt: g("headcount_as_at"), officeAsAt: g("office_as_at"), currencyMethod: g("currency_method") === "both" ? "both" : "split" };
  if (!d.title) return { error: "Please enter a title." };
  if (![d.periodStart, d.periodEnd, d.headcountAsAt, d.officeAsAt].every(isDate)) return { error: "Please enter all four dates." };
  if (d.periodEnd < d.periodStart) return { error: "The period end is before the start." };
  const id = await withTenant(ctx.org.id, async (tx) => {
    const r = await tx.annualReturn.create({ data: { ...d, organizationId: ctx.org.id, preparedById: ctx.user.id } });
    await log(tx, ctx, "create", r.id, `Created ${d.title}`);
    return r.id;
  });
  redirect(`/returns/${id}`);
}

/** Same rules as the artifact's ar-line form. */
export async function setLine(id: string, key: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  const l = TEMPLATE_LINES.find((x) => x.key === key);
  if (!l) return { error: "This line isn't on the form." };
  const action = String(f.get("action") ?? ""), ex = String(f.get("explanation") ?? "").trim(), v = String(f.get("value") ?? "").trim();
  if (!action) return { error: "Choose what the return should show." };
  const company = await loadCompany(ctx.org.id);
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const r = await load(tx, ctx, id);
      if (r.status !== "Draft") throw new Error("Lines are locked. Reopen the return to change a line.");
      const need = () => { if (!ex) throw new Error("Please add an explanation."); };
      let st: Line;
      if (action === "calc") {
        const k = arCompute(await loadStore(tx, ctx.org.id), toEngine(r), company)[key];
        if (!k) throw new Error("There is no worked-out value for this line.");
        if (k.status === "missing") throw new Error("Nothing was worked out from the records. Enter a value or mark the line Nil, Not applicable or Not available.");
        st = { status: k.status, num: k.num ?? null, text: k.text ?? null, source: "Calculated", explanation: ex || k.autoExpl || null };
      } else if (action === "manual") {
        need();
        if (!v) throw new Error("Enter the value.");
        if (["amount", "area", "count"].includes(l.kind)) {
          const n = Number(v.replace(/,/g, ""));
          if (!Number.isFinite(n) || n < 0) throw new Error("Enter a number of zero or more.");
          st = { status: "value", num: l.kind === "count" ? Math.round(n) : n, text: null };
        } else if (l.kind === "table") {
          const rows = v.split("\n").map((x) => x.trim()).filter(Boolean).map((x, i) => {
            const [country, currency, amount] = x.split(";").map((y) => (y ?? "").trim());
            const n = Number(String(amount).replace(/,/g, ""));
            if (!country || !/^[A-Za-z]{3}$/.test(currency ?? "") || !amount || !Number.isFinite(n)) throw new Error(`Row ${i + 1}: use Country ; Currency ; Amount.`);
            return { country, currency: currency.toUpperCase(), amount: n };
          });
          st = { status: "value", num: null, text: JSON.stringify(rows) };
        } else st = { status: "value", num: null, text: v };
        st.source = "Entered manually"; st.explanation = ex;
      } else if (action === "doc_ready") st = { status: "value", text: "Ready", source: "Marked by user", explanation: ex || null };
      else if (action === "doc_missing") st = { status: "missing", source: "Marked by user", explanation: ex || null };
      else if (action === "conf_yes") st = { status: "value", text: "Confirmed", source: "Marked by user", explanation: ex || null };
      else if (action === "conf_no") { need(); st = { status: "value", text: "Not confirmed", source: "Marked by user", explanation: ex }; }
      else if (["nil", "not_applicable", "not_available"].includes(action)) { need(); st = { status: action, num: null, text: null, source: "Marked by user", explanation: ex }; }
      else throw new Error("Choose what the return should show.");
      st.set_by = ctx.user.name; st.set_at = nowIso();
      await tx.annualReturn.update({ where: { id: r.id }, data: { lines: J({ ...(r.lines as Lines), [key]: st }) } });
      await log(tx, ctx, "line", r.id, `${l.ref ?? ""} ${l.label}: ${lineValue(l, st)} (${st.source})`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  redirect(`/returns/${id}`);
}

export async function acceptCalculated(id: string, _s: State): Promise<State> {
  const ctx = await guard("write");
  const company = await loadCompany(ctx.org.id);
  try {
    const n = await withTenant(ctx.org.id, async (tx) => {
      const r = await load(tx, ctx, id);
      if (r.status !== "Draft") throw new Error("Lines are locked. Reopen the return to change a line.");
      const calc = arCompute(await loadStore(tx, ctx.org.id), toEngine(r), company), lines = { ...(r.lines as Lines) };
      let count = 0;
      for (const l of TEMPLATE_LINES) {
        const k = calc[l.key];
        if (lines[l.key] || !k || !["value", "not_applicable"].includes(k.status)) continue;
        lines[l.key] = { status: k.status, num: k.num ?? null, text: k.text ?? null, source: "Calculated", explanation: k.autoExpl || null, set_by: ctx.user.name, set_at: nowIso() };
        count++;
      }
      await tx.annualReturn.update({ where: { id: r.id }, data: { lines: J(lines) } });
      await log(tx, ctx, "calculated", r.id, `${count} line(s) set from worked-out values`);
      return count;
    });
    revalidatePath(`/returns/${id}`);
    return { ok: `${n} line(s) set. Lines with nothing found still need a value, or to be marked Nil, Not applicable or Not available.` };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function markReady(id: string, _s: State): Promise<State> {
  const ctx = await guard("write");
  try {
    const docs = await withTenant(ctx.org.id, async (tx) => {
      const r = await load(tx, ctx, id);
      if (r.status !== "Draft") throw new Error("Only a draft can be marked ready.");
      const m = missingLines(r.lines as Lines), block = m.filter((l) => l.kind !== "doc");
      if (block.length) throw new Error(`${block.length} line(s) are not set or missing, for example: ${block.slice(0, 3).map((l) => l.label).join("; ")}.`);
      await tx.annualReturn.update({ where: { id: r.id }, data: { status: "Ready for review", readyById: ctx.user.id } });
      await log(tx, ctx, "ready", r.id, `Ready for review: ${r.title}`);
      return m.length;
    });
    revalidatePath(`/returns/${id}`);
    return { ok: docs ? `Ready for review. ${docs} supporting document(s) are not ready yet.` : "Ready for review." };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function reopenReturn(id: string, _s: State): Promise<State> {
  const ctx = await guard("write");
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const r = await load(tx, ctx, id);
      if (!["Ready for review", "Approved"].includes(r.status)) throw new Error("This return can't be reopened.");
      await tx.annualReturn.update({ where: { id: r.id }, data: { status: "Draft", readyById: null, approvedById: null, approvedAt: null } });
      await log(tx, ctx, "reopen", r.id, `Reopened ${r.title}${r.snapshotId ? " (approved snapshot kept)" : ""}`);
    });
    revalidatePath(`/returns/${id}`);
    return { ok: "Reopened for changes." };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function approveReturn(id: string, _s: State): Promise<State> {
  const ctx = await guard("approve");
  try {
    const hash = await withTenant(ctx.org.id, async (tx) => {
      const r = await load(tx, ctx, id);
      if (r.status !== "Ready for review") throw new Error("Only a return that is ready for review can be approved.");
      // Second-person rule: applies to everyone, platform administrators included.
      if (r.readyById === ctx.user.id) throw new Error("A different person must approve this annual return.");
      const lines = r.lines as Lines;
      const h = createHash("sha256").update(JSON.stringify(Object.keys(lines).sort().map((k) => [k, lines[k].status, lines[k].num ?? null, lines[k].text ?? null])) + JSON.stringify([r.periodStart, r.periodEnd, r.currencyMethod])).digest("hex");
      const versionNo = (await tx.returnSnapshot.count({ where: { organizationId: ctx.org.id, returnId: r.id } })) + 1;
      const snap = await tx.returnSnapshot.create({ data: { organizationId: ctx.org.id, returnId: r.id, versionNo, lines: J(lines), hash: h, approvedById: ctx.user.id } });
      await tx.annualReturn.update({ where: { id: r.id }, data: { status: "Approved", approvedById: ctx.user.id, approvedAt: new Date(), snapshotId: snap.id } });
      await log(tx, ctx, "approve", r.id, `Approved ${r.title}: snapshot ${versionNo}, fingerprint ${h.slice(0, 16)}`);
      return h;
    });
    revalidatePath(`/returns/${id}`);
    return { ok: `Approved. A fixed copy of the figures was kept (fingerprint ${hash.slice(0, 16)}).` };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Records what a person did. The system never submits the form itself. */
export async function recordSubmission(id: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  const g = (k: string) => String(f.get(k) ?? "").trim();
  if (!isDate(g("submitted_at")) || !g("submission_method") || !g("submitted_by_name")) return { error: "Please enter the date, how it was sent and who sent it." };
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const r = await load(tx, ctx, id);
      if (r.status !== "Approved") throw new Error("Approve the return before recording its submission.");
      await tx.annualReturn.update({ where: { id: r.id }, data: { status: "Submitted", submittedAt: g("submitted_at"), submission: { method: g("submission_method"), ref: g("submission_ref") || null, by: g("submitted_by_name") } } });
      await log(tx, ctx, "submission", r.id, `Submission recorded: ${g("submitted_at")} by ${g("submission_method")}`);
    });
    revalidatePath(`/returns/${id}`);
    return { ok: "Recorded." };
  } catch (e) { return { error: (e as Error).message }; }
}
