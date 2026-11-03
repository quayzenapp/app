"use server";
import { revalidatePath } from "next/cache";
import { audit, db, withTenant } from "@/lib/db";
import { buildRecord, getForm, getLookups, stripSensitive } from "@/lib/forms";
import { can, getTenantContext } from "@/lib/tenant";
import type { SaveState } from "@/app/(app)/actions";
import type { Prisma } from "@/generated/prisma/client";

export async function saveCompanyProfile(_s: SaveState, f: FormData): Promise<SaveState> {
  const ctx = await getTenantContext();
  if (!can(ctx, "company", "write")) return { errors: ["Your role can view this section but not change it."] };
  const form = await getForm(ctx.org.id, "company_profile");
  if (!form) return { errors: ["The company profile form is missing."] };
  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.org.id } });
  const before = { ...(org.profile as object), name: org.name } as Record<string, unknown>;
  try {
    const { rec } = buildRecord(form, Object.fromEntries(f.entries()), before, ctx.sensitive, await getLookups(ctx.org.id));
    const { name, ...profile } = rec;
    await db.organization.update({ where: { id: org.id }, data: { name: String(name), profile: profile as Prisma.InputJsonValue } });
    await withTenant(ctx.org.id, (tx) => audit(tx, { organizationId: org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action: "update", entityType: "company", entityId: org.id, summary: "Updated the company profile", after: stripSensitive(form, rec, []) }));
    revalidatePath("/company");
    return { notes: ["Saved."] };
  } catch (e) {
    if (Array.isArray(e)) return { errors: e.map(String) };
    throw e;
  }
}
