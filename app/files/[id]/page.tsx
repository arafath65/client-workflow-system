import Link from "next/link";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navigation from "../../components/Navigation";
import WorkflowTaskCheckbox from "./WorkflowTaskCheckbox";
import StepStaffAssignment from "./StepStaffAssignment";
import WorkflowSubTaskStaffAssignment from "./WorkflowSubTaskStaffAssignment";

type FileDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function FileDetailsPage({
  params,
}: FileDetailsPageProps) {
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
  // File ID
  // --------------------------------------------------

  const { id } = await params;
  const fileId = Number(id);

  if (!Number.isInteger(fileId) || fileId <= 0) {
    notFound();
  }

  // --------------------------------------------------
  // Client File
  // --------------------------------------------------

  const clientFile =
    await prisma.clientFile.findUnique({
      where: {
        id: fileId,
      },

      include: {
        client: {
          select: {
            id: true,
            name: true,
            whatsapp: true,
          },
        },

        thirdParty: {
          select: {
            id: true,
            name: true,
            whatsapp: true,
          },
        },

        fileWorkflows: {
          orderBy: {
            createdAt: "asc",
          },

          include: {
            // --------------------------------------------------
            // Main Responsible Staff
            // --------------------------------------------------

            assignedStaff: {
              select: {
                id: true,
                name: true,
              },
            },

            workflowTemplate: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },

            tasks: {
              orderBy: {
                workflowStep: {
                  stepNumber: "asc",
                },
              },

              include: {
                workflowStep: {
                  select: {
                    id: true,
                    stepNumber: true,
                    title: true,
                    description: true,
                  },
                },

                // --------------------------------------------------
                // File-Specific Step Staff Override
                // --------------------------------------------------

                assignedStaff: {
                  select: {
                    id: true,
                    name: true,
                  },
                },

                // --------------------------------------------------
                // File Subtasks
                // --------------------------------------------------

                subTasks: {
                  orderBy: {
                    workflowSubTask: {
                      subTaskNumber: "asc",
                    },
                  },

                  include: {
                    workflowSubTask: {
                      select: {
                        id: true,
                        subTaskNumber: true,
                        title: true,
                        description: true,
                      },
                    },

                    assignedStaff: {
                      select: {
                        id: true,
                        name: true,
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

  if (!clientFile) {
    notFound();
  }

  // --------------------------------------------------
  // Primary Workflow
  // --------------------------------------------------

  const fileWorkflow =
    clientFile.fileWorkflows[0] || null;

  const workflowTasks =
    fileWorkflow?.tasks || [];

  // --------------------------------------------------
  // Main Responsible Staff
  // --------------------------------------------------

  const mainResponsibleStaff =
    fileWorkflow?.assignedStaff?.name ||
    "";

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
      <Navigation currentPage="files" />

      {/* Main Content */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2">
          <Link
            href={`/clients/${clientFile.client.id}`}
            className="text-xs font-medium text-black/40 hover:text-black"
          >
            ← Back to Client
          </Link>

          <span className="text-xs text-black/20">
            /
          </span>

          <span className="text-xs text-black/40">
            {clientFile.fileNumber}
          </span>
        </div>

        {/* File Header */}
        <div className="rounded-xl border border-black/10 bg-white p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            {/* Main Info */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
                Client File
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {clientFile.fileNumber}
              </h1>

              <p className="mt-2 text-sm text-black/45">
                {fileWorkflow?.workflowTemplate.name ||
                  clientFile.title}
              </p>
            </div>

            {/* Status */}
            <FileStatusBadge
              status={clientFile.status}
            />
          </div>

          {/* Information */}
          <div className="mt-6 grid gap-5 border-t border-black/10 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem
              label="Client"
              value={clientFile.client.name}
            />

            <InfoItem
              label="WhatsApp"
              value={
                clientFile.client.whatsapp ||
                "Not provided"
              }
            />

            <InfoItem
              label="Service Type"
              value={
                fileWorkflow?.workflowTemplate.name ||
                clientFile.title
              }
            />

            <InfoItem
              label="Third Party"
              value={
                clientFile.thirdParty?.name ||
                "Direct"
              }
            />

            <InfoItem
              label="File Number"
              value={clientFile.fileNumber}
            />

            <InfoItem
              label="Opened"
              value={formatDate(
                clientFile.openedAt
              )}
            />

            <InfoItem
              label="File Status"
              value={formatStatus(
                clientFile.status
              )}
            />

            <InfoItem
              label="Workflow Status"
              value={
                fileWorkflow
                  ? formatStatus(
                      fileWorkflow.status
                    )
                  : "Not Started"
              }
            />
          </div>

          {/* Description */}
          {clientFile.description && (
            <div className="mt-6 border-t border-black/10 pt-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                Description
              </p>

              <p className="mt-2 text-sm leading-6 text-black/65">
                {clientFile.description}
              </p>
            </div>
          )}
        </div>

        {/* Workflow */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#f9a800]">
              Workflow
            </p>

            <h2 className="mt-1 text-lg font-semibold">
              {fileWorkflow?.workflowTemplate.name ||
                "No Workflow"}
            </h2>

            {/* Main Responsible Staff */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-black/30">
                Main Responsible
              </span>

              <span className="text-xs font-semibold text-black/65">
                {fileWorkflow?.assignedStaff?.name ||
                  "Unassigned"}
              </span>
            </div>

            {fileWorkflow?.workflowTemplate
              .description && (
              <p className="mt-1 text-xs text-black/40">
                {
                  fileWorkflow.workflowTemplate
                    .description
                }
              </p>
            )}
          </div>

          {workflowTasks.length === 0 ? (
            <div className="mt-6 flex min-h-32 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9]">
              <p className="text-sm text-black/40">
                No workflow tasks found.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {workflowTasks.map((task) => {
                const effectiveStepStaff =
                  task.assignedStaff?.name ||
                  mainResponsibleStaff ||
                  "Unassigned";

                return (
                  <WorkflowTaskRow
                    key={task.id}
                    taskId={task.id}
                    stepNumber={
                      task.workflowStep.stepNumber
                    }
                    title={
                      task.workflowStep.title
                    }
                    description={
                      task.workflowStep.description
                    }
                    status={task.status}
                    assignedStaffId={
                      task.assignedStaff?.id ||
                      null
                    }
                    assignedStaffName={
                      task.assignedStaff?.name ||
                      null
                    }
                    inheritedStaffName={
                      mainResponsibleStaff ||
                      "Unassigned"
                    }
                    subTasks={
                      task.subTasks
                    }
                    effectiveStepStaff={
                      effectiveStepStaff
                    }
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Payments Placeholder */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#f9a800]">
            Payments
          </p>

          <h2 className="mt-1 text-lg font-semibold">
            Payment Summary
          </h2>

          <div className="mt-5 rounded-lg border border-dashed border-black/10 bg-[#fafaf9] p-6 text-center">
            <p className="text-sm font-medium text-black/50">
              Payment management will be added next.
            </p>

            <p className="mt-1 text-xs text-black/30">
              Charges, payments, installments and
              outstanding balance will appear here.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

/* --------------------------------------------------
   Info Item
-------------------------------------------------- */

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-black/35">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-black/75">
        {value}
      </p>
    </div>
  );
}

/* --------------------------------------------------
   Workflow Task Row
-------------------------------------------------- */

function WorkflowTaskRow({
  taskId,
  stepNumber,
  title,
  description,
  status,
  assignedStaffId,
  assignedStaffName,
  inheritedStaffName,
  subTasks,
  effectiveStepStaff,
}: {
  taskId: number;
  stepNumber: number;
  title: string;
  description: string | null;
  status:
    | "PENDING"
    | "ACTIVE"
    | "ON_HOLD"
    | "COMPLETED"
    | "CANCELLED";
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  inheritedStaffName: string;
  subTasks: {
    id: number;
    assignedStaffId: number | null;
    assignedStaff: {
      id: number;
      name: string;
    } | null;
    workflowSubTask: {
      id: number;
      subTaskNumber: number;
      title: string;
      description: string | null;
    };
  }[];
  effectiveStepStaff: string;
}) {
  const isActive = status === "ACTIVE";
  const isCompleted = status === "COMPLETED";

  return (
    <div
      className={`rounded-lg border p-4 transition ${
        isActive
          ? "border-[#f9a800]/50 bg-[#fffaf0]"
          : "border-black/10 bg-white"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <WorkflowTaskCheckbox
          taskId={taskId}
          status={status}
        />

        {/* Step Number */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            isCompleted
              ? "bg-black text-[#f9a800]"
              : isActive
              ? "bg-[#f9a800] text-black"
              : "bg-black/[0.05] text-black/45"
          }`}
        >
          {isCompleted ? "✓" : stepNumber}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">
                {title}
              </h3>

              {description && (
                <p className="mt-1 text-xs leading-5 text-black/40">
                  {description}
                </p>
              )}
            </div>

            <TaskStatusBadge status={status} />
          </div>

          {/* Step Staff Assignment */}
          <StepStaffAssignment
            taskId={taskId}
            assignedStaffId={
              assignedStaffId
            }
            inheritedStaffName={
              inheritedStaffName
            }
          />

          {/* Current Step Assignment */}
          <div className="mt-2">
            {assignedStaffName ? (
              <p className="text-[9px] text-black/30">
                This step is specifically
                assigned to{" "}
                <span className="font-medium text-black/45">
                  {assignedStaffName}
                </span>
                .
              </p>
            ) : (
              <p className="text-[9px] text-black/30">
                This step inherits{" "}
                <span className="font-medium text-black/45">
                  {effectiveStepStaff}
                </span>
                .
              </p>
            )}
          </div>

          {/* Subtasks */}
          {subTasks.length > 0 && (
            <div className="mt-4 border-l-2 border-black/5 pl-4">
              <div className="mb-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-black/25">
                  Sub Tasks
                </p>
              </div>

              <div className="space-y-2">
                {subTasks.map(
                  (subTask) => {
                    const effectiveSubTaskStaff =
                      subTask.assignedStaff
                        ?.name ||
                      effectiveStepStaff;

                    return (
                      <div
                        key={subTask.id}
                        className="rounded-lg bg-[#fafaf9] px-3 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/[0.04] text-[9px] font-medium text-black/40">
                            {
                              subTask
                                .workflowSubTask
                                .subTaskNumber
                            }
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-black/65">
                              {
                                subTask
                                  .workflowSubTask
                                  .title
                              }
                            </p>

                            {subTask
                              .workflowSubTask
                              .description && (
                              <p className="mt-1 text-[9px] leading-4 text-black/35">
                                {
                                  subTask
                                    .workflowSubTask
                                    .description
                                }
                              </p>
                            )}

                            <WorkflowSubTaskStaffAssignment
                              subTaskId={
                                subTask.id
                              }
                              assignedStaffId={
                                subTask.assignedStaffId
                              }
                              inheritedStaffName={
                                effectiveSubTaskStaff
                              }
                            />

                            <div className="mt-1">
                              {subTask.assignedStaff ? (
                                <p className="text-[8px] text-black/25">
                                  This subtask has
                                  its own staff
                                  override.
                                </p>
                              ) : (
                                <p className="text-[8px] text-black/25">
                                  Inherits from
                                  this step.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>
      </div>
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
  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-black/[0.05] px-3 py-1.5 text-xs font-semibold text-black/60">
      {formatStatus(status)}
    </span>
  );
}

/* --------------------------------------------------
   Task Status Badge
-------------------------------------------------- */

function TaskStatusBadge({
  status,
}: {
  status:
    | "PENDING"
    | "ACTIVE"
    | "ON_HOLD"
    | "COMPLETED"
    | "CANCELLED";
}) {
  const statusClass =
    status === "ACTIVE"
      ? "bg-[#f9a800]/15 text-black"
      : status === "COMPLETED"
      ? "bg-black text-white"
      : status === "CANCELLED"
      ? "bg-black/[0.08] text-black/45"
      : "bg-black/[0.04] text-black/50";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClass}`}
    >
      {formatStatus(status)}
    </span>
  );
}

/* --------------------------------------------------
   Status Formatter
-------------------------------------------------- */

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
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