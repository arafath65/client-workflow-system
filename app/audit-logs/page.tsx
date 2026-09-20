import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navigation from "../components/Navigation";
import LogoutButton from "../dashboard/LogoutButton";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { ReactNode } from "react";

type SearchParams = Record<string, string | string[] | undefined>;

const MODULES = [
  "AUTH",
  "CLIENTS",
  "FILES",
  "WORKFLOWS",
  "SUBTASKS",
  "STAFF",
  "THIRD_PARTIES",
  "CALENDAR",
  "PAYMENTS",
  "FINANCE",
  "SETTINGS",
] as const;

const ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "PASSWORD_CHANGE",
  "CREATE",
  "UPDATE",
  "CANCEL",
  "ASSIGN",
  "COMPLETE",
  "ACTIVATE",
  "DEACTIVATE",
  "DELETE",
  "REVERSE",
  "REFUND",
  "EXPENSE_CREATE",
  "EXPENSE_UPDATE",
  "EXPENSE_DELETE",
  "DATABASE_BACKUP",
] as const;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sessionUser = (await cookies()).get("session_user");

  if (!sessionUser?.value) {
    redirect("/login");
  }

  const userId = Number(sessionUser.value);

  if (!Number.isInteger(userId) || userId <= 0) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;

  const getParam = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] ?? "" : value ?? "";

  const today = getColomboDate(new Date());
  const thirtyDaysAgo = addDays(today, -29);

  const fromParam = getParam(params.from);
  const toParam = getParam(params.to);

  const from = isDateString(fromParam) ? fromParam : thirtyDaysAgo;
  const to = isDateString(toParam) ? toParam : today;

  const moduleFilter = getParam(params.module);
  const action = getParam(params.action);
  const search = getParam(params.search).trim();

  const normalizedFrom = from <= to ? from : to;
  const normalizedTo = from <= to ? to : from;

  const rangeStart = new Date(
    `${normalizedFrom}T00:00:00+05:30`
  );

  const rangeEnd = new Date(
    `${normalizedTo}T00:00:00+05:30`
  );

  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  const where: Prisma.AuditLogWhereInput = {
    createdAt: {
      gte: rangeStart,
      lt: rangeEnd,
    },

    ...(moduleFilter
      ? {
          module: moduleFilter,
        }
      : {}),

    ...(action
      ? {
          action,
        }
      : {}),

    ...(search
      ? {
          OR: [
            {
              description: {
                contains: search,
              },
            },
            {
              entity: {
                contains: search,
              },
            },
            {
              user: {
                username: {
                  contains: search,
                },
              },
            },
          ],
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 250,
      select: {
        id: true,
        createdAt: true,
        module: true,
        action: true,
        entity: true,
        entityId: true,
        description: true,
        metadata: true,
        user: {
          select: {
            username: true,
          },
        },
      },
    }),

    prisma.auditLog.count({
      where,
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-[#171717]">
      {/* Header */}
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black">
              <span className="text-xs font-bold text-[#f9a800]">
                A&I
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold">
                A&I Global
              </p>
              <p className="text-[10px] text-black/40">
                Client Workflow System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-black/40">
                Logged in as
              </p>
              <p className="text-sm font-medium">
                {user.username}
              </p>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <Navigation currentPage="audit-logs" />

      {/* Main Content */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
            Audit Logs
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Audit Logs
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/50">
            Review meaningful system actions with user, module,
            action, time and details.
          </p>
        </div>

        {/* Filters */}
        <form
          method="get"
          className="mt-8 rounded-xl border border-black/10 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <FilterField label="From">
              <input
                name="from"
                type="date"
                defaultValue={normalizedFrom}
                className={inputClass}
              />
            </FilterField>

            <FilterField label="To">
              <input
                name="to"
                type="date"
                defaultValue={normalizedTo}
                className={inputClass}
              />
            </FilterField>

            <FilterField label="Module">
              <select
                name="module"
                defaultValue={moduleFilter}
                className={inputClass}
              >
                <option value="">All Modules</option>

                {MODULES.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Action">
              <select
                name="action"
                defaultValue={action}
                className={inputClass}
              >
                <option value="">All Actions</option>

                {ACTIONS.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Search">
              <input
                name="search"
                defaultValue={search}
                placeholder="User, details or entity..."
                className={inputClass}
              />
            </FilterField>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[10px] text-black/35">
              Showing {logs.length} of {total} matching log
              {total === 1 ? "" : "s"}
            </p>

            <button
              type="submit"
              className="h-10 rounded-lg bg-black px-5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black"
            >
              Apply Filters
            </button>
          </div>
        </form>

        {/* Activity History */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Activity History
              </h2>

              <p className="mt-1 text-xs text-black/40">
                Newest actions appear first.
              </p>
            </div>

            {logs.length >= 250 ? (
              <span className="text-[10px] text-black/35">
                Latest 250 shown
              </span>
            ) : null}
          </div>

          {logs.length === 0 ? (
            <div className="mt-5 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9]">
              <p className="text-sm text-black/40">
                No audit activity found for the selected filters.
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-lg border border-black/10">
              <table className="w-full min-w-[1050px]">
                <thead>
                  <tr className="border-b border-black/10 bg-[#fafaf9]">
                    {[
                      "Date / Time",
                      "User",
                      "Module",
                      "Action",
                      "Details",
                    ].map((head) => (
                      <th
                        key={head}
                        className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-black/5 last:border-b-0 hover:bg-[#fafaf9]"
                    >
                      <td className="px-4 py-3 text-xs text-black/60">
                        {formatDateTime(log.createdAt)}
                      </td>

                      <td className="px-4 py-3 text-xs font-medium">
                        {log.user.username}
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[10px] font-medium text-black/55">
                          {formatLabel(log.module)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded-full bg-[#fff7e6] px-2.5 py-1 text-[10px] font-medium text-[#a56e00]">
                          {formatLabel(log.action)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-xs font-medium">
                          {log.description}
                        </p>

                        {log.entity ? (
                          <p className="mt-0.5 text-[10px] text-black/35">
                            {formatLabel(log.entity)}
                            {log.entityId
                              ? ` #${log.entityId}`
                              : ""}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-black/50">
        {label}
      </label>

      {children}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10";

function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function getColomboDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Colombo",
  }).format(value);
}