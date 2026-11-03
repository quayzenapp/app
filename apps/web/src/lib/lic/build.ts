import { assertPersonTables } from "@/lib/lic/person-tables";
import { assertPeopleVisible, hasStoredValue } from "@/lib/lic/export-checks";
import { getForm } from "@/lib/forms";
import { withTenant } from "@/lib/db";
import { createGen } from "@/lib/lic/gen";
import { S, stripPerson, toEngineApp, toEnginePerson } from "@/lib/lic/store";
import { loadReportStore } from "@/lib/reports/store";
import type { TenantContext } from "@/lib/tenant";

type Rec = Record<string, unknown>;
export type Out = { name: string; blob: Blob; check?: { problems?: string[] } };
export const BUILD: Record<string, (G: any, a: Rec) => Promise<Out | Out[]>> = {
  s1: (G, a) => G.buildSchedule1(a), tef: (G, a) => G.buildTef(a), ap_decl: (G, a) => G.buildApDeclaration(a), ubo: (G, a) => G.buildUboDeclarations(a), ds: (G, a) => G.buildDsInfo(a), bprofile: (G, a) => G.buildBusinessProfile(a),
};
export const type = (n: string) => (n.endsWith(".pdf") ? "application/pdf" : n.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : n.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/zip");

/** Loads what the builders need. Once approved it's the fixed copy. Restricted fields are stripped by role first. */
export async function loadGen(ctx: TenantContext, id: string, key?: string) {
  const data = await withTenant(ctx.org.id, async (tx) => {
    const row = await tx.application.findFirst({ where: { id, organizationId: ctx.org.id } });
    if (!row) return null;
    const base = await loadReportStore(tx, ctx);
    const final = row.snapshotId && ![S.prep, S.ready, S.info].includes(row.status);
    const snap = final ? await tx.applicationSnapshot.findFirst({ where: { id: row.snapshotId!, organizationId: ctx.org.id } }) : null;
    const body = snap?.body as { app: Rec; people: Rec[] } | undefined;
    const people = body?.people ?? (await tx.applicationPerson.findMany({ where: { applicationId: id, organizationId: ctx.org.id }, orderBy: { createdAt: "asc" } })).map(toEnginePerson);
    if (!key || ["s1", "ds"].includes(key)) { assertPeopleVisible(people, ctx.sensitive); assertPersonTables(people); }
    // UBO declarations also read register data. Check the original values before loadReportStore's stripped copy is used.
    if ((!key || key === "ubo") && ctx.sensitive.includes("ubo")) {
      const form = await getForm(ctx.org.id, "ubo");
      const owners = await tx.record.findMany({ where: { organizationId: ctx.org.id, formKey: "ubo", archivedAt: null } });
      for (const owner of owners) for (const f of form?.fields ?? []) if (f.sensitive && !ctx.sensitive.includes(f.sensitive) && hasStoredValue((owner.data as Rec)[f.name])) throw new Error(`Cannot prepare the forms: restricted field "${f.name}" has a value your role cannot see.`);
    }
    return { base, a: body?.app ?? toEngineApp(row), people: people.map((p) => stripPerson(p, ctx.sensitive)), final: !!snap };
  });
  if (!data) return null;
  const store = { ...data.base, list: (t: string) => (t === "app_people" ? data.people : data.base.list(t)) };
  return { G: createGen(store), a: data.a, final: data.final, prefix: `${ctx.org.isDemo ? "DEMO_" : ""}${data.final ? "" : "DRAFT_"}` };
}
