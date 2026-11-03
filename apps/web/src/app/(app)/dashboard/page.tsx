import Link from "next/link";
import { HeroArt, Pic } from "@/components/theme";
import { withTenant } from "@/lib/db";
import { canRestricted, visibleWhere } from "@/lib/documents";
import { loadLic, toEngineApp } from "@/lib/lic/store";
import { addDays } from "@/lib/budget-engine";
import { budgetRow, loadBudgetEngine } from "@/lib/budget-store";
import { fmtK, fmtNum, pct } from "@/lib/charts";
import { createReports } from "@/lib/reports/engine";
import { loadReportStore } from "@/lib/reports/store";
import { daysUntil, fmtDate, todayISO } from "@/lib/forms";
import { can, requirePermission } from "@/lib/tenant";

type D = Record<string, string | number | null | undefined>;
function Meter({ label, actual, plan, fmt }: { label: string; actual: number | null; plan: number | null; fmt: (v: number | null) => string }) {
  if (plan == null) return <div className="mt"><div className="mtl"><b>{label}</b><span>{fmt(actual)} actual · no plan figure</span></div></div>;
  const max = Math.max(actual ?? 0, plan, 1), p = pct(actual ?? 0, plan);
  return <div className="mt"><div className="mtl"><b>{label}</b><span>{fmt(actual)} of {fmt(plan)} planned · <b className={p >= 100 ? "okt" : p >= 75 ? "" : "wt"}>{p}%</b></span></div><div className="mtt"><i style={{ width: `${pct(actual ?? 0, max)}%` }} /><s style={{ left: `${pct(plan, max)}%` }} title={`Plan: ${fmt(plan)}`} /></div></div>;
}
type Rem = { kind: string; icon: string; title: string; due: string; detail?: string; href: string; days: number };

function Stat({ value, label, section, warn }: { value: string | number; label: string; section: string; warn?: boolean }) {
  return <Link href={`/s/${section}`} className={`stat ${warn ? "warn" : ""}`}><i className="sic"><Pic name={section} /></i><b>{value}</b><span>{label}</span></Link>;
}

function LicRing({ lic }: { lic: D }) {
  const left = daysUntil(String(lic.expiry_date));
  const total = lic.issue_date ? Math.max(1, Math.round((new Date(String(lic.expiry_date)).getTime() - new Date(String(lic.issue_date)).getTime()) / 864e5)) : 365;
  const used = Math.min(100, Math.max(0, Math.round(((total - left) / total) * 100)));
  const tone = left < 0 ? "bad" : left <= 60 ? "warn" : "ok";
  return <div className={`lring ${tone}`} style={{ "--p": used } as React.CSSProperties} role="img" aria-label={`${Math.abs(left)} days ${left < 0 ? "past expiry" : "until the licence expires"}`}><div><b>{Math.abs(left)}</b><span>{left < 0 ? "days over" : "days left"}</span></div></div>;
}

