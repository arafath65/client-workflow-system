import AddClientFileButton from "./AddClientFileButton";
import ClientFileFilter from "./ClientFileFilter";
import ClientFileProgress from "./ClientFileProgress";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navigation from "../../components/Navigation";

type ClientDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    fileStatus?: string;
  }>;
};

const allowedStatuses = [
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

type FileFilterStatus =
  (typeof allowedStatuses)[number];

export default async function ClientDetailsPage({
  params,
  searchParams,
}: ClientDetailsPageProps) {
  // --------------------------------------------------
  // Authentication
  // --------------------------------------------------

  const cookieStore = await cookies();
  const sessionUser =
    cookieStore.get("session_user");

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
  // Parameters
  // --------------------------------------------------

  const { id } = await params;
  const { fileStatus } = await searchParams;

  const clientId = Number(id);

  if (
    !Number.isInteger(clientId) ||
    clientId <= 0
  ) {
    notFound();
  }

  // --------------------------------------------------
  // File Filter
  // --------------------------------------------------

  const selectedFileStatus: FileFilterStatus =
    allowedStatuses.includes(
      fileStatus as FileFilterStatus
    )
      ? (fileStatus as FileFilterStatus)
      : "IN_PROGRESS";

  // --------------------------------------------------
  // Client
  // --------------------------------------------------

  const client =
    await prisma.client.findUnique({
      where: {
        id: clientId,
      },

      include: {
        files: {
          where: {
            status: selectedFileStatus,
          },

          orderBy: {
            createdAt: "desc",
          },

          include: {
            thirdParty: {
              select: {
                id: true,
                name: true,
              },
            },

            fileWorkflows: {
              include: {
                workflowTemplate: {
                  select: {
                    id: true,
                    name: true,
                  },
                },

                tasks: {
                  include: {
                    workflowStep: {
                      select: {
                        id: true,
                        stepNumber: true,
                        title: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

  if (!client) {
    notFound();
  }

  // --------------------------------------------------
  // Counts
  // --------------------------------------------------

  const totalFiles =
    await prisma.clientFile.count({
      where: {
        clientId: client.id,
      },
    });

  const openFiles =
    await prisma.clientFile.count({
      where: {
        clientId: client.id,
        status: {
          in: ["OPEN", "IN_PROGRESS"],
        },
      },
    });

  const completedFiles =
    await prisma.clientFile.count({
      where: {
        clientId: client.id,
        status: "COMPLETED",
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

      {/* Navigation */}
      <Navigation currentPage="clients" />

      {/* Main Content */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/clients"
            className="text-xs font-medium text-black/40 hover:text-black"
          >
            ← Back to Clients
          </Link>
        </div>

        {/* Client Header */}
        <div className="rounded-xl border border-black/10 bg-white p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
                Client
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {client.name}
              </h1>

              <div className="mt-3 flex flex-col gap-1 text-sm text-black/50">
                <p>
                  WhatsApp:{" "}
                  <span className="font-medium text-black/70">
                    {client.whatsapp ||
                      "Not provided"}
                  </span>
                </p>

                <p>
                  Client ID:{" "}
                  <span className="font-medium text-black/70">
                    #{client.id}
                  </span>
                </p>
              </div>
            </div>

            <AddClientFileButton
              clientId={client.id}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Total Files"
            value={totalFiles.toString()}
            description="Files registered"
          />

          <SummaryCard
            title="Open Files"
            value={openFiles.toString()}
            description="Open and in progress"
          />

          <SummaryCard
            title="Completed"
            value={completedFiles.toString()}
            description="Completed files"
          />
        </div>

        {/* Files */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          {/* Section Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Client Files
              </h2>

              <p className="mt-1 text-xs text-black/40">
                Services and files registered for this
                client.
              </p>
            </div>

            {/* File Status Filter */}
            <ClientFileFilter
              currentStatus={
                selectedFileStatus
              }
            />
          </div>

          {/* Current Filter */}
          <div className="mt-4">
            <span className="inline-flex rounded-full bg-black/[0.04] px-2.5 py-1 text-[10px] font-medium text-black/50">
              Showing:{" "}
              {selectedFileStatus ===
              "IN_PROGRESS"
                ? "In Progress"
                : selectedFileStatus ===
                    "COMPLETED"
                  ? "Completed"
                  : "Cancelled"}
            </span>
          </div>

          {/* No Files */}
          {client.files.length === 0 ? (
            <div className="mt-6 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9]">
              <div className="text-center">
                <p className="text-sm font-medium text-black/50">
                  No{" "}
                  {selectedFileStatus ===
                  "IN_PROGRESS"
                    ? "in-progress"
                    : selectedFileStatus ===
                        "COMPLETED"
                      ? "completed"
                      : "cancelled"}{" "}
                  files
                </p>

                <p className="mt-1 text-xs text-black/30">
                  {selectedFileStatus ===
                  "IN_PROGRESS"
                    ? "Create a new file to start a service for this client."
                    : "There are no files with this status."}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-lg border border-black/10">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_1.2fr_1.2fr_1.5fr_auto] gap-4 border-b border-black/10 bg-[#fafaf9] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  File Number
                </p>

                <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Service Type
                </p>

                <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Third Party
                </p>

                <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Progress
                </p>

                <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Action
                </p>
              </div>

              {/* Files */}
              {client.files.map((file) => {
                const workflowName =
                  file.fileWorkflows[0]
                    ?.workflowTemplate.name ||
                  "—";

                const tasks =
                  file.fileWorkflows.flatMap(
                    (workflow) =>
                      workflow.tasks
                  );

                const totalTasks =
                  tasks.length;

                const completedTasks =
                  tasks.filter(
                    (task) =>
                      task.status ===
                      "COMPLETED"
                  ).length;

                return (
                  <div
                    key={file.id}
                    className="grid grid-cols-[1fr_1.2fr_1.2fr_1.5fr_auto] items-center gap-4 border-b border-black/5 px-4 py-5 last:border-b-0 hover:bg-[#fafaf9]"
                  >
                    {/* File Number */}
                    <div>
                      <p className="text-xs font-semibold">
                        {file.fileNumber}
                      </p>

                      <p className="mt-0.5 text-[10px] text-black/35">
                        {formatDate(
                          file.createdAt
                        )}
                      </p>
                    </div>

                    {/* Service Type */}
                    <p className="truncate text-xs font-medium">
                      {workflowName}
                    </p>

                    {/* Third Party */}
                    <p className="truncate text-xs text-black/55">
                      {file.thirdParty?.name ||
                        "Direct"}
                    </p>

                    {/* Progress */}
                    <ClientFileProgress
                      completed={
                        completedTasks
                      }
                      total={totalTasks}
                      fileStatus={
                        file.status
                      }
                    />

                    {/* Action */}
                    <Link
                      href={`/files/${file.id}`}
                      className="whitespace-nowrap text-xs font-medium text-black/50 hover:text-black"
                    >
                      View
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/* --------------------------------------------------
   Summary Card
-------------------------------------------------- */

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