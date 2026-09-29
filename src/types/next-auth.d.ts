import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "MANAGER" | "AGENT";
      orgId: string;
    } & DefaultSession["user"];
  }
  interface User {
    role?: string;
    orgId?: string;
  }
}