export default async function Dashboard() {
  const ctx = await requirePermission("dashboard");
  const today = todayISO();
  const canM = (m: string) => can(ctx, m);
  const { rows, latest, docs, plan, budget, app } = await withTenant(ctx.org.id, async (tx) => ({
    rows: await tx.record.findMany({ where: { organizationId: ctx.org.id, archivedAt: null } }),
    latest: canM("returns") ? await tx.annualReturn.findFirst({ where: { organizationId: ctx.org.id }, orderBy: { periodEnd: "desc" } }) : null,
    docs: canM("documents") ? await tx.document.findMany({ where: { ...visibleWhere(ctx), expiryDate: { not: null } } }) : [],
    app: canM("licensing") ? await (async () => { const r = await tx.application.findFirst({ where: { organizationId: ctx.org.id, status: { notIn: ["Licence issued", "Withdrawn", "Rejected"] } }, orderBy: { createdAt: "desc" } }); if (!r) return null; const R = (await loadLic(tx, ctx)).appReadiness(toEngineApp(r)); return { r, R }; })() : null,
    plan: canM("bplan") ? await (async () => { const eng = createReports(await loadReportStore(tx, ctx), () => canRestricted(ctx)), v = eng.referencePlan(); return v ? { v, years: eng.comparePlan(v) } : null; })() : null,
    budget: canM("budget") ? await (async () => {
      const eng = await loadBudgetEngine(tx, ctx.org.id);
      const b = (await tx.budget.findMany({ where: { organizationId: ctx.org.id } })).find((x) => x.fyStart <= today && eng.addMonths(x.fyStart, 12) > today);
      return b ? { b, F: eng.budgetFigures(budgetRow(b), today), end: addDays(eng.addMonths(b.fyStart, 12), -1) } : null;
    })() : null,
  }));
  const list = (k: string) => rows.filter((r) => r.formKey === k);
  const data = (k: string) => list(k).map((r) => r.data as D);

  const emps = canM("workforce") ? data("employees").filter((e) => e.worker_type === "Employee" && e.status !== "Left" && String(e.start_date) <= today && (!e.end_date || String(e.end_date) >= today)) : [];
  const local = emps.filter((e) => e.nationality_group === "Sri Lankan").length;
  const visas = canM("visas") ? data("visas") : [];
  const rem: Rem[] = [];
  const add = (r: Omit<Rem, "days">) => { const days = daysUntil(r.due); if (days <= 90) rem.push({ ...r, days }); };
  if (canM("obligations")) for (const r of list("obligations")) { const o = r.data as D; if (o.deadline && !["Met", "Not applicable"].includes(String(o.status))) add({ kind: "Obligation", icon: "obligations", title: String(o.title), due: String(o.deadline), detail: `Status: ${o.status}`, href: `/r/obligations/${r.id}` }); }
  if (canM("requests")) for (const r of list("requests")) { const o = r.data as D; if (o.deadline && !["Submitted", "Closed"].includes(String(o.status))) add({ kind: "Commission request", icon: "requests", title: String(o.title), due: String(o.deadline), detail: `Status: ${o.status}`, href: `/r/requests/${r.id}` }); }
  if (canM("visas")) for (const r of list("visas")) { const o = r.data as D; if (o.expiry_date) add({ kind: "Visa expiry", icon: "visas", title: String(ctx.sensitive.includes("personal") ? o.person_name : o.nationality), due: String(o.expiry_date), href: `/r/visas/${r.id}` }); }
  for (const d of docs) if (daysUntil(d.expiryDate!) <= 60) add({ kind: "Document expiry", icon: "documents", title: d.title, due: d.expiryDate!, detail: d.category, href: `/documents/${d.id}` });
  rem.sort((a, b) => a.days - b.days);
  const over = rem.filter((r) => r.days < 0).length;
  const lic = canM("obligations") ? data("licences").find((l) => l.expiry_date && l.status === "Active") : undefined;

  return (
    <>
      <div className="hero"><div className="t"><div className="hello">Welcome back</div><h1>{ctx.org.name}</h1><div className="dt">{fmtDate(today)}</div></div><HeroArt /></div>
      {app && <div className="card hl"><h3>Licence application <span className="badge info">{app.r.status}</span></h3><div className="row"><span className="small">{app.R.steps.filter((s: { missing: unknown[] }) => !s.missing.length).length} of {app.R.steps.length} steps complete · {app.R.docs.ok} of {app.R.docs.total} documents ready</span><Link className="btn sm p" href={`/apply/${app.r.id}`}>Open the application</Link></div></div>}
      <div className="stats">
        {canM("requests") && <Stat value={data("requests").filter((r) => !["Submitted", "Closed"].includes(String(r.status))).length} label="Open Commission requests" section="requests" />}
        {canM("obligations") && <Stat value={data("obligations").filter((o) => !["Met", "Not applicable"].includes(String(o.status))).length} label="Obligations not yet met" section="obligations" />}
        {canM("workforce") && <Stat value={emps.length} label={`Employees today (${local} Sri Lankan, ${emps.length - local} other)`} section="workforce" />}
        {canM("investment") && <Stat value={list("investments").filter((r) => r.reviewStatus !== "Confirmed").length} label="Funding records awaiting review" section="investment" warn />}
        {canM("visas") && <Stat value={visas.filter((v) => v.expiry_date && daysUntil(String(v.expiry_date)) <= 90 && daysUntil(String(v.expiry_date)) >= -30).length} label="Visas expiring within 90 days" section="visas" />}
        {canM("returns") && <Stat value={latest?.status ?? "None"} label={latest ? `Latest annual return: ${latest.title}` : "No annual return started"} section="returns" />}
      </div>
      <div className="cols">
        <div className="card">
          <h3>Coming up and overdue {over > 0 && <span className="badge bad">{over} overdue</span>}</h3>
          {rem.length ? (
            <ul className="rem">
              {rem.slice(0, 15).map((r) => (
                <li key={r.href} className={r.days < 0 ? "od" : r.days <= 7 ? "soon" : ""}>
                  <Pic name={r.icon} className="rem-ic" />
                  <span className={`badge ${r.days < 0 ? "bad" : r.days <= 7 ? "warn" : "info"}`}>{r.days < 0 ? `${-r.days} days overdue` : r.days === 0 ? "today" : `in ${r.days} days`}</span>
                  <div><b>{r.kind}</b>: <Link href={r.href}>{r.title}</Link><div className="muted small">{fmtDate(r.due)}{r.detail ? ` · ${r.detail}` : ""}</div></div>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Nothing due in the next 90 days.</p>}
        </div>
        <div>
          {lic && <div className="card lic-card"><LicRing lic={lic} /><div><h3>Licence</h3><p><b>{lic.title}</b> {lic.number} <span className="badge ok">{lic.status}</span></p><p className="small muted">Issued {fmtDate(lic.issue_date) || "—"} · expires {fmtDate(lic.expiry_date)}</p></div></div>}
          {budget && <div className="card"><h3>{budget.b.title}</h3><Meter label="Spending to date vs budget to date" actual={budget.F.ytdA} plan={budget.F.ytdB || null} fmt={(v) => `${budget.b.currency} ${fmtK(v)}`} /><p className="small muted">{budget.F.annual ? Math.round((budget.F.ytdA / budget.F.annual) * 100) : 0}% of the annual budget of {budget.b.currency} {fmtK(budget.F.annual)} used. <Link href="/budget">Open the budget</Link></p></div>}
          {plan && (() => { const y = plan.years[plan.years.length - 1]; return <div className="card"><h3>Business plan vs actual</h3><p className="muted small">{plan.v.title} v{plan.v.version_no} ({plan.v.status}). Plan figures are projections, not commitments.</p>{y ? <><p className="small">Year {y.year} ({fmtDate(y.start)} to {fmtDate(y.end)})</p>{y.metrics.filter((m: { key: string }) => ["investment_cum", "employees", "office", "revenue"].includes(m.key)).map((m: { key: string; label: string; plan: number | null; actual: number | null }) => <Meter key={m.key} label={m.label} actual={m.actual} plan={m.plan} fmt={fmtNum} />)}</> : <p className="muted">Year 1 has not started yet.</p>}</div>; })()}
        </div>
      </div>
    </>
  );
}
