import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pic } from "@/components/theme";
import { SECTIONS } from "@/lib/sections";
import { can, getTenantContext } from "@/lib/tenant";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const s = SECTIONS.find((x) => x.key === section);
  if (!s) notFound();
  const ctx = await getTenantContext();
  if (s.module && !can(ctx, s.module)) redirect("/forbidden");
  if (s.href) redirect(s.href);
  if (s.forms?.length) redirect(`/r/${s.forms[0]}`);
  // Honest placeholder: this module hasn't been ported yet.
  return (
    <div className="card">
      <div className="row"><Pic name={s.key} /><h3 style={{ margin: 0 }}>{s.label}</h3></div>
      <p className="muted">This module is planned and not built yet. See the roadmap in docs/STATUS.md.</p>
      <div className="row"><Link className="btn" href="/dashboard">Back to the dashboard</Link></div>
    </div>
  );
}
