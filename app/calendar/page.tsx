import Navigation from "../components/Navigation";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LogoutButton from "../dashboard/LogoutButton";
import CalendarBoard from "./CalendarBoard";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("session_user");

  if (!sessionUser?.value) {
    redirect("/login");
  }

  const userId = Number(sessionUser.value);

  if (!Number.isInteger(userId)) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });

  if (!user) {
    redirect("/login");
  }

  const staff = await prisma.staff.findMany({
    where: { status: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const files = await prisma.clientFile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileNumber: true,
      title: true,
      client: {
        select: { id: true, name: true },
      },
    },
    take: 500,
  });

  const params = await searchParams;
  const now = new Date();
  const yearRaw = firstParam(params.year);
  const monthRaw = firstParam(params.month);

  const year =
    /^\d{4}$/.test(yearRaw) && Number(yearRaw) >= 2000 && Number(yearRaw) <= 2100
      ? Number(yearRaw)
      : Number(
          new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Colombo",
            year: "numeric",
          }).format(now)
        );

  const currentMonth =
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Colombo",
        month: "2-digit",
      }).format(now)
    ) || 1;

  const month =
    /^\d{1,2}$/.test(monthRaw) && Number(monthRaw) >= 1 && Number(monthRaw) <= 12
      ? Number(monthRaw)
      : currentMonth;

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
              <p className="text-[10px] text-black/40">Client Workflow System</p>
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

      <Navigation currentPage="calendar" />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
              Schedule
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Calendar</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
              Manage appointments, client events and staff schedules from one calendar.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <CalendarBoard
            initialYear={year}
            initialMonth={month}
            staff={staff}
            files={files}
          />
        </div>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
