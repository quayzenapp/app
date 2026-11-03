"use server";
import { assertPeopleVisible, assertNoticeDateMapping } from "@/lib/lic/export-checks";
import { readPersonTable } from "@/lib/lic/person-tables";
import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, withTenant, type Tx } from "@/lib/db";
import { assertDifferentPerson, secondPersonRequired } from "@/lib/controls";
import { can, getTenantContext, type TenantContext } from "@/lib/tenant";
import { hiddenPersonKeys } from "@/lib/lic/store";
import { L, changeItemId, fullDetails, locked, CHANGE_NEXT, changeDue, validateItems, o3Sensitivity, validDate, type Rec, type ChangeItem } from "@/lib/lic/changes";
import { O3_SPEC } from "@/lib/lic/change-spec";
import { loadReportStore } from "@/lib/reports/store";
import type { Prisma } from "@/generated/prisma/client";
export type State = { error?: string; ok?: string };
const J = (x: unknown) => x as Prisma.InputJsonValue;
const clean = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
async function guard(level: "write" | "approve" = "write") { const ctx = await getTenantContext(); if (!can(ctx, "licensing", level)) redirect("/forbidden"); return ctx; }
const log = (tx: Tx, ctx: TenantContext, id: string, action: string, summary: string) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, entityType: "filings", entityId: id, action, summary });
async function load(tx: Tx, ctx: TenantContext, id: string) {
  // Serialize edits, status changes and snapshot version numbers on this filing.
  await tx.$queryRaw`SELECT id FROM licence_filings WHERE id=${id} AND "organizationId"=${ctx.org.id} FOR UPDATE`;
  const row = await tx.licenceFiling.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!row) throw new Error("This filing no longer exists.");
  return row;
}
const event = (ctx: TenantContext, status: string, note: string) => ({ at: new Date().toISOString(), by: ctx.user.name, status, note });
export async function startChange(_s: State, f: FormData): Promise<State> {
  const ctx = await guard();
  const id = await withTenant(ctx.org.id, async (tx) => {
    const store = await loadReportStore(tx, ctx), c = store.company();
    const licence = store.get("licences", String(c.main_licence_id));
    const row = await tx.licenceFiling.create({ data: { organizationId: ctx.org.id, title: clean(f, "title")?.slice(0, 200) || "Notice of change", data: { name: c.name, licence_no: licence?.number || c.licence_number || "", items: [], people: [], offshore: false, o3: {} }, updatedById: ctx.user.id, events: J([event(ctx, "Draft", "Started. Check the suggested company and licence details.")]) } });
    await log(tx, ctx, row.id, "create", "Started notice of change"); return row.id;
  });
  redirect(`/changes/${id}`);
}
async function edit(id: string, ctx: TenantContext, apply: (d: Rec, f: FormData, tx: Tx) => void | Promise<void>, f: FormData): Promise<State> {
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const row = await load(tx, ctx, id); if (locked(row.status)) throw new Error("This filing has been submitted, so it is locked.");
      const d = structuredClone(row.data) as Rec; await apply(d, f, tx);
      const reset = row.status !== "Draft";
      await tx.licenceFiling.update({ where: { id, organizationId: ctx.org.id }, data: { data: J(d), dueDate: changeDue(d.items ?? []), updatedById: ctx.user.id, ...(reset ? { status: "Draft", snapshotId: null, events: J([...(row.events as object[]), event(ctx, "Draft", "Changed after review; approval must be repeated.")]) } : {}) } });
      await log(tx, ctx, id, "update", `Notice of change updated${reset ? "; returned to Draft" : ""}`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/changes/${id}`); revalidatePath("/changes"); return { ok: "Saved." };
}
export async function saveChange(id: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard();
  return edit(id, ctx, (d, f) => {
    d.name = clean(f, "name"); d.licence_no = clean(f, "licence_no");
    if (fullDetails(ctx.sensitive)) {
      const prev = (d.items ?? []) as ChangeItem[];
      const ids = f.getAll("__item").map(String);
      const byId = new Map(prev.map((item, i) => [changeItemId(item, i), item]));
      if (ids.length !== prev.length || new Set(ids).size !== ids.length || ids.some((key) => !byId.has(key))) throw new Error("The notice rows changed. Reload the notice before saving.");
      const items = ids.flatMap((key, i) => {
        const item = byId.get(key)!;
        return f.get(`remove:${i}`) ? [] : [{ id: item.id ?? randomUUID(), code: item.code, former: clean(f, `i.${i}.former`), new: clean(f, `i.${i}.new`), date: clean(f, `i.${i}.date`), reason: clean(f, `i.${i}.reason`) }];
      });
      const add = clean(f, "newcode"); if (add) items.push({ id: randomUUID(), code: add, former: null, new: null, date: null, reason: null });
      validateItems(items); d.items = items;
      d.signer = clean(f, "signer"); d.offshore = f.get("offshore") === "1";
    }
    d.o3 ??= {};
    for (const [k, , type] of O3_SPEC) {
      const sens = o3Sensitivity(k); if (sens && !ctx.sensitive.includes(sens)) continue;
      const v = type === "check" ? f.get(`o3.${k}`) === "1" : clean(f, `o3.${k}`);
      if (type === "date" && v && !validDate(String(v))) throw new Error("Offshore form: use a valid date.");
      L.setPath(d.o3, k, v);
    }
  }, f);
}
export async function saveFilingPerson(id: string, personId: string | null, _s: State, f: FormData): Promise<State> {
  const ctx = await guard();
  const result = await edit(id, ctx, (d, f) => {
    const people: Rec[] = d.people ?? [], old = personId ? people.find((p) => p.id === personId) : undefined;
    if (personId && !old) throw new Error("This person no longer exists.");
    const p: Rec = { ...old, id: personId ?? randomUUID() }, hidden = hiddenPersonKeys(ctx.sensitive);
    const seen = new Set(f.getAll("__seen").map(String));
    for (const s of L.PERSON_SPEC as Rec[]) {
      if (hidden.includes(s.k) || !seen.has(s.k)) continue;
      let v: unknown = s.t === "multi" ? f.getAll(s.k).map(String) : clean(f, s.k);
      if (s.t === "num" && v != null) { v = Number(String(v).replace(/,/g, "")); if (!Number.isFinite(v)) throw new Error(`${s.l}: please enter a number.`); }
      if (s.t === "rows") v = readPersonTable(s.k, f, p[s.k]);
      p.marks = { ...(p.marks ?? {}) };
      const mark = String(f.get(`mark:${s.k}`) ?? "");
      if (L.MARKS.includes(mark)) { p.marks[s.k] = mark; continue; }
      delete p.marks[s.k];
      p[s.k] = v;
    }
    if (!p.name) throw new Error("Please enter the name.");
    d.people = old ? people.map((x) => x.id === p.id ? p : x) : [...people, p];
  }, f);
  if (result.error) return result;
  redirect(`/changes/${id}`);
}
export async function removeFilingPerson(id: string, personId: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard();
  return edit(id, ctx, async (d, _form, tx) => {
    const person = (d.people ?? []).find((p: Rec) => p.id === personId);
    if (!person) throw new Error("This person no longer exists.");
    try { assertPeopleVisible([person], ctx.sensitive); }
    catch { throw new Error("Cannot remove this person: restricted fields have values your role cannot see."); }
    d.people = d.people.filter((p: Rec) => p.id !== personId);
    await log(tx, ctx, id, "delete", "Person removed from notice");
  }, f);
}
export async function filingStatus(id: string, to: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard(to === "Approved" ? "approve" : "write");
  try {
    const separate = await secondPersonRequired(ctx.org.id);
    await withTenant(ctx.org.id, async (tx) => {
      const row = await load(tx, ctx, id), d = row.data as Rec;
      if (!(CHANGE_NEXT[row.status] ?? []).includes(to)) throw new Error(`A filing that is ${row.status} cannot move to ${to}.`);
      let sid = row.snapshotId, note = clean(f, "note") ?? "";
      if (to === "Approved") {
        assertNoticeDateMapping(d);
        assertDifferentPerson(separate, row.updatedById, ctx.user.id, "approve this filing");
        if (!fullDetails(ctx.sensitive)) throw new Error("Approval needs personal and identity access so the reviewer can check every field.");
        for (const spec of L.PERSON_SPEC as Rec[]) if (spec.sens && !ctx.sensitive.includes(spec.sens) && (d.people ?? []).some((p: Rec) => p[spec.k] != null)) throw new Error("Approval needs access to every restricted profile field.");
        const versionNo = await tx.filingSnapshot.count({ where: { organizationId: ctx.org.id, filingId: id } }) + 1;
        const hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
        const snap = await tx.filingSnapshot.create({ data: { organizationId: ctx.org.id, filingId: id, versionNo, body: J(d), hash, approvedById: ctx.user.id } });
        sid = snap.id; note = `Approved copy ${versionNo}, fingerprint ${hash}`;
        await log(tx, ctx, id, "approve", note);
      }
      if (to === "Ready for review" && !(d.items ?? []).length) throw new Error("Add at least one change first.");
      if (["Submitted", "Acknowledged"].includes(to)) {
        const date = clean(f, "date"); if (!date || !validDate(date)) throw new Error("Enter the date of the action you are recording.");
        if (!sid) throw new Error("An approved copy is required.");
        note = [date, clean(f, "ref"), note].filter(Boolean).join(" · ");
      }
      await tx.licenceFiling.update({ where: { id, organizationId: ctx.org.id }, data: { status: to, snapshotId: to === "Draft" ? null : sid, events: J([...(row.events as object[]), event(ctx, to, note)]) } });
      await log(tx, ctx, id, "status", `Notice of change: ${row.status} → ${to}`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/changes/${id}`); revalidatePath("/changes"); return { ok: "Recorded." };
}
