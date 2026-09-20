import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import Navigation from "../components/Navigation";
import LogoutButton from "../dashboard/LogoutButton";
import { prisma } from "@/lib/prisma";
import SettingsActions from "./SettingsActions";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("session_user");

  if (!sessionUser?.value) {
    redirect("/login");
  }

  const userId = Number(sessionUser.value);

  if (!Number.isInteger(userId) || userId <= 0) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      username: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-[#171717]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black">
              <span className="text-xs font-bold text-[#f9a800]">A&I</span>
            </div>

            <div>
              <p className="text-sm font-semibold">A&I Global</p>
              <p className="text-[10px] text-black/40">
                Client Workflow System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-black/40">Logged in as</p>
              <p className="text-sm font-medium">{user.username}</p>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      <Navigation currentPage="settings" />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="mt-2 text-sm text-black/50">
            Database backup and login security settings.
          </p>
        </div>

        <SettingsActions username={user.username} />
      </section>
    </main>
  );
}
