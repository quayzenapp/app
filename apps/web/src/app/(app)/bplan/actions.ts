"use server";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BP_COMMISSION, BP_SECTIONS, BP_YEARS, BP_YEAR_FIELDS, FUNDING_SOURCES, planHashBody } from "@/lib/bplan";
import { assertDifferentPerson, secondPersonRequired } from "@/lib/controls";
import { audit, withTenant, type Tx } from "@/lib/db";
import { can, getTenantContext, type TenantContext } from "@/lib/tenant";
import type { Prisma } from "@/generated/prisma/client";

export type State = { error?: string; ok?: string };
const J = (v: unknown) => v as Prisma.InputJsonValue;
const emptyYears = () => Array.from({ length: BP_YEARS }, () => ({}));
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
const log = (tx: Tx, ctx: TenantContext, action: string, id: string, summary: string) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action, entityType: "bplans", entityId: id, summary });
async function guard(level: "write" | "approve") {
  const ctx = await getTenantContext();
  if (!can(ctx, "bplan", level)) redirect("/forbidden");
  return ctx;
}
const load = async (tx: Tx, ctx: TenantContext, id: string) => {
  const v = await tx.businessPlan.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!v) throw new Error("This plan version no longer exists.");
  return v;
};
const nextVersion = async (tx: Tx, orgId: string) => ((await tx.businessPlan.aggregate({ where: { organizationId: orgId }, _max: { versionNo: true } }))._max.versionNo ?? 0) + 1;

export async function newPlan() {
  const ctx = await guard("write");
  const id = await withTenant(ctx.org.id, async (tx) => {
    const n = await nextVersion(tx, ctx.org.id);
    const v = await tx.businessPlan.create({ data: { organizationId: ctx.org.id, versionNo: n, title: "Business plan", commissionStatus: n === 1 ? BP_COMMISSION[0] : BP_COMMISSION[1], years: J(emptyYears()), preparedById: ctx.user.id } });
    await log(tx, ctx, "create", v.id, `Business plan v${n} being recorded`);
    return v.id;
  });
  redirect(`/bplan/${id}/edit`);
}

