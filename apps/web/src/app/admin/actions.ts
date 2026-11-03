"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, db, withTenant } from "@/lib/db";
import { FIELD_TYPES } from "@/lib/forms";
import { createKeycloakUser, findKeycloakUser, setKeycloakEnabled, setKeycloakTempPassword } from "@/lib/keycloak";
import { LEVELS, MODULES, SENSITIVE_LABELS, can } from "@/lib/rbac";
import { requireAdmin, requirePlatformAdmin, type TenantContext } from "@/lib/tenant";
import type { Prisma } from "@/generated/prisma/client";

export type ActionState = { error?: string; ok?: string };
const log = (ctx: TenantContext, organizationId: string, action: string, entityType: string, entityId: string | undefined, summary: string, after?: unknown) =>
  withTenant(organizationId, (tx) => audit(tx, { organizationId, actorId: ctx.user.id, actorEmail: ctx.user.email, action, entityType, entityId, summary, after }));
const tempPassword = () => `Qz-${randomBytes(9).toString("base64url")}1!`;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

/** Org admins act on their own org only. The target org must never come unchecked from the client. */
function targetOrg(ctx: TenantContext, requested: unknown) {
  const id = String(requested || ctx.org.id);
  if (!ctx.user.isPlatformAdmin && id !== ctx.org.id) redirect("/forbidden");
  return id;
}

/* ---------- organizations (platform admin) ---------- */
export async function createOrganization(_s: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requirePlatformAdmin();
  const name = String(f.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Please enter the organization's name." };
  let slug = slugify(name);
  if (await db.organization.findUnique({ where: { slug } })) slug = `${slug}-${randomBytes(2).toString("hex")}`;
  const templates = await db.role.findMany({ where: { organizationId: null } });
  const org = await db.organization.create({
    data: { name, slug, isDemo: f.get("isDemo") === "on", stage: String(f.get("stage") ?? "licensed") === "applicant" ? "applicant" : "licensed",
      roles: { create: templates.map((t) => ({ key: t.key, name: t.name, description: t.description, isSystem: t.isSystem, permissions: t.permissions as Prisma.InputJsonValue, sensitive: t.sensitive })) } },
  });
  await log(ctx, org.id, "create", "organization", org.id, `Created organization ${name}`);
  revalidatePath("/admin/organizations");
  return { ok: `${name} created with the standard roles.` };
}
export async function setOrganizationStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
  const ctx = await requirePlatformAdmin();
  await db.organization.update({ where: { id }, data: { status } });
  await log(ctx, id, "status", "organization", id, `Organization ${status.toLowerCase()}`);
  revalidatePath("/admin/organizations");
}

/* ---------- users ---------- */
const inviteSchema = z.object({ email: z.email().transform((s) => s.toLowerCase().trim()), name: z.string().trim().min(2), roleId: z.string().min(1) });
export async function inviteUser(_s: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const organizationId = targetOrg(ctx, f.get("organizationId"));
  const parsed = inviteSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) return { error: "Please enter a valid email, a name and a role." };
  const { email, name, roleId } = parsed.data;
  const role = await db.role.findFirst({ where: { id: roleId, organizationId } });
  if (!role) return { error: "That role doesn't belong to this organization." };
  let password: string | null = null;
  let user = await db.user.findUnique({ where: { email } });
  try {
    const kc = await findKeycloakUser(email);
    let sub = kc?.id ?? user?.keycloakSub ?? null;
    if (!sub) { password = tempPassword(); sub = await createKeycloakUser(email, name, password); }
    user ??= await db.user.create({ data: { email, name, keycloakSub: sub } });
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not create the sign-in account." }; }
  await db.membership.upsert({ where: { userId_organizationId: { userId: user.id, organizationId } }, update: { roleId }, create: { userId: user.id, organizationId, roleId } });
  await log(ctx, organizationId, "invite", "user", user.id, `Added ${email} as ${role.name}`);
  revalidatePath("/admin/users");
  return { ok: password ? `Account created. Temporary password, shown once: ${password}` : `${email} already has a sign-in account and now has access to this organization.` };
}

