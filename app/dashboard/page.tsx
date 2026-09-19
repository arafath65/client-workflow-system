import Navigation from "../components/Navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LogoutButton from "./LogoutButton";

export default async function DashboardPage() {
  // --------------------------------------------------
  // Authentication
  // --------------------------------------------------
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

  // --------------------------------------------------
  // Dashboard Statistics
  // --------------------------------------------------
  const startOfTodaySriLanka = getSriLankaDayStart();
  const startOfFourthDaySriLanka = getSriLankaDayStart(3);

  const [
    clientCount,
    activeFileCount,
    pendingTaskCount,
    outstandingFiles,
    threeDayTaskCount,
    workflowAttentionTasks,
  ] = await Promise.all([
    // Client model does not have a status field.
    prisma.client.count(),

    prisma.clientFile.count({
      where: {
        status: {
          in: ["OPEN", "IN_PROGRESS"],
        },
      },
    }),

    prisma.workflowTask.count({
      where: {
        status: {
          in: ["PENDING", "ACTIVE"],
        },
      },
    }),

    // Calculate outstanding balance across ALL client files.
    prisma.clientFile.findMany({
      where: {
        status: {
          not: "CANCELLED",
        },
      },
      select: {
        id: true,
        fileNumber: true,
        title: true,
        client: {
          select: {
            name: true,
          },
        },
        fileWorkflows: {
          select: {
            finalAmount: true,
          },
        },
        charges: {
          select: {
            totalAmount: true,
          },
        },
        payments: {
          where: {
            status: "CLEARED",
          },
          select: {
            amount: true,
          },
        },
      },
    }),

    prisma.calendarEvent.count({
      where: {
        status: "SCHEDULED",
        startAt: {
          gte: startOfTodaySriLanka,
          lt: startOfFourthDaySriLanka,
        },
      },
    }),

    // Active or on-hold workflow tasks that need attention.
    prisma.workflowTask.findMany({
      where: {
        status: {
          in: ["ACTIVE", "ON_HOLD"],
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: 6,
      include: {
        workflowStep: {
          select: {
            title: true,
          },
        },
        assignedStaff: {
          select: {
            name: true,
          },
        },
        fileWorkflow: {
          select: {
            clientFile: {
              select: {
                fileNumber: true,
                client: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const outstandingItems = outstandingFiles
    .map((file) => {
      const workflowFees = file.fileWorkflows.reduce(
        (sum, workflow) => sum + Number(workflow.finalAmount ?? 0),
        0
      );

      const extraCharges = file.charges.reduce(
        (sum, charge) => sum + Number(charge.totalAmount ?? 0),
        0
      );

      const totalPaid = file.payments.reduce(
        (sum, payment) => sum + Number(payment.amount ?? 0),
        0
      );

      return {
        ...file,
        outstanding: Math.max(
          workflowFees + extraCharges - totalPaid,
          0
        ),
      };
    })
    .filter((file) => file.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  const totalOutstanding = outstandingItems.reduce(
    (grandTotal, file) => grandTotal + file.outstanding,
    0
  );

  // --------------------------------------------------
  // Next 3 Days Task Load
  // --------------------------------------------------
  const upcomingTasks = await prisma.calendarEvent.findMany({
    where: {
      status: "SCHEDULED",
      startAt: {
        gte: startOfTodaySriLanka,
        lt: startOfFourthDaySriLanka,
      },
    },
    orderBy: {
      startAt: "asc",
    },
    take: 12,
    include: {
      clientFile: {
        select: {
          fileNumber: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      },
      staff: {
        select: {
          name: true,
        },
      },
    },
  });

  // --------------------------------------------------
  // Recent Files
  // --------------------------------------------------
  const recentFiles = await prisma.clientFile.findMany({
    take: 5,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          whatsapp: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-[#171717]">
      {/* Header */}
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Brand */}
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

          {/* User */}
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

      {/* Shared Navigation */}
      <Navigation currentPage="dashboard" />

      {/* Main Content */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Page Heading */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
            Overview
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Welcome back, {user.username}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
            Manage clients, files, workflows, payments and
            appointments from one workspace.
          </p>
        </div>

        {/* Dashboard Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="Clients"
            value={clientCount.toString()}
            description="Registered clients"
          />

          <DashboardCard
            title="Active Files"
            value={activeFileCount.toString()}
            description="Open and in progress"
          />

          <DashboardCard
            title="Pending Tasks"
            value={pendingTaskCount.toString()}
            description="Pending and active tasks"
          />

          <DashboardCard
            title="Outstanding"
            value={`LKR ${formatCurrency(totalOutstanding)}`}
            description="Total outstanding across all files"
          />
        </div>

        {/* Lower Dashboard Area */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Recent Files */}
          <div className="rounded-xl border border-black/10 bg-white p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">
                  Recent Files
                </h2>

                <p className="mt-1 text-xs text-black/40">
                  Recently created client files
                </p>
              </div>

              <Link
                href="/files"
                className="text-xs font-medium text-[#d99000] hover:text-black"
              >
                View all
              </Link>
            </div>

            {recentFiles.length === 0 ? (
              <div className="mt-6 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9]">
                <div className="text-center">
                  <p className="text-sm font-medium text-black/50">
                    No files yet
                  </p>

                  <p className="mt-1 text-xs text-black/30">
                    Client files will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-lg border border-black/10">
                <div className="grid grid-cols-[1fr_1.5fr_1.2fr_auto] gap-4 border-b border-black/10 bg-[#fafaf9] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    File
                  </p>

                  <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Client
                  </p>

                  <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Service
                  </p>

                  <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Status
                  </p>
                </div>

                {recentFiles.map((file) => (
                  <div
                    key={file.id}
                    className="grid grid-cols-[1fr_1.5fr_1.2fr_auto] items-center gap-4 border-b border-black/5 px-4 py-3 last:border-b-0 hover:bg-[#fafaf9]"
                  >
                    <div>
                      <p className="text-xs font-semibold">
                        {file.fileNumber}
                      </p>

                      <p className="mt-0.5 text-[10px] text-black/35">
                        {formatDate(file.createdAt)}
                      </p>
                    </div>

                    <p className="truncate text-xs font-medium">
                      {file.client.name}
                    </p>

                    <p className="truncate text-xs text-black/55">
                      {file.title}
                    </p>

                    <FileStatusBadge status={file.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next 3 Days Task Load */}
          <div className="rounded-xl border border-black/10 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">
                  3 Days Task Load
                </h2>

                <p className="mt-1 text-xs text-black/40">
                  Scheduled tasks for today and the next 2 days
                </p>
              </div>

              <span className="rounded-full bg-[#fff5db] px-2.5 py-1 text-[10px] font-semibold text-[#b77900]">
                {threeDayTaskCount}
              </span>
            </div>

            {upcomingTasks.length === 0 ? (
              <div className="mt-6 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9]">
                <div className="text-center">
                  <p className="text-sm font-medium text-black/50">
                    No scheduled tasks
                  </p>

                  <p className="mt-1 text-xs text-black/30">
                    Your next 3 days are clear.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                {upcomingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-black/10 bg-[#fafaf9] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {task.title}
                        </p>

                        <p className="mt-1 text-[10px] text-black/45">
                          {formatTaskDay(task.startAt)} · {formatTaskTime(task.startAt)}
                        </p>

                        {task.clientFile ? (
                          <p className="mt-1 truncate text-[10px] text-black/55">
                            {task.clientFile.client.name} · {task.clientFile.fileNumber}
                          </p>
                        ) : null}
                      </div>

                      {task.staff ? (
                        <span className="whitespace-nowrap text-[10px] text-black/40">
                          {task.staff.name}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}

                {threeDayTaskCount > upcomingTasks.length ? (
                  <p className="pt-2 text-center text-[10px] text-black/35">
                    Showing {upcomingTasks.length} of {threeDayTaskCount} scheduled tasks
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Attention Required */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold">
              Attention Required
            </h2>

            <p className="mt-1 text-xs text-black/40">
              Items that may need action or follow-up
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* Outstanding Payments */}
            <AttentionPanel title="Outstanding Payments" subtitle="Files with unpaid balance" href="/payments">
              {outstandingItems.length === 0 ? (
                <EmptyAttention text="No outstanding payments" />
              ) : (
                <>
                  {outstandingItems.slice(0, 5).map((file) => (
                    <div key={file.id} className="rounded-lg border border-black/10 bg-white px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{file.client.name}</p>
                          <p className="mt-0.5 truncate text-[10px] text-black/45">{file.fileNumber} · {file.title}</p>
                        </div>
                        <p className="whitespace-nowrap text-[10px] font-semibold text-black/65">
                          LKR {formatCurrency(file.outstanding)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {outstandingItems.length > 5 ? (
                    <AttentionMore text={`Showing 5 of ${outstandingItems.length} files`} />
                  ) : null}
                </>
              )}
            </AttentionPanel>

            {/* Workflow Attention */}
            <AttentionPanel title="Workflow Attention" subtitle="Active or on-hold workflow tasks" href="/files">
              {workflowAttentionTasks.length === 0 ? (
                <EmptyAttention text="No workflow tasks need attention" />
              ) : (
                <>
                  {workflowAttentionTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="rounded-lg border border-black/10 bg-white px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{task.workflowStep.title}</p>
                          <p className="mt-0.5 truncate text-[10px] text-black/45">
                            {task.fileWorkflow.clientFile.client.name} · {task.fileWorkflow.clientFile.fileNumber}
                          </p>
                        </div>

                        <span className="whitespace-nowrap rounded-full bg-black/[0.04] px-2 py-1 text-[9px] font-medium text-black/50">
                          {task.status === "ON_HOLD" ? "On Hold" : "Active"}
                        </span>
                      </div>

                      {task.assignedStaff ? (
                        <p className="mt-1 text-[10px] text-black/35">{task.assignedStaff.name}</p>
                      ) : null}
                    </div>
                  ))}

                  {workflowAttentionTasks.length > 5 ? (
                    <AttentionMore text={`Showing 5 of ${workflowAttentionTasks.length} tasks`} />
                  ) : null}
                </>
              )}
            </AttentionPanel>
          </div>
        </div>

      </section>
    </main>
  );
}

function getSriLankaDayStart(daysFromToday = 0) {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const base = new Date(`${dateKey}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + daysFromToday);

  const year = base.getUTCFullYear();
  const month = String(base.getUTCMonth() + 1).padStart(2, "0");
  const day = String(base.getUTCDate()).padStart(2, "0");

  return new Date(`${year}-${month}-${day}T00:00:00+05:30`);
}

function formatTaskDay(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Colombo",
  }).format(date);
}

function formatTaskTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Colombo",
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value ?? "";

  if (hour === "12" && minute === "00" && dayPeriod.toLowerCase() === "am") {
    return "All day";
  }

  return `${hour}:${minute} ${dayPeriod}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(value, 0));
}

/* --------------------------------------------------
   Dashboard Card
-------------------------------------------------- */

function DashboardCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-black/15 hover:shadow">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-black/45">
          {title}
        </p>

        <div className="h-2 w-2 rounded-full bg-[#f9a800]" />
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-1 text-xs text-black/35">
        {description}
      </p>
    </div>
  );
}

/* --------------------------------------------------
   File Status Badge
-------------------------------------------------- */

function FileStatusBadge({
  status,
}: {
  status:
    | "OPEN"
    | "IN_PROGRESS"
    | "ON_HOLD"
    | "COMPLETED"
    | "CANCELLED";
}) {
  const statusLabel = {
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    ON_HOLD: "On Hold",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  }[status];

  return (
    <span className="whitespace-nowrap rounded-full bg-black/[0.04] px-2.5 py-1 text-[10px] font-medium text-black/55">
      {statusLabel}
    </span>
  );
}

/* --------------------------------------------------
   Date Formatter
-------------------------------------------------- */

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function AttentionPanel({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-[#fafaf9] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">{title}</p>
          <p className="mt-1 text-[10px] text-black/40">{subtitle}</p>
        </div>

        <Link href={href} className="text-[10px] font-medium text-[#d99000] hover:text-black">
          View all
        </Link>
      </div>

      <div className="mt-4 space-y-2">{children}</div>
    </div>
  );
}

function EmptyAttention({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-black/10 bg-white px-3 py-5 text-center">
      <p className="text-xs font-medium text-black/45">{text}</p>
    </div>
  );
}

function AttentionMore({ text }: { text: string }) {
  return <p className="pt-1 text-center text-[10px] text-black/35">{text}</p>;
}

function formatDueDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).format(date);
}
