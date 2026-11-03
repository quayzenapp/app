"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertDifferentPerson, secondPersonRequired } from "@/lib/controls";
import { audit, db, withTenant, type Tx } from "@/lib/db";
import { createLic } from "@/lib/lic/core";
import { LOCKED, NEXT, S, hiddenPersonKeys, safePath, loadLic, toEngineApp, toEnginePerson } from "@/lib/lic/store";
import { can, getTenantContext, type TenantContext } from "@/lib/tenant";
import type { Application, Prisma } from "@/generated/prisma/client";

export type State = { error?: string; ok?: string };
const L = createLic();
const J = (v: unknown) => v as Prisma.InputJsonValue;
const nowIso = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const log = (tx: Tx, ctx: TenantContext, action: string, id: string, summary: string) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action, entityType: "apps", entityId: id, summary });
async function guard(level: "write" | "approve") {
  const ctx = await getTenantContext();
  if (!can(ctx, "licensing", level)) redirect("/forbidden");
  return ctx;
}
const load = async (tx: Tx, ctx: TenantContext, id: string) => {
  const a = await tx.application.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!a) throw new Error("This application no longer exists.");
  return a;
};
const assertOpen = (a: Application) => { if (LOCKED.includes(a.status)) throw new Error("This application is locked because it has been submitted. Reopen it if the Commission asked for more information."); };
/** A change after review sends it back to Preparing, so nobody submits something the reviewer didn't see. */
const reviewReset = (a: Application, what: string, ctx: TenantContext) => ([S.ready, S.approved].includes(a.status) ? { status: S.prep, events: J([...(a.events as object[]), { at: nowIso(), by: ctx.user.name, status: S.prep, note: `Changed after ${a.status.toLowerCase()}: ${what}` }]) } : {});
const clean = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); return s || null; };
const toNum = (s: string, label: string) => { const n = Number(s.replace(/,/g, "")); if (!Number.isFinite(n)) throw new Error(`${label}: please enter a number.`); return n; };

export async function startApplication(_s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  const type = String(f.get("app_type") ?? ""), title = String(f.get("title") ?? "").trim().slice(0, 200) || `${type} application`;
  if (!L.APP_TYPES.includes(type)) return { error: "Please choose the application type." };
  const id = await withTenant(ctx.org.id, async (tx) => {
    const a = await tx.application.create({ data: { organizationId: ctx.org.id, title, data: { app_type: type }, events: [{ at: nowIso(), by: ctx.user.name, status: S.prep, note: "Started" }], preparedById: ctx.user.id, updatedById: ctx.user.id } });
    await log(tx, ctx, "create", a.id, `Started ${title}`);
    return a.id;
  });
  redirect(`/apply/${id}?step=applicant`);
}

/** Extra named inputs each custom step may send. Nothing else from the form is stored. */
const EXTRA: Record<string, RegExp> = {
  proposal: /^p6\.mp\.(mp|ts|sk|us|cg)\.\w+$/,
  projections: /^tef\.(year1|v\.\w+\.\d|d\.\w+\.(provider|docref))$/,
  profile: /^prof\.(sectors|years_exp|countries|segments|client_sectors|entities\.\d{1,2}\.(name|country|type|years)|parent\.\w+)$/,
  declarations: /^decl\.(director1|director2|parent_name|parent_address|presenter\.\w+)$/,
};
const clone = (o: unknown): Record<string, any> => JSON.parse(JSON.stringify(o));

