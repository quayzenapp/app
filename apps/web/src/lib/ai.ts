import { SignJWT } from "jose";
import { isOrgAdmin, type TenantContext } from "@/lib/tenant";

const secret = () => new TextEncoder().encode(process.env.AI_JWT_SECRET!);

/** Short-lived identity for the AI service. The organization always comes from the validated context. */
export function aiToken(ctx: TenantContext) {
  return new SignJWT({ org: ctx.org.id, ai_admin: isOrgAdmin(ctx), platform: ctx.user.isPlatformAdmin })
    .setProtectedHeader({ alg: "HS256" }).setSubject(ctx.user.id).setAudience("quayzen-ai").setIssuedAt().setExpirationTime("60s").sign(secret());
}

export async function aiFetch(ctx: TenantContext, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await aiToken(ctx)}`);
  return fetch(`${process.env.AI_SERVICE_URL}${path}`, { ...init, headers, cache: "no-store" });
}
