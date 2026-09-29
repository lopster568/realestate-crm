import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next 16: proxy.ts replaces middleware.ts. Optimistic auth check only —
// real authorization happens server-side in services (permission matrix).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|uploads).*)"],
};