async function assertNotLastAdmin(organizationId: string, membershipId: string) {
  const members = await db.membership.findMany({ where: { organizationId }, include: { role: true } });
  const admins = members.filter((m) => can(m.role.permissions as Record<string, string>, "settings", "approve"));
  if (admins.length === 1 && admins[0].id === membershipId) throw new Error("This is the organization's only administrator. Make someone else an administrator first.");
}
export async function changeMemberRole(_s: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const organizationId = targetOrg(ctx, f.get("organizationId"));
  const m = await db.membership.findFirst({ where: { id: String(f.get("membershipId")), organizationId }, include: { user: true } });
  const role = await db.role.findFirst({ where: { id: String(f.get("roleId")), organizationId } });
  if (!m || !role) return { error: "Not found in this organization." };
  if (!can(role.permissions as Record<string, string>, "settings", "approve")) {
    try { await assertNotLastAdmin(organizationId, m.id); } catch (e) { return { error: (e as Error).message }; }
  }
  await db.membership.update({ where: { id: m.id }, data: { roleId: role.id } });
  await log(ctx, organizationId, "role-change", "user", m.userId, `${m.user.email} is now ${role.name}`);
  revalidatePath("/admin/users");
  return { ok: "Role updated." };
}
export async function removeMember(_s: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const organizationId = targetOrg(ctx, f.get("organizationId"));
  const m = await db.membership.findFirst({ where: { id: String(f.get("membershipId")), organizationId }, include: { user: true } });
  if (!m) return { error: "Not found in this organization." };
  try { await assertNotLastAdmin(organizationId, m.id); } catch (e) { return { error: (e as Error).message }; }
  await db.membership.delete({ where: { id: m.id } });
  await log(ctx, organizationId, "remove", "user", m.userId, `Removed ${m.user.email}`);
  revalidatePath("/admin/users");
  return { ok: `${m.user.email} removed from this organization.` };
}
/** Accounts are global, so only platform admins can disable one or reset its password. */
export async function setUserStatus(id: string, status: "ACTIVE" | "DISABLED") {
  const ctx = await requirePlatformAdmin();
  if (id === ctx.user.id) return;
  const u = await db.user.update({ where: { id }, data: { status } });
  if (u.keycloakSub) await setKeycloakEnabled(u.keycloakSub, status === "ACTIVE");
  await log(ctx, ctx.org.id, "status", "user", id, `${u.email} ${status.toLowerCase()}`);
  revalidatePath("/admin/users");
}
export async function resetUserPassword(_s: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requirePlatformAdmin();
  const u = await db.user.findUnique({ where: { id: String(f.get("userId")) } });
  if (!u) return { error: "User not found." };
  const sub = u.keycloakSub ?? (await findKeycloakUser(u.email))?.id;
  if (!sub) return { error: "This user has no sign-in account." };
  const password = tempPassword();
  await setKeycloakTempPassword(sub, password);
  await log(ctx, ctx.org.id, "password-reset", "user", u.id, `Reset password for ${u.email}`);
  return { ok: `Temporary password for ${u.email}, shown once: ${password}` };
}

/* ---------- roles and permissions ---------- */
export async function saveRole(roleId: string, _s: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role?.organizationId) return { error: "Role not found." };
  const organizationId = targetOrg(ctx, role.organizationId);
  const permissions = Object.fromEntries(MODULES.map((m) => { const v = String(f.get(`perm_${m}`) ?? "none"); return [m, (LEVELS as readonly string[]).includes(v) ? v : "none"]; }));
  const sensitive = Object.keys(SENSITIVE_LABELS).filter((k) => f.get(`sens_${k}`) === "on");
  const name = String(f.get("name") ?? role.name).trim() || role.name;
  if (permissions.settings !== "approve") {
    const others = await db.membership.findMany({ where: { organizationId }, include: { role: true } });
    const remaining = others.filter((m) => m.roleId !== roleId && can(m.role.permissions as Record<string, string>, "settings", "approve"));
    if (others.some((m) => m.roleId === roleId) && !remaining.length) return { error: "This would leave the organization with no administrator." };
  }
  await db.role.update({ where: { id: roleId }, data: { name, permissions, sensitive } });
  await log(ctx, organizationId, "update", "role", roleId, `Changed permissions for ${name}`, { permissions, sensitive });
  revalidatePath("/admin/roles");
  return { ok: "Permissions saved. They apply from the user's next page load." };
}
export async function createRole(_s: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const organizationId = ctx.org.id;
  const name = String(f.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Please enter a role name." };
  const key = slugify(name) || randomBytes(3).toString("hex");
  if (await db.role.findFirst({ where: { organizationId, key } })) return { error: "A role with this name already exists." };
  const role = await db.role.create({ data: { organizationId, key, name, permissions: Object.fromEntries(MODULES.map((m) => [m, m === "dashboard" ? "read" : "none"])) } });
  await log(ctx, organizationId, "create", "role", role.id, `Created role ${name}`);
  redirect(`/admin/roles/${role.id}`);
}
export async function deleteRole(roleId: string) {
  const ctx = await requireAdmin();
  const role = await db.role.findFirst({ where: { id: roleId, organizationId: ctx.org.id }, include: { _count: { select: { memberships: true } } } });
  if (!role || role.isSystem || role._count.memberships > 0) return;
  await db.role.delete({ where: { id: roleId } });
  await log(ctx, ctx.org.id, "delete", "role", roleId, `Deleted role ${role.name}`);
  redirect("/admin/roles");
}

/* ---------- forms ---------- */
const fieldSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, "Field names use lowercase letters, digits and underscores."),
  label: z.string().trim().min(1), type: z.enum(FIELD_TYPES as [string, ...string[]]),
  required: z.boolean().optional(), readonly: z.boolean().optional(), choices: z.array(z.string()).optional(), lookup: z.string().optional(), ref: z.string().optional(),
  sensitive: z.enum(Object.keys(SENSITIVE_LABELS) as [string, ...string[]]).optional(), group: z.string().optional(), help: z.string().optional(), dflt: z.union([z.string(), z.number()]).optional(),
});
const formSchema = z.object({ label: z.string().trim().min(1), plural: z.string().trim().min(1), module: z.enum(MODULES), intro: z.string().nullish(), titleField: z.string().min(1), listFields: z.array(z.string()).min(1), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]), fields: z.array(fieldSchema).min(1) });