export async function saveStep(id: string, step: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const a = await load(tx, ctx, id);
      assertOpen(a);
      const d = clone(a.data);
      d.marks = { ...(d.marks ?? {}) };
      const seen = new Set(f.getAll("__seen").map(String));
      for (const s of L.APP_SPEC.filter((x: { step: string }) => x.step === step) as { k: string; l: string; t: string }[]) {
        if (!seen.has(s.k)) continue; // not shown, because it doesn't apply: keep what's there
        const m = String(f.get(`mark:${s.k}`) ?? "");
        if (L.MARKS.includes(m)) { d.marks[s.k] = m; continue; }
        delete d.marks[s.k];
        let v: unknown;
        if (s.t === "multi") v = f.getAll(s.k).map(String);
        else if (s.t === "check") v = f.get(s.k) === "1";
        else { v = clean(f.get(s.k)); if (s.t === "num" && v != null) v = toNum(String(v), s.l); }
        L.setPath(d, s.k, v);
      }
      const rx = EXTRA[step];
      if (rx) for (const k of new Set(f.keys())) {
        if (!rx.test(k) || !safePath(k)) continue;
        let v: unknown = clean(f.get(k));
        if (v != null && /^tef\.v\./.test(k)) v = toNum(String(v), "Projections");
        L.setPath(d, k, v);
      }
      await tx.application.update({ where: { id: a.id }, data: { data: J(d), updatedById: ctx.user.id, ...reviewReset(a, step, ctx) } });
      await log(tx, ctx, "update", a.id, `${a.title}: ${step} saved`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/apply/${id}`);
  return { ok: "Saved." };
}

export async function savePerson(id: string, personId: string | null, _s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  const hidden = hiddenPersonKeys(ctx.sensitive);
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const a = await load(tx, ctx, id);
      assertOpen(a);
      const existing = personId ? await tx.applicationPerson.findFirst({ where: { id: personId, applicationId: a.id, organizationId: ctx.org.id } }) : null;
      if (personId && !existing) throw new Error("This person is no longer on the application.");
      const d = clone(existing?.data ?? {});
      d.marks = { ...(d.marks ?? {}) };
      const seen = new Set(f.getAll("__seen").map(String));
      for (const s of L.PERSON_SPEC as { k: string; l: string; t: string }[]) {
        if (hidden.includes(s.k) || !seen.has(s.k)) continue; // a role can't overwrite what it can't see
        const m = String(f.get(`mark:${s.k}`) ?? "");
        if (L.MARKS.includes(m)) { d.marks[s.k] = m; continue; }
        delete d.marks[s.k];
        let v: unknown;
        if (s.t === "multi") v = f.getAll(s.k).map(String);
        else { v = clean(f.get(s.k)); if (s.t === "num" && v != null) v = toNum(String(v), s.l); }
        d[s.k] = v;
      }
      if (!d.name) throw new Error("Please enter the name.");
      if (existing) await tx.applicationPerson.update({ where: { id: existing.id }, data: { data: J(d), updatedById: ctx.user.id } });
      else await tx.applicationPerson.create({ data: { organizationId: ctx.org.id, applicationId: a.id, data: J(d), updatedById: ctx.user.id } });
      await tx.application.update({ where: { id: a.id }, data: { updatedById: ctx.user.id, ...reviewReset(a, "people", ctx) } });
      await log(tx, ctx, existing ? "update" : "create", a.id, `${a.title}: person ${existing ? "updated" : "added"}`); // no names or identity details in the log
    });
  } catch (e) { return { error: (e as Error).message }; }
  redirect(`/apply/${id}?step=people`);
}
export async function removePerson(id: string, personId: string) {
  const ctx = await guard("write");
  await withTenant(ctx.org.id, async (tx) => {
    const a = await load(tx, ctx, id);
    assertOpen(a);
    const r = await tx.applicationPerson.deleteMany({ where: { id: personId, applicationId: a.id, organizationId: ctx.org.id } });
    if (r.count) { await tx.application.update({ where: { id: a.id }, data: { updatedById: ctx.user.id, ...reviewReset(a, "people", ctx) } }); await log(tx, ctx, "delete", a.id, `${a.title}: person removed`); }
  });
  revalidatePath(`/apply/${id}`);
}
export async function saveChecklist(id: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const a = await load(tx, ctx, id);
      assertOpen(a);
      const lic = await loadLic(tx, ctx), d = clone(a.data), st: Record<string, object> = { ...((d.checklist as object) ?? {}) };
      for (const r of lic.checklistRows(toEngineApp(a)) as { key: string }[]) {
        const status = String(f.get(`st:${r.key}`) ?? "");
        if (!L.CL_STATUS.includes(status)) continue;
        const cert = clean(f.get(`cert:${r.key}`));
        if (cert && !/^\d{4}-\d{2}-\d{2}$/.test(cert)) throw new Error("Certified on: use the date format YYYY-MM-DD.");
        st[r.key] = { ...(st[r.key] ?? {}), status, cert_date: cert, note: clean(f.get(`note:${r.key}`)) };
      }
      d.checklist = st;
      await tx.application.update({ where: { id: a.id }, data: { data: J(d), updatedById: ctx.user.id, ...reviewReset(a, "documents", ctx) } });
      await log(tx, ctx, "update", a.id, `${a.title}: document checklist saved`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/apply/${id}`);
  return { ok: "Saved." };
}
const addMonths12 = (d: string) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + 12); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
/** Records what a person did. The system has sent nothing. */
export async function changeStatus(id: string, to: string, _s: State, f: FormData): Promise<State> {
  const ctx = await guard("write");
  const fields = (L.STATUS_FIELDS[to] ?? []) as [string, string, unknown, boolean?][];
  const g = (k: string) => String(f.get(k) ?? "").trim();
  const miss = fields.filter((x) => x[3] && !g(x[0])).map((x) => `${x[1]} is required.`);
  if (miss.length) return { error: miss.join(" ") };
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const a = await load(tx, ctx, id);
      if (!(NEXT[a.status] ?? []).includes(to)) throw new Error(`An application that is "${a.status}" can't move to "${to}".`);
      const d = clone(a.data);
      if (to === S.submitted) Object.assign(d, { submitted_date: g("date"), submission_method: g("method"), submission_ref: g("ref") || null });
      if (to === S.aip) Object.assign(d, { aip_date: g("date"), aip_ref: g("ref") || null, aip_conditions: g("conditions") || null });
      if (to === S.issued) Object.assign(d, { licence_number: g("licence_number"), licence_issue_date: g("date"), licence_expiry_date: g("expiry") || addMonths12(g("date")), agreement_date: g("agreement") || null, cert_reg: g("cert_reg") || null, licence_conditions: g("conditions") || null });
      if (to === S.info && f.get("log")) {
        const r = await tx.record.create({ data: { organizationId: ctx.org.id, formKey: "requests", createdById: ctx.user.id, updatedById: ctx.user.id, data: { title: `Further information on the licence application: ${a.title}`, category: "Licence and approvals", authority: "Colombo Port City Economic Commission", received_date: g("date"), status: "New", required_info: g("note") } } });
        await audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "create", entityType: "requests", entityId: r.id, summary: "Logged from the licence application" });
      }
      const ev = { at: nowIso(), by: ctx.user.name, status: to, date: g("date") || null, ref: g("ref") || g("licence_number") || null, note: [g("method"), g("note") || g("conditions")].filter(Boolean).join(" - ") || null };
      await tx.application.update({ where: { id: a.id }, data: { status: to, data: J(d), events: J([...(a.events as object[]), ev]), updatedById: ctx.user.id } });
      await log(tx, ctx, "status", a.id, `${a.title}: ${to}`);
      if (to === S.issued) await db.organization.update({ where: { id: ctx.org.id }, data: { stage: "licensed" } });
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/apply/${id}`);
  return { ok: "Recorded." };
}
/** Second-person approval with a fixed copy. Any gaps are recorded with the approval. */
export async function approveApplication(id: string, _s: State): Promise<State> {
  const ctx = await guard("approve");
  const separate = await secondPersonRequired(ctx.org.id);
  try {
    await withTenant(ctx.org.id, async (tx) => {
      const a = await load(tx, ctx, id);
      if (a.status !== S.ready) throw new Error("Only an application that is ready for review can be approved.");
      assertDifferentPerson(separate, a.updatedById, ctx.user.id, "approve the application");
      const people = await tx.applicationPerson.findMany({ where: { applicationId: a.id, organizationId: ctx.org.id }, orderBy: { createdAt: "asc" } });
      if (separate && people.some((p) => p.updatedById === ctx.user.id)) throw new Error("A different person must approve the application. You changed the people details in it.");
      const R = (await loadLic(tx, ctx)).appReadiness(toEngineApp(a));
      const gaps = R.steps.reduce((t: number, s: { missing: unknown[] }) => t + s.missing.length, 0) + (R.docs.total - R.docs.ok);
      const body = { app: toEngineApp(a), people: people.map(toEnginePerson) };
      const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
      const versionNo = (await tx.applicationSnapshot.count({ where: { organizationId: ctx.org.id, applicationId: a.id } })) + 1;
      const snap = await tx.applicationSnapshot.create({ data: { organizationId: ctx.org.id, applicationId: a.id, versionNo, body: J(body), hash, gaps, approvedById: ctx.user.id } });
      const note = `Approved copy ${versionNo}, fingerprint ${hash.slice(0, 16)}${gaps ? `, with ${gaps} item(s) still missing or not ready` : ""}${separate ? "" : " (second-person check off)"}`;
      await tx.application.update({ where: { id: a.id }, data: { status: S.approved, approvedById: ctx.user.id, approvedAt: new Date(), snapshotId: snap.id, events: J([...(a.events as object[]), { at: nowIso(), by: ctx.user.name, status: S.approved, note }]) } });
      await log(tx, ctx, "approve", a.id, `${a.title}: ${note}`);
    });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/apply/${id}`);
  return { ok: "Approved for submission." };
}
