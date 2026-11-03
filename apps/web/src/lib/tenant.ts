import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MODULES, type Level, can as canLevel } from "@/lib/rbac";

export const ORG_COOKIE = "qz_org";

const FULL = Object.fromEntries(MODULES.map((m) => [m, "approve"])) as Record<string, Level>;
const ALL_SENSITIVE = ["personal", "id", "pay", "ubo", "bank"];

export type OrgLite = { id: string; name: string; isDemo: boolean; status: string };
export type TenantContext = {
  user: { id: string; email: string; name: string; isPlatformAdmin: boolean };
  org: OrgLite;
  orgs: OrgLite[];
  roleName: string;
  roleKey: string;
  permissions: Record<string, Level>;
  sensitive: string[];
};

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  return user && user.status === "ACTIVE" ? user : null;
});

/** Single source of the active organization, role and permissions. Revalidated on every request. */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { organization: true, role: true },
    orderBy: { organization: { name: "asc" } },
  });
  const pick = (o: OrgLite): OrgLite => ({ id: o.id, name: o.name, isDemo: o.isDemo, status: o.status });
  const orgs: OrgLite[] = user.isPlatformAdmin
    ? (await db.organization.findMany({ orderBy: { name: "asc" } })).map(pick)
    : memberships.filter((m) => m.organization.status === "ACTIVE").map((m) => pick(m.organization));
  if (!orgs.length) redirect(user.isPlatformAdmin ? "/admin/organizations" : "/no-organization");

  const wanted = (await cookies()).get(ORG_COOKIE)?.value;
  const org = orgs.find((o) => o.id === wanted) ?? orgs[0];
  const m = memberships.find((x) => x.organizationId === org.id);
  const base = { user: { id: user.id, email: user.email, name: user.name, isPlatformAdmin: user.isPlatformAdmin }, org, orgs };
  if (user.isPlatformAdmin) {
    return { ...base, roleName: m?.role.name ?? "Platform administrator", roleKey: m?.role.key ?? "platform", permissions: FULL, sensitive: ALL_SENSITIVE };
  }
  return {
    ...base,
    roleName: m!.role.name,
    roleKey: m!.role.key,
    permissions: m!.role.permissions as Record<string, Level>,
    sensitive: m!.role.sensitive,
  };
});

export const can = (ctx: Pick<TenantContext, "permissions">, module: string, level: Level = "read") =>
  canLevel(ctx.permissions, module, level);

/** Throws through to the forbidden page if the current role lacks the level. */
export async function requirePermission(module: string, level: Level = "read") {
  const ctx = await getTenantContext();
  if (!can(ctx, module, level)) redirect("/forbidden");
  return ctx;
}

/** Organization admins hold settings:approve for their own org; platform admins hold it everywhere. */
export const isOrgAdmin = (ctx: TenantContext) => ctx.user.isPlatformAdmin || can(ctx, "settings", "approve");
export async function requireAdmin() {
  const ctx = await getTenantContext();
  if (!isOrgAdmin(ctx)) redirect("/forbidden");
  return ctx;
}
export async function requirePlatformAdmin() {
  const ctx = await getTenantContext();
  if (!ctx.user.isPlatformAdmin) redirect("/forbidden");
  return ctx;
}
