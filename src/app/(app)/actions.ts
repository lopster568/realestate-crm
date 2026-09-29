"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { requireUser } from "@/server/session";
import { markAllRead } from "@/server/services/notifications";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function markNotificationsReadAction() {
  const user = await requireUser();
  await markAllRead(user);
  revalidatePath("/", "layout");
}