/** A platform admin edits the global definition. An org admin's save creates or updates that org's own copy. */
export async function saveForm(id: string, payload: unknown): Promise<ActionState> {
  const ctx = await requireAdmin();
  const row = await db.formDefinition.findUnique({ where: { id } });
  if (!row) return { error: "Form not found." };
  if (row.organizationId && !ctx.user.isPlatformAdmin && row.organizationId !== ctx.org.id) redirect("/forbidden");
  const p = formSchema.safeParse(payload);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Please check the form." };
  const names = p.data.fields.map((x) => x.name);
  if (new Set(names).size !== names.length) return { error: "Each field needs a unique name." };
  if (!names.includes(p.data.titleField)) return { error: "The title field must be one of the fields." };
  const data = { ...p.data, intro: p.data.intro ?? null, fields: p.data.fields as Prisma.InputJsonValue, version: row.version + 1 };
  const orgAudit = row.organizationId ?? ctx.org.id;
  if (!row.organizationId && !ctx.user.isPlatformAdmin) {
    const copy = await db.formDefinition.findFirst({ where: { organizationId: ctx.org.id, key: row.key } });
    const saved = copy ? await db.formDefinition.update({ where: { id: copy.id }, data }) : await db.formDefinition.create({ data: { ...data, key: row.key, organizationId: ctx.org.id, importable: row.importable, reviewable: row.reviewable } });
    await log(ctx, ctx.org.id, "update", "form", saved.id, `Customised form ${row.key} for this organization`);
    revalidatePath("/admin/forms");
    return { ok: "Saved as this organization's own version." };
  }
  await db.formDefinition.update({ where: { id }, data });
  await log(ctx, orgAudit, "update", "form", id, `Updated form ${row.key} to v${row.version + 1}`);
  revalidatePath("/admin/forms");
  return { ok: `Saved as version ${row.version + 1}. Existing records keep their data.` };
}
export async function createForm(_s: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const label = String(f.get("label") ?? "").trim();
  const module = String(f.get("module") ?? "");
  if (!label || !(MODULES as readonly string[]).includes(module)) return { error: "Please enter a name and choose a section." };
  const key = slugify(label).replace(/-/g, "_");
  const organizationId = ctx.user.isPlatformAdmin && f.get("scope") === "global" ? null : ctx.org.id;
  if (!/^[a-z]/.test(key) || (await db.formDefinition.findFirst({ where: { key, OR: [{ organizationId }, { organizationId: null }] } }))) return { error: "A form with this name already exists." };
  const row = await db.formDefinition.create({ data: { organizationId, key, label, plural: `${label}s`, module, titleField: "title", listFields: ["title"], status: "DRAFT", fields: [{ name: "title", label: "Title", type: "text", required: true }] } });
  redirect(`/admin/forms/${row.id}`);
}
