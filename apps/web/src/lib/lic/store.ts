import type { Tx } from "@/lib/db";
import { createLic } from "@/lib/lic/core";
import { loadReportStore } from "@/lib/reports/store";
import type { TenantContext } from "@/lib/tenant";
import type { Application, ApplicationPerson } from "@/generated/prisma/client";

export const toEngineApp = (a: Application) => ({ ...(a.data as object), id: a.id, title: a.title, status: a.status, events: a.events });
export const toEnginePerson = (p: ApplicationPerson) => ({ ...(p.data as object), id: p.id, app_id: p.applicationId, updated_by: p.updatedById, created_at: p.createdAt.toISOString() });

/** Readiness reads people's full records on the server and only returns counts and labels. Use stripPerson before anything reaches a page. */
export async function loadLic(tx: Tx, ctx: TenantContext) {
  const base = await loadReportStore(tx, ctx);
  const [apps, people] = await Promise.all([tx.application.findMany({ where: { organizationId: ctx.org.id } }), tx.applicationPerson.findMany({ where: { organizationId: ctx.org.id } })]);
  const lists: Record<string, Record<string, unknown>[]> = { apps: apps.map(toEngineApp), app_people: people.map(toEnginePerson) };
  const store = { ...base, list: (t: string) => lists[t] ?? base.list(t), get: (t: string, id: string) => (lists[t] ? lists[t].find((x) => x.id === id) ?? null : base.get(t, id)) };
  return createLic(store);
}
const SPEC = createLic();
/** Removes restricted person fields this role can't see. */
export function stripPerson<T extends Record<string, unknown>>(p: T, sensitive: string[]): T {
  const out: Record<string, unknown> = { ...p };
  for (const f of SPEC.PERSON_SPEC as { k: string; sens?: string }[]) if (f.sens && !sensitive.includes(f.sens)) delete out[f.k];
  return out as T;
}
export const hiddenPersonKeys = (sensitive: string[]) => (SPEC.PERSON_SPEC as { k: string; sens?: string }[]).filter((f) => f.sens && !sensitive.includes(f.sens)).map((f) => f.k);
export const LOCKED: string[] = SPEC.APP_LOCKED;
export const S = SPEC.APP_STATUS as Record<string, string>;
/** The moves the artifact offers from each status. The server refuses any other. */
export const NEXT: Record<string, string[]> = {
  [S.prep]: [S.ready, S.withdrawn], [S.info]: [S.ready, S.withdrawn], [S.ready]: [S.prep], [S.approved]: [S.submitted, S.prep],
  [S.submitted]: [S.aip, S.info, S.rejected, S.withdrawn], [S.aip]: [S.clear, S.issued], [S.clear]: [S.issued, S.info],
};
export const safePath = (k: string) => !/(^|\.)(__proto__|constructor|prototype)(\.|$)/.test(k);
