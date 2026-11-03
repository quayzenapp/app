"use server";
import { revalidatePath } from "next/cache";
import { aiFetch } from "@/lib/ai";
import { audit, withTenant } from "@/lib/db";
import { requireAdmin, requirePlatformAdmin, type TenantContext } from "@/lib/tenant";
import type { ActionState } from "@/app/admin/actions";

const log = (ctx: TenantContext, action: string, summary: string) => withTenant(ctx.org.id, (tx) => audit(tx, { organizationId: ctx.org.id, actorId: ctx.user.id, actorEmail: ctx.user.email, action, entityType: "ai", summary }));
async function detail(r: Response) { return (await r.json().catch(() => null))?.detail ?? `The AI service returned ${r.status}.`; }
async function call(ctx: TenantContext, path: string, init: RequestInit = {}): Promise<ActionState> {
  try {
    const r = await aiFetch(ctx, path, init);
    return r.ok ? { ok: "Done." } : { error: String(await detail(r)) };
  } catch { return { error: "The AI service isn't reachable." }; }
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function uploadDocument(_s: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const file = f.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Please choose a file." };
  if (!String(f.get("title") ?? "").trim()) return { error: "Please enter a title." };
  const body = new FormData();
  for (const k of ["file", "title", "short", "kind", "doc_date", "source", "notes"]) { const v = f.get(k); if (v) body.set(k, v); }
  // The service rejects shared uploads from anyone but a platform admin, using the signed token.
  body.set("shared", String(f.get("shared") === "on" && ctx.user.isPlatformAdmin));
  const res = await call(ctx, "/v1/documents", { method: "POST", body });
  if (res.error) return res;
  await log(ctx, "upload", `Uploaded AI document ${f.get("title")}`);
  revalidatePath("/admin/ai/documents");
  return { ok: "Uploaded. It's being processed and will be searchable when its status is Ready." };
}
export async function documentAction(id: string, op: "delete" | "reindex" | "supersede" | "restore") {
  const ctx = await requireAdmin();
  const path = `/v1/documents/${encodeURIComponent(id)}`;
  if (op === "delete") await call(ctx, path, { method: "DELETE" });
  if (op === "reindex") await call(ctx, `${path}/reindex`, { method: "POST" });
  if (op === "supersede" || op === "restore") await call(ctx, path, json("PATCH", { superseded: op === "supersede" }));
  await log(ctx, op, `AI document ${op}: ${id}`);
  revalidatePath("/admin/ai/documents");
}
export async function addModel(_s: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requirePlatformAdmin();
  const dims = Number(f.get("dimensions")), order = Number(f.get("fallback_order"));
  const res = await call(ctx, "/v1/models", json("POST", { provider: f.get("provider"), model_id: String(f.get("model_id") ?? "").trim(), label: String(f.get("label") || f.get("model_id")).trim(), purpose: f.get("purpose"), dimensions: dims || null, fallback_order: order || null }));
  if (!res.error) await log(ctx, "add-model", `Added AI model ${f.get("model_id")}`);
  revalidatePath("/admin/ai/models");
  return res.error ? res : { ok: "Model added. Use Test to check it works." };
}
export async function modelAction(id: string, op: "default" | "enable" | "disable" | "delete") {
  const ctx = await requirePlatformAdmin();
  const path = `/v1/models/${encodeURIComponent(id)}`;
  if (op === "delete") await call(ctx, path, { method: "DELETE" });
  else await call(ctx, path, json("PATCH", op === "default" ? { is_default: true } : { enabled: op === "enable" }));
  await log(ctx, `model-${op}`, `AI model ${op}: ${id}`);
  revalidatePath("/admin/ai/models");
}
export async function testModel(id: string, _s: ActionState): Promise<ActionState> {
  const ctx = await requirePlatformAdmin();
  try {
    const r = await aiFetch(ctx, `/v1/models/${encodeURIComponent(id)}/test`, { method: "POST" });
    const d = await r.json();
    return d.ok ? { ok: `Works: ${d.detail}` } : { error: String(d.detail ?? "The test failed.") };
  } catch { return { error: "The AI service isn't reachable." }; }
}
export async function saveProvider(provider: string, _s: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requirePlatformAdmin();
  const secret = Object.fromEntries(["api_key", "access_key_id", "secret_access_key"].map((k) => [k, String(f.get(k) ?? "").trim()]).filter(([, v]) => v));
  const region = String(f.get("region") ?? "").trim();
  const res = await call(ctx, `/v1/providers/${provider}`, json("PUT", { secret: Object.keys(secret).length ? secret : null, config: region ? { region } : null }));
  if (!res.error) await log(ctx, "provider-settings", `Changed ${provider} settings`); // never logs the values
  revalidatePath("/admin/ai/models");
  return res.error ? res : { ok: "Saved. Secrets are encrypted and can't be displayed again." };
}
export async function reindexAll(_s: ActionState): Promise<ActionState> {
  const ctx = await requirePlatformAdmin();
  const res = await call(ctx, "/v1/models/reindex-all", { method: "POST" });
  if (!res.error) await log(ctx, "reindex-all", "Queued all documents for embedding");
  return res.error ? res : { ok: "All documents are queued. Search keeps working on keywords until this finishes." };
}
