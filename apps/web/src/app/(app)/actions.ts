"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getToken } from "next-auth/jwt";
import { signOut } from "@/auth";
import { audit, withTenant } from "@/lib/db";
import { buildRecord, getForm, getLookups, stripSensitive } from "@/lib/forms";
import { ORG_COOKIE, can, getTenantContext } from "@/lib/tenant";
import type { Prisma } from "@/generated/prisma/client";

export async function switchOrgAction(formData: FormData) {
  const ctx = await getTenantContext();
  const orgId = String(formData.get("orgId"));
  // Membership check: a tampered id simply isn't in ctx.orgs.
  if (ctx.orgs.some((o) => o.id === orgId)) {
    (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  const h = await headers();
  const secure = (process.env.AUTH_URL ?? "").startsWith("https");
  const token = await getToken({ req: { headers: h }, secret: process.env.AUTH_SECRET!, secureCookie: secure, salt: secure ? "__Secure-authjs.session-token" : "authjs.session-token" });
  (await cookies()).delete(ORG_COOKIE);
  await signOut({ redirect: false });
  const u = new URL(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`);
  u.searchParams.set("post_logout_redirect_uri", `${process.env.AUTH_URL}/login`);
  u.searchParams.set("client_id", process.env.KEYCLOAK_CLIENT_ID!);
  if (token?.idToken) u.searchParams.set("id_token_hint", String(token.idToken));
  redirect(u.toString());
}

export type SaveState = { errors?: string[]; notes?: string[] };

export async function saveRecordAction(formKey: string, id: string | null, _s: SaveState, formData: FormData): Promise<SaveState> {
  const ctx = await getTenantContext();
  const orgId = ctx.org.id;
  const form = await getForm(orgId, formKey);
  if (!form) return { errors: ["This form is not available."] };
  if (!can(ctx, form.module, "write")) return { errors: ["Your role can view this section but not change it."] };
  const lookups = await getLookups(orgId);
  const raw = Object.fromEntries(formData.entries());
  let notes: string[] = [];
  try {
    const savedId = await withTenant(orgId, async (tx) => {
      const existing = id ? await tx.record.findFirst({ where: { id, organizationId: orgId, formKey } }) : null;
      if (id && !existing) throw ["This record no longer exists."];
      const before = (existing?.data as Record<string, unknown>) ?? null;
      const built = buildRecord(form, raw, before, ctx.sensitive, lookups);
      notes = built.notes;
      const data = built.rec as Prisma.InputJsonValue;
      // Editing a reviewed record sends it back for review, so a confirmed figure can't change unseen.
      const reviewStatus = form.reviewable ? "Pending" : null;
      const rec = existing
        ? await tx.record.update({ where: { id: existing.id }, data: { data, reviewStatus, reviewedById: null, reviewedAt: null, updatedById: ctx.user.id } })
        : await tx.record.create({ data: { organizationId: orgId, formKey, data, reviewStatus, createdById: ctx.user.id, updatedById: ctx.user.id } });
      await audit(tx, { organizationId: orgId, actorId: ctx.user.id, actorEmail: ctx.user.email, action: existing ? "update" : "create", entityType: formKey, entityId: rec.id, summary: `${existing ? "Updated" : "Added"} ${form.label}`,
        before: before ? stripSensitive(form, before, []) : undefined, after: stripSensitive(form, built.rec, []) });
      return rec.id;
    });
    revalidatePath(`/r/${formKey}`);
    // Notes go to the saved record's page, so pressing Save again can't create a duplicate.
    if (notes.length) redirect(`/r/${formKey}/${savedId}?note=${encodeURIComponent(notes.join(" "))}`);
    redirect(`/r/${formKey}`);
  } catch (e) {
    if (Array.isArray(e)) return { errors: e.map(String) };
    throw e;
  }
}

export async function archiveRecordAction(formKey: string, id: string) {
  const ctx = await getTenantContext();
  const form = await getForm(ctx.org.id, formKey);
  if (!form || !can(ctx, form.module, "write")) redirect("/forbidden");
  await withTenant(ctx.org.id, async (tx) => {
    const r = await tx.record.updateMany({ where: { id, organizationId: ctx.org.id, formKey }, data: { archivedAt: new Date(), updatedById: ctx.user.id } });
    if (r.count) await audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "archive", entityType: formKey, entityId: id, summary: `Archived ${form.label}` });
  });
  redirect(`/r/${formKey}`);
}

export async function reviewRecordAction(formKey: string, id: string, decision: "Confirmed" | "Pending") {
  const ctx = await getTenantContext();
  const form = await getForm(ctx.org.id, formKey);
  if (!form?.reviewable || !can(ctx, form.module, "approve")) redirect("/forbidden");
  await withTenant(ctx.org.id, async (tx) => {
    const r = await tx.record.updateMany({ where: { id, organizationId: ctx.org.id, formKey }, data: { reviewStatus: decision, reviewedById: ctx.user.id, reviewedAt: new Date() } });
    if (r.count) await audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "review", entityType: formKey, entityId: id, summary: `Review: ${decision}` });
  });
  revalidatePath(`/r/${formKey}/${id}`);
}
