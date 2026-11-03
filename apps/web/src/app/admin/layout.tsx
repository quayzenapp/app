import { AdminTabs } from "@/components/admin-tabs";
import { Topbar } from "@/components/shell";
import { SECTIONS } from "@/lib/sections";
import { can, requireAdmin } from "@/lib/tenant";

const LINKS: [string, string, boolean][] = [["/admin", "Overview", false], ["/admin/organizations", "Organizations", true], ["/admin/users", "Users", false], ["/admin/roles", "Roles and permissions", false], ["/admin/forms", "Forms", false], ["/admin/ai/documents", "AI documents", false], ["/admin/ai/models", "AI models", true], ["/admin/audit", "Audit log", false]];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  const allowed = SECTIONS.filter((s) => !s.module || can(ctx, s.module)).map((s) => s.key);
  return (
    <div className="mainwrap">
      <Topbar orgId={ctx.org.id} orgs={ctx.orgs} roleName={ctx.user.isPlatformAdmin ? "Platform administrator" : ctx.roleName} isDemo={ctx.org.isDemo} allowed={allowed} isAdmin userName={ctx.user.name} />
      <main>
        <AdminTabs links={LINKS.filter(([, , platform]) => !platform || ctx.user.isPlatformAdmin).map(([href, label]) => [href, label])} />
        {children}
      </main>
    </div>
  );
}
