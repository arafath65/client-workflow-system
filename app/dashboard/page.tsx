import Navigation from "../components/Navigation";
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
  const [clientCount, activeFileCount, pendingTaskCount] =
    await Promise.all([
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
    ]);

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
            value="LKR 0"
            description="Payment calculation coming next"
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

              <button
                type="button"
                className="text-xs font-medium text-[#d99000] hover:text-black"
              >
                View all
              </button>
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

          {/* Today's Tasks */}
          <div className="rounded-xl border border-black/10 bg-white p-5">
            <div>
              <h2 className="text-sm font-semibold">
                Today&apos;s Tasks
              </h2>

              <p className="mt-1 text-xs text-black/40">
                Tasks requiring attention today
              </p>
            </div>

            <div className="mt-6 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9]">
              <div className="text-center">
                <p className="text-sm font-medium text-black/50">
                  No tasks
                </p>

                <p className="mt-1 text-xs text-black/30">
                  Today&apos;s tasks will appear here.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold">
              Quick Actions
            </h2>

            <p className="mt-1 text-xs text-black/40">
              Common actions for managing your work
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction
              title="New Client"
              description="Register a new client"
            />

            <QuickAction
              title="New File"
              description="Create a client file"
            />

            <QuickAction
              title="New Payment"
              description="Record a payment"
            />

            <QuickAction
              title="Calendar"
              description="View appointments"
            />
          </div>
        </div>
      </section>
    </main>
  );
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

/* --------------------------------------------------
   Quick Action
-------------------------------------------------- */

function QuickAction({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      className="group rounded-lg border border-black/10 bg-[#fafaf9] p-4 text-left transition hover:border-[#f9a800]/40 hover:bg-[#fffaf0]"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {title}
        </p>

        <span className="text-black/30 transition group-hover:translate-x-1 group-hover:text-[#d99000]">
          →
        </span>
      </div>

      <p className="mt-1 text-xs text-black/40">
        {description}
      </p>
    </button>
  );
}