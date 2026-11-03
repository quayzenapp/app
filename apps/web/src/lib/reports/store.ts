import { canRestricted, visibleWhere } from "@/lib/documents";
import { audit, type Tx, withTenant } from "@/lib/db";
import { getForms, stripSensitive } from "@/lib/forms";
import { loadCompany, toEngine } from "@/lib/ar/store";
import { createReports } from "@/lib/reports/engine";
import { sezDeep } from "@/lib/sections";
import { can as canModule, type TenantContext } from "@/lib/tenant";
import type { Report } from "@/lib/report-export";
import type { BusinessPlan } from "@/generated/prisma/client";

type Row = Record<string, unknown> & { id: string };
export const toEnginePlan = (v: BusinessPlan) => ({ id: v.id, title: v.title, version_no: v.versionNo, status: v.status, commission_status: v.commissionStatus, commission_date: v.commissionDate, year1_start: v.year1Start, years: v.years, milestones: v.milestones, notes: v.notes, is_reference: v.isReference, hash: v.hash });
/** Everything a report can read, already reduced to what this role may see. Restricted values never enter the engine. */
export async function loadReportStore(tx: Tx, ctx: TenantContext) {
  const forms = await getForms(ctx.org.id);
  const company = await loadCompany(ctx.org.id);
  const [records, returns, snapshots, docs, plans] = await Promise.all([
    tx.record.findMany({ where: { organizationId: ctx.org.id, archivedAt: null } }),
    tx.annualReturn.findMany({ where: { organizationId: ctx.org.id } }),
    tx.returnSnapshot.findMany({ where: { organizationId: ctx.org.id } }),
    tx.document.findMany({ where: visibleWhere(ctx), include: { _count: { select: { versions: true } } } }),
    tx.businessPlan.findMany({ where: { organizationId: ctx.org.id } }),
  ]);
  const by = new Map<string, Row[]>();
  for (const r of records) {
    const form = forms.find((f) => f.key === r.formKey);
    if (!form) continue; // an archived or draft form's records are not reported
    by.set(r.formKey, [...(by.get(r.formKey) ?? []), { ...stripSensitive(form, r.data as Record<string, unknown>, ctx.sensitive), id: r.id, review_status: r.reviewStatus, updated_at: r.updatedAt.toISOString() } as Row]);
  }
  by.set("returns", returns.map((r) => ({ ...toEngine(r), id: r.id, status: r.status, lines: r.lines, snapshot_id: r.snapshotId })));
  by.set("snapshots", snapshots.map((s) => ({ id: s.id, return_id: s.returnId, version_no: s.versionNo, lines: s.lines, hash: s.hash, approved_at: s.createdAt.toISOString() })));
  by.set("docs", docs.map((d) => ({ id: d.id, title: d.title, category: d.category, access: d.access, expiry_date: d.expiryDate, notes: d.notes, versions: new Array(d._count.versions).fill(1) })));
  by.set("bplans", plans.map(toEnginePlan));
  return {
    list: (t: string) => by.get(t) ?? [],
    get: (t: string, id: string) => (by.get(t) ?? []).find((x) => x.id === id) ?? null,
    can: (m: string, level: "read" | "write" | "approve" = "read") => canModule(ctx, m, level),
    canSee: (s: string) => ctx.sensitive.includes(s),
    company: () => company,
    name: (x: unknown) => x ?? "", // responsible people are stored by name
    setting: () => 0,
  };
}

export const REPORT_LIST = createReports({ company: () => ({}) }, () => false).REPORTS;
type Params = Record<string, string | undefined>;
const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/** Returns null if the report doesn't exist. Throws "forbidden" without the report's own module permission. */
export async function runReport(ctx: TenantContext, code: string, p: Params): Promise<{ rep: Report; title: string; options: { plans: { id: string; label: string }[]; returns: { id: string; title: string }[]; snapshots: { id: string; label: string }[]; rid?: string } } | null> {
  const def = REPORT_LIST.find((r) => r[0] === code);
  if (!def) return null;
  if (!canModule(ctx, def[2])) throw new Error("forbidden");
  return withTenant(ctx.org.id, async (tx) => {
    const store = await loadReportStore(tx, ctx);
    const { buildReport, arWorkingReport } = createReports(store, () => canRestricted(ctx));
    const rs = (store.list("returns") as (Row & { period_end: string })[]).sort((a, b) => b.period_end.localeCompare(a.period_end));
    const rid = rs.find((r) => r.id === p.rid)?.id ?? rs[0]?.id;
    const snaps = (store.list("snapshots") as (Row & { return_id: string; version_no: number; approved_at: string })[]).filter((s) => s.return_id === rid).sort((a, b) => b.version_no - a.version_no);
    const days = Number(p.days);
    let rep;
    if (code === "annual_return" && rid) {
      const snap = snaps.find((s) => s.id === p.snap) ?? null;
      rep = arWorkingReport(store.get("returns", rid), snap);
    } else {
      rep = buildReport(code, { as_at: date(p.as_at), start: date(p.start) ?? (code === "investment" ? "2025-04-01" : undefined), end: date(p.end), days: Number.isFinite(days) && days >= 1 && days <= 3650 ? days : 180, names: p.names === "1", pay: p.pay === "1", vid: p.vid && store.get("bplans", p.vid) ? p.vid : null });
    }
    return { rep: sezDeep(rep) as Report, title: sezDeep(def[1]), options: { rid, plans: (store.list("bplans") as (Row & { version_no: number; status: string })[]).sort((a, b) => b.version_no - a.version_no).map((v) => ({ id: v.id, label: `v${v.version_no} ${v.status}` })), returns: rs.map((r) => ({ id: r.id, title: String(r.title) })), snapshots: snaps.map((s) => ({ id: s.id, label: `Approved snapshot ${s.version_no} (${s.approved_at.slice(0, 10)})` })) } };
  });
}

export const auditExport = (ctx: TenantContext, code: string, format: string, p: Params) => withTenant(ctx.org.id, (tx) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "export", entityType: "reports", summary: `Exported ${code} as ${format}${p.names === "1" ? ", with names" : ""}${p.pay === "1" ? ", with pay" : ""}` }));
