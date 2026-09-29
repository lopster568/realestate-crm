import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Prisma) — middleware imports only this.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isLogin = request.nextUrl.pathname.startsWith("/login");
      if (isLogin) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role?: string }).role;
        token.orgId = (user as { orgId?: string }).orgId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as "ADMIN" | "MANAGER" | "AGENT";
        session.user.orgId = token.orgId as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
