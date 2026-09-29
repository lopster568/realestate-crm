import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { resolveSessionUser } from "@/server/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Only bounce to the app if the session's user is still active — a deactivated
  // user with a live JWT must land here (not loop) and re-authenticate.
  const user = await resolveSessionUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-white shadow-card mb-4">
            <Building2 size={22} />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">EstateCRM</h1>
          <p className="text-sm text-ink-faint mt-1">Sign in to your workspace</p>
        </div>
        <div className="bg-surface rounded-card shadow-card border border-line/60 p-6">
          <LoginForm />
        </div>
        <p className="text-center text-xs text-ink-faint mt-6">
          Demo: admin@horizonrealty.test / admin123
        </p>
      </div>
    </main>
  );
}