export async function savePlan(id: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  const g = (k: string) => String(f.get(k) ?? "").trim();
  const errs: string[] = [];
  const years = Array.from({ length: BP_YEARS }, (_, i) => {
    const y: Record<string, unknown> = {};
    for (const [k, l, t] of BP_YEAR_FIELDS) {
      const x = g(`y${i}_${k}`);
      if (!x) { y[k] = null; continue; }
      if (t === "num" || t === "int") {
        const n = Number(x.replace(/,/g, ""));
        if (!Number.isFinite(n)) { errs.push(`${l}, year ${i + 1}: please enter a number.`); continue; }
        y[k] = t === "int" ? Math.round(n) : n;
      } else y[k] = x.slice(0, 600);
    }
    return y;
  });
  const sections = Object.fromEntries(BP_SECTIONS.map(([k]) => [k, g(`s_${k}`).slice(0, 5000)]));
  const raw = g("milestones").split("\n").map((s) => s.trim()).filter(Boolean);
  const title = g("title").slice(0, 200), year1 = g("year1_start"), cdate = g("commission_date");
  if (!title) errs.push("Title is required.");
  if (year1 && !isDate(year1)) errs.push("Year 1 start: use the date format YYYY-MM-DD.");
  if (cdate && !isDate(cdate)) errs.push("Date given to the Commission: use the date format YYYY-MM-DD.");
  const status = BP_COMMISSION.includes(g("commission_status")) ? g("commission_status") : BP_COMMISSION[0];
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const v = await load(tx, ctx, id);
      if (v.status !== "Draft") throw new Error("Only a draft can be edited.");
      const old = v.milestones as { milestone: string }[];
      const milestones = raw.map((s, i) => {
        const [m, d] = s.split(";").map((x) => x.trim());
        if (d && !isDate(d)) errs.push(`Milestone line ${i + 1}: use the date format YYYY-MM-DD.`);
        return { ...(old.find((x) => x.milestone === m) ?? {}), milestone: m, target_date: d || null };
      });
      if (errs.length) throw new Error(errs.join(" "));
      await tx.businessPlan.update({ where: { id: v.id }, data: { title, commissionStatus: status, commissionDate: cdate || null, commissionRef: g("commission_ref") || null, year1Start: year1 || null, changeSummary: g("change_summary") || null, years: J(years), sections: J(sections), milestones: J(milestones), preparedById: ctx.user.id } });
      await log(tx, ctx, "update", v.id, `Business plan v${v.versionNo} draft saved`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  redirect(`/bplan/${id}`);
}

export async function askForCheck(id: string, _s: State): Promise<State> {
  const ctx = await guard("write");
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const v = await load(tx, ctx, id);
      if (v.status !== "Draft") throw new Error("Only a draft can be sent for checking.");
      if (!v.year1Start) throw new Error("Set the Year 1 start date first, so plan years can be lined up with actual records.");
      await tx.businessPlan.update({ where: { id: v.id }, data: { status: "Ready for check", readyById: ctx.user.id } });
      await log(tx, ctx, "ready", v.id, `v${v.versionNo} ready for check`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/bplan/${id}`);
  return { ok: "Sent for checking." };
}
export async function backToDraft(id: string, _s: State): Promise<State> {
  const ctx = await guard("write");
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const v = await load(tx, ctx, id);
      if (v.status !== "Ready for check") throw new Error("Only a plan waiting for a check can go back to draft.");
      await tx.businessPlan.update({ where: { id: v.id }, data: { status: "Draft", readyById: null } });
      await log(tx, ctx, "draft", v.id, `v${v.versionNo} returned to draft`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/bplan/${id}`);
  return { ok: "Back to draft." };
}
export async function lockPlan(id: string, _s: State): Promise<State> {
  const ctx = await guard("approve");
  const separate = await secondPersonRequired(ctx.org.id);
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const v = await load(tx, ctx, id);
      if (v.status !== "Ready for check") throw new Error("Only a plan waiting for a check can be locked.");
      assertDifferentPerson(separate, v.readyById ?? v.preparedById, ctx.user.id, "check and lock this business plan");
      const hash = createHash("sha256").update(planHashBody(v)).digest("hex");
      await tx.businessPlan.update({ where: { id: v.id }, data: { status: "Locked", lockedById: ctx.user.id, lockedByName: ctx.user.name, lockedAt: new Date(), hash } });
      await log(tx, ctx, "lock", v.id, `v${v.versionNo} checked and locked, fingerprint ${hash.slice(0, 16)}${separate ? "" : " (second-person check off)"}`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/bplan/${id}`);
  return { ok: "Checked and locked. It can now be used for comparison." };
}
export async function setReference(id: string, _s: State): Promise<State> {
  const ctx = await guard("write");
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const v = await load(tx, ctx, id);
      if (v.status !== "Locked") throw new Error("Only a locked version can be used for comparison.");
      await tx.businessPlan.updateMany({ where: { organizationId: ctx.org.id, isReference: true }, data: { isReference: false } });
      await tx.businessPlan.update({ where: { id: v.id }, data: { isReference: true } });
      await log(tx, ctx, "reference", v.id, `v${v.versionNo} set as comparison reference`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/bplan/${id}`);
  return { ok: "This version is now used for comparison." };
}
export async function revisePlan(id: string) {
  const ctx = await guard("write");
  const nid = await withTenant(ctx.org.id, async (tx) => {
    const v = await load(tx, ctx, id);
    if (v.status !== "Locked") throw new Error("Only a locked version can be revised.");
    const n = await nextVersion(tx, ctx.org.id);
    const c = await tx.businessPlan.create({ data: { organizationId: ctx.org.id, versionNo: n, title: v.title, commissionStatus: BP_COMMISSION[1], year1Start: v.year1Start, sections: J(v.sections), years: J(v.years), milestones: J(v.milestones), parentId: v.id, preparedById: ctx.user.id } });
    await log(tx, ctx, "create", c.id, `v${n} started as a revision of v${v.versionNo}`);
    return c.id;
  });
  redirect(`/bplan/${nid}/edit`);
}
export async function verifyFingerprint(id: string, _s: State): Promise<State> {
  const ctx = await getTenantContext();
  if (!can(ctx, "bplan")) redirect("/forbidden");
  const v = await withTenant(ctx.org.id, (tx) => load(tx, ctx, id));
  if (!v.hash) return { error: "This version has no fingerprint yet." };
  return createHash("sha256").update(planHashBody(v)).digest("hex") === v.hash ? { ok: "Fingerprint matches: the locked figures have not changed." } : { error: "Fingerprint does not match the locked figures. Check the history." };
}
/** Progress and explanations stay editable after locking. They are not part of the plan as submitted. */
export async function saveProgress(id: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  const STATUSES = ["", "Not started", "In progress", "Achieved", "Delayed", "Dropped"];
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const v = await load(tx, ctx, id);
      const ms = (v.milestones as Record<string, unknown>[]).map((m, i) => {
        const st = String(f.get(`ms${i}_status`) ?? ""), dt = String(f.get(`ms${i}_date`) ?? "");
        if (dt && !isDate(dt)) throw new Error(`Milestone ${i + 1}: use the date format YYYY-MM-DD.`);
        return { ...m, actual_status: STATUSES.includes(st) ? st || null : null, actual_date: dt || null, actual_note: String(f.get(`ms${i}_note`) ?? "").trim().slice(0, 500) || null };
      });
      await tx.businessPlan.update({ where: { id: v.id }, data: { milestones: J(ms) } });
      await log(tx, ctx, "progress", v.id, `v${v.versionNo}: milestone progress updated`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/bplan/${id}`);
  return { ok: "Progress saved." };
}
export async function saveExplanations(id: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const v = await load(tx, ctx, id);
      const notes: Record<string, string> = { ...(v.notes as Record<string, string>) };
      for (const [k, val] of f.entries()) if (/^note_\d+:[a-z_]+$/.test(k)) { const t = String(val).trim().slice(0, 1000); if (t) notes[k.slice(5)] = t; else delete notes[k.slice(5)]; }
      await tx.businessPlan.update({ where: { id: v.id }, data: { notes: J(notes) } });
      await log(tx, ctx, "explanation", v.id, `v${v.versionNo}: explanations of differences updated`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath("/bplan");
  revalidatePath(`/bplan/${id}`);
  return { ok: "Explanations saved." };
}

const cellVal = (v: ExcelJS.CellValue): unknown => { if (v instanceof Date) return v.toISOString().slice(0, 10); if (v && typeof v === "object") { if ("result" in v) return cellVal(v.result as ExcelJS.CellValue); if ("text" in v) return v.text; if ("richText" in v) return v.richText.map((t) => t.text).join(""); return null; } return v; };
/** Reads the Quayzen template. Anything else is refused rather than guessed. */
export async function importFigures(id: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  const file = f.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Please choose the Excel template." };
  if (file.size > 5 * 1024 * 1024) return { error: "Files can be up to 5 MB." };
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); } catch { return { error: "This file couldn't be read. Please use the Excel .xlsx template." }; }
  const ws = wb.getWorksheet("Business plan figures");
  if (!ws) return { error: "This isn't the Quayzen template, so nothing was changed. Download the template and copy the figures into it." };
  let hdr = 0;
  ws.eachRow((r, n) => { if (!hdr && String(cellVal(r.getCell(1).value) ?? "").trim().toLowerCase() === "item" && /year 1/i.test(String(cellVal(r.getCell(2).value) ?? ""))) hdr = n; });
  if (!hdr) return { error: "The template's header row (Item, Year 1, Year 2 ...) was not found, so nothing was changed." };
  const years: Record<string, unknown>[] = emptyYears(), warn: string[] = [];
  let year1: string | null = null;
  ws.eachRow((r, n) => {
    if (n <= hdr) return;
    const label = String(cellVal(r.getCell(1).value) ?? "").trim();
    if (!label) return;
    if (/^year 1 starts/i.test(label)) { const v = String(cellVal(r.getCell(2).value) ?? "").trim(); if (v && isDate(v)) year1 = v; else if (v) warn.push(`Year 1 start '${v}' isn't a date in the form YYYY-MM-DD; left unchanged.`); return; }
    const fld = BP_YEAR_FIELDS.find(([, l]) => l.toLowerCase() === label.toLowerCase());
    if (!fld) { warn.push(`Row ${n}: '${label}' isn't one of the template's items, so it was skipped.`); return; }
    const [k, , t] = fld;
    for (let y = 0; y < BP_YEARS; y++) {
      const x = cellVal(r.getCell(y + 2).value);
      if (x == null || x === "") continue;
      const ref = `row ${n}, year ${y + 1}`;
      if (t === "choice") { if (FUNDING_SOURCES.includes(String(x).trim())) years[y][k] = String(x).trim(); else warn.push(`${ref}: source of funding '${x}' isn't one of the choices; skipped.`); }
      else if (t === "yn") { const s = /^y/i.test(String(x)) ? "Yes" : /^n/i.test(String(x)) ? "No" : null; if (s) years[y][k] = s; else warn.push(`${ref}: '${x}' should be Yes or No; skipped.`); }
      else if (t === "text") years[y][k] = String(x).trim().slice(0, 600);
      else { const v = typeof x === "number" ? x : Number(String(x).replace(/[, ]/g, "")); if (Number.isFinite(v)) years[y][k] = t === "int" ? Math.round(v) : v; else warn.push(`${ref}: '${x}' isn't a number; skipped.`); }
    }
  });
  const filled = years.reduce((t, y) => t + Object.keys(y).length, 0);
  if (!filled) return { error: "No figures were found in the template, so nothing was changed." };
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const v = await load(tx, ctx, id);
      if (v.status !== "Draft") throw new Error("Only a draft can be edited.");
      await tx.businessPlan.update({ where: { id: v.id }, data: { years: J(years), ...(year1 ? { year1Start: year1 } : {}), preparedById: ctx.user.id } });
      await log(tx, ctx, "import", v.id, `v${v.versionNo}: ${filled} figures imported from ${file.name}`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/bplan/${id}/edit`);
  return { ok: `${filled} figures imported. Check them against the plan.${warn.length ? ` Skipped: ${warn.slice(0, 8).join(" ")}` : ""}` };
}
