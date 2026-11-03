import { signIn } from "@/auth";
// Sign-in happens on the themed Keycloak page: email and password only.
export async function GET() {
  await signIn("keycloak", { redirectTo: "/dashboard" });
}
