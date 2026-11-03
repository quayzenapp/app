import { Dock, Topbar } from "@/components/shell";
import { SECTIONS } from "@/lib/sections";
import { can, getTenantContext, isOrgAdmin } from "@/lib/tenant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext();
  const allowed = SECTIONS.filter((s) => !s.module || can(ctx, s.module)).map((s) => s.key);
  return (
    <>
      <div className="mainwrap">
        <Topbar orgId={ctx.org.id} orgs={ctx.orgs} roleName={ctx.roleName} isDemo={ctx.org.isDemo} allowed={allowed} isAdmin={isOrgAdmin(ctx)} userName={ctx.user.name} />
        <main>
          {ctx.org.status === "SUSPENDED" && <div className="banner bad"><b>Suspended.</b> This organization is suspended. Only platform administrators can see it.</div>}
          {ctx.org.isDemo && <div className="banner demo">Demo data. Sample figures only, not for a real submission.</div>}
          {children}
        </main>
      </div>
      <Dock allowed={allowed} />
    </>
  );
}
