/** Minimal Keycloak Admin REST client. Identity only: roles and organizations stay in our database. */
const issuer = () => process.env.KEYCLOAK_ISSUER!;
const adminBase = () => issuer().replace("/realms/", "/admin/realms/");

async function token() {
  const r = await fetch(`${issuer()}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.KEYCLOAK_ADMIN_CLIENT_ID!, client_secret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET! }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Keycloak token request failed (${r.status})`);
  return (await r.json()).access_token as string;
}
async function call(path: string, init: RequestInit = {}) {
  const r = await fetch(`${adminBase()}${path}`, { ...init, cache: "no-store", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" } });
  if (!r.ok && r.status !== 404) throw new Error(`Keycloak request failed (${r.status})`);
  return r;
}
export async function findKeycloakUser(email: string): Promise<{ id: string } | null> {
  const r = await call(`/users?exact=true&email=${encodeURIComponent(email)}`);
  return ((await r.json()) as { id: string }[])[0] ?? null;
}
export async function createKeycloakUser(email: string, name: string, tempPassword: string) {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const r = await call("/users", { method: "POST", body: JSON.stringify({ username: email, email, firstName, lastName: rest.join(" ") || firstName, enabled: true, emailVerified: true, credentials: [{ type: "password", value: tempPassword, temporary: true }] }) });
  if (r.status !== 201) throw new Error(`Could not create the sign-in account (${r.status})`);
  return (await findKeycloakUser(email))!.id;
}
export async function setKeycloakEnabled(sub: string, enabled: boolean) {
  await call(`/users/${sub}`, { method: "PUT", body: JSON.stringify({ enabled }) });
}
export async function setKeycloakTempPassword(sub: string, value: string) {
  await call(`/users/${sub}/reset-password`, { method: "PUT", body: JSON.stringify({ type: "password", value, temporary: true }) });
}
