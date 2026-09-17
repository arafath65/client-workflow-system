
import FilesFilter from "./FilesFilter";
import Link from "next/link";
import Navigation from "../components/Navigation";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type FilesPageProps = {
  searchParams: Promise<{
    search?: string;
    status?: string;
  }>;
};

const fileStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function statusClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-700";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-700";
    case "ON_HOLD":
      return "bg-amber-100 text-amber-700";
    case "CANCELLED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default async function FilesPage({
  searchParams,
}: FilesPageProps) {
  // Authentication
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

  // Search and status filter
  const params = await searchParams;
  const search = params.search?.trim() || "";
  const selectedStatus = params.status || "";

  const validStatus = fileStatuses.includes(
    selectedStatus as (typeof fileStatuses)[number]
  );

  const where = {
    ...(search
      ? {
          OR: [
            {
              fileNumber: {
                contains: search,
              },
            },
            {
              title: {
                contains: search,
              },
            },
            {
              client: {
                name: {
                  contains: search,
                },
              },
            },
          ],
        }
      : {}),
    ...(validStatus
      ? {
          status:
            selectedStatus as (typeof fileStatuses)[number],
        }
      : {}),
  };

  const [files, totalFiles, inProgressFiles, completedFiles] =
    await Promise.all([
      prisma.clientFile.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          fileWorkflows: {
            include: {
              assignedStaff: {
                select: {
                  name: true,
                },
              },
              tasks: {
                include: {
                  assignedStaff: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          calendarEvents: {
            where: {
              status: "SCHEDULED",
            },
            orderBy: {
              startAt: "asc",
            },
            take: 1,
            select: {
              startAt: true,
              title: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),

      prisma.clientFile.count(),

      prisma.clientFile.count({
        where: {
          status: "IN_PROGRESS",
        },
      }),

      prisma.clientFile.count({
        where: {
          status: "COMPLETED",
        },
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
              <p className="text-sm font-semibold">A&I Global</p>
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

            <form action="/api/auth/logout" method="POST">
              <button className="rounded-lg border border-black/10 px-3 py-2 text-xs font-medium hover:bg-black/[0.03]">
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <Navigation currentPage="files" />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Heading */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
            File Management
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            All Files
          </h1>

          <p className="mt-2 text-sm text-black/50">
            View and track files across all registered clients.
          </p>
        </div>

        {/* Summary */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-xs font-medium text-black/45">
              Total Files
            </p>
            <p className="mt-3 text-2xl font-semibold">
              {totalFiles}
            </p>
            <p className="mt-1 text-xs text-black/35">
              All registered files
            </p>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-xs font-medium text-black/45">
              In Progress
            </p>
            <p className="mt-3 text-2xl font-semibold">
              {inProgressFiles}
            </p>
            <p className="mt-1 text-xs text-black/35">
              Files currently in progress
            </p>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-xs font-medium text-black/45">
              Completed
            </p>
            <p className="mt-3 text-2xl font-semibold">
              {completedFiles}
            </p>
            <p className="mt-1 text-xs text-black/35">
              Completed files
            </p>
          </div>
        </div>

        {/* File list */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                All Client Files
              </h2>
              <p className="mt-1 text-xs text-black/40">
                Search and filter files from every client.
              </p>
            </div>

            {/* Live search and status filter */}
            <FilesFilter />
          </div>

          <div className="mt-5 text-xs text-black/45">
            Showing {files.length} file(s)
          </div>

          {files.length === 0 ? (
            <div className="mt-5 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9]">
              <div className="text-center">
                <p className="text-sm font-medium text-black/50">
                  No files found
                </p>
                <p className="mt-1 text-xs text-black/30">
                  Try changing your search or filter.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-lg border border-black/10">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-[#fafaf9]">
                  <tr className="border-b border-black/10">
                    {[
                      "File",
                      "Client",
                      "Status",
                      "Workflow",
                      "Assigned Staff",
                      "Next Calendar Event",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-black/40"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {files.map((file) => {
                    const tasks = file.fileWorkflows.flatMap(
                      (workflow) => workflow.tasks
                    );

                    const completedTasks = tasks.filter(
                      (task) => task.status === "COMPLETED"
                    ).length;

                    const progress =
                      tasks.length > 0
                        ? Math.round(
                            (completedTasks / tasks.length) * 100
                          )
                        : 0;

                    const assignedNames = Array.from(
                      new Set(
                        file.fileWorkflows.flatMap((workflow) => [
                          ...(workflow.assignedStaff
                            ? [workflow.assignedStaff.name]
                            : []),
                          ...workflow.tasks.flatMap((task) =>
                            task.assignedStaff
                              ? [task.assignedStaff.name]
                              : []
                          ),
                        ])
                      )
                    );

                    const nextEvent = file.calendarEvents[0];

                    return (
                      <tr
                        key={file.id}
                        className="border-b border-black/5 last:border-b-0 hover:bg-[#fafaf9]"
                      >
                        <td className="px-4 py-4">
                          <p className="text-xs font-semibold">
                            {file.fileNumber}
                          </p>
                          <p className="mt-1 text-xs text-black/50">
                            {file.title}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <Link
                            href={`/clients/${file.client.id}`}
                            className="text-xs font-medium hover:text-[#d99000]"
                          >
                            {file.client.name}
                          </Link>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClass(file.status)}`}
                          >
                            {formatStatus(file.status)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-xs font-medium">
                            {completedTasks} / {tasks.length} tasks
                          </p>
                          <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-black/10">
                            <div
                              className="h-full rounded-full bg-[#f9a800]"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[10px] text-black/40">
                            {progress}% complete
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="max-w-40 text-xs text-black/60">
                            {assignedNames.length
                              ? assignedNames.join(", ")
                              : "Unassigned"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          {nextEvent ? (
                            <>
                              <p className="text-xs font-medium">
                                {nextEvent.title}
                              </p>
                              <p className="mt-1 text-[10px] text-black/45">
                                {formatDate(nextEvent.startAt)}
                              </p>
                            </>
                          ) : (
                            <span className="text-xs text-black/35">
                              No scheduled event
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <Link
                            href={`/files/${file.id}`}
                            className="inline-flex rounded-lg border border-black/10 px-3 py-2 text-xs font-medium hover:border-[#f9a800] hover:bg-[#fffaf0]"
                          >
                            View File →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}