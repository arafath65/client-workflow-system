import Navigation from "../components/Navigation";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FilesList from "./FilesList";

const FILE_PAGE_SIZE = 20;

const fileStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;

type FileStatus = (typeof fileStatuses)[number];

function formatDate(date: Date | null | undefined) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}) {
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
    where: { id: userId },
    select: { username: true },
  });

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.search?.trim() || "";
  const requestedStatus = params.status || "";

  const statusFilter = fileStatuses.includes(
    requestedStatus as FileStatus
  )
    ? (requestedStatus as FileStatus)
    : null;

  const requestedPage = Number.parseInt(params.page || "1", 10);
  const safeRequestedPage =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

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
                OR: [
                  {
                    name: {
                      contains: search,
                    },
                  },
                  {
                    whatsapp: {
                      contains: search,
                    },
                  },
                ],
              },
            },
          ],
        }
      : {}),
    ...(statusFilter
      ? {
          status: statusFilter,
        }
      : {}),
  };

  const [
    totalFilteredFiles,
    totalFiles,
    inProgressFiles,
    completedFiles,
  ] = await Promise.all([
    prisma.clientFile.count({ where }),
    prisma.clientFile.count(),
    prisma.clientFile.count({
      where: { status: "IN_PROGRESS" },
    }),
    prisma.clientFile.count({
      where: { status: "COMPLETED" },
    }),
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(totalFilteredFiles / FILE_PAGE_SIZE)
  );

  const currentPage = Math.min(
    safeRequestedPage,
    totalPages
  );

  const files = await prisma.clientFile.findMany({
    where,
    skip: (currentPage - 1) * FILE_PAGE_SIZE,
    take: FILE_PAGE_SIZE,

    select: {
      id: true,
      fileNumber: true,
      title: true,
      status: true,

      client: {
        select: {
          id: true,
          name: true,
          whatsapp: true,
        },
      },

      fileWorkflows: {
        select: {
          assignedStaff: {
            select: {
              name: true,
            },
          },

          tasks: {
            select: {
              status: true,

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

      updatedAt: true,
    },

    orderBy: {
      updatedAt: "desc",
    },
  });

  const fileRows = files.map((file) => {
    const tasks = file.fileWorkflows.flatMap(
      (workflow) => workflow.tasks
    );

    const completedTasks = tasks.filter(
      (task) => task.status === "COMPLETED"
    ).length;

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

    return {
      id: file.id,
      fileNumber: file.fileNumber,
      title: file.title,
      status: file.status,

      client: {
        id: file.client.id,
        name: file.client.name,
        whatsapp: file.client.whatsapp,
      },

      totalTasks: tasks.length,
      completedTasks,
      assignedNames,

      nextEvent: nextEvent
        ? {
            title: nextEvent.title,
            startAt: nextEvent.startAt.toISOString(),
          }
        : null,

      updatedAt: formatDate(file.updatedAt),
    };
  });

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-[#171717]">
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

            <form
              action="/api/auth/logout"
              method="POST"
            >
              <button
                type="submit"
                className="rounded-lg border border-black/10 px-3 py-2 text-xs font-medium hover:bg-black/[0.03]"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <Navigation currentPage="files" />

      <section className="mx-auto max-w-7xl px-6 py-8">
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

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Total Files"
            value={String(totalFiles)}
            description="All registered files"
          />

          <SummaryCard
            title="In Progress"
            value={String(inProgressFiles)}
            description="Files currently in progress"
          />

          <SummaryCard
            title="Completed"
            value={String(completedFiles)}
            description="Completed files"
          />
        </div>

        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <FilesList
            key={`${search}|${statusFilter ?? "ALL"}|${currentPage}`}
            files={fileRows}
            totalFiles={totalFilteredFiles}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={FILE_PAGE_SIZE}
            initialSearch={search}
            initialStatus={statusFilter ?? "ALL"}
          />
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <p className="text-xs font-medium text-black/45">
        {title}
      </p>

      <p className="mt-3 text-2xl font-semibold">
        {value}
      </p>

      <p className="mt-1 text-xs text-black/35">
        {description}
      </p>
    </div>
  );
}
