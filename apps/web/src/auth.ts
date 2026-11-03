import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { db } from "@/lib/db";

/** Keycloak proves identity. Access comes only from the users and memberships tables. */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { error: "/no-access" },
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email || !profile?.sub || profile.email_verified === false) return "/no-access";
      const user = await db.user.findUnique({ where: { email } });
      if (!user || user.status !== "ACTIVE") return "/no-access";
      // A subject bound to one account can never be re-bound to another by changing an email.
      if (user.keycloakSub && user.keycloakSub !== profile.sub) return "/no-access";
      await db.user.update({ where: { id: user.id }, data: { keycloakSub: profile.sub, lastLoginAt: new Date() } });
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        const user = await db.user.findUnique({ where: { email: profile.email.toLowerCase() } });
        token.uid = user?.id;
        token.idToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid as string;
      return session;
    },
  },
});
