import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FileStatus } from "@/generated/prisma/client";

import Navigation from "../components/Navigation";
import LogoutButton from "../dashboard/LogoutButton";
import StaffWorkFilters from "./StaffWorkFilters";

type FileFilter = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type SearchParams = {
  q?: string;
  status?: string;
};

type SubTaskView = {
  id: number;
  number: number;
  title: string;
  status: "PENDING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  assignedStaffName: string | null;
};

type StepView = {
  id: number;
  number: number;
  title: string;
  status: "PENDING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  assignedStaffName: string | null;
  subtasks: SubTaskView[];
};

type WorkflowView = {
  id: number;
  name: string;
  status:
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "ON_HOLD"
    | "COMPLETED"
    | "CANCELLED";
  steps: StepView[];
};

type FileView = {
  id: number;
  fileNumber: string;
  title: string;
  clientName: string;
  status: FileFilter;
  workflows: WorkflowView[];
};

type StaffView = {
  id: number;
  name: string;
  position: string | null;
  active: boolean;
  files: FileView[];
};

type StaffDb = {
  id: number;
  name: string;
  position: string | null;
  status: boolean;
};

function getParam(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function getFileFilter(value: string): FileFilter {
  if (value === "COMPLETED") return "COMPLETED";
  if (value === "CANCELLED") return "CANCELLED";
  return "IN_PROGRESS";
}

function statusIcon(status: string) {
  if (status === "COMPLETED") return "✓";
  if (status === "CANCELLED") return "×";
  return "○";
}

function statusLabel(status: string) {
  switch (status) {
    case "COMPLETED":
      return "Done";
    case "ACTIVE":
      return "Active";
    case "ON_HOLD":
      return "On hold";
    case "CANCELLED":
      return "Cancelled";
    case "IN_PROGRESS":
      return "In progress";
    default:
      return "Pending";
  }
}

export default async function StaffWorkPage({
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
    select: { username: true },
  });

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const query = getParam(params.q);
  const fileFilter = getFileFilter(getParam(params.status));

  const reportStaffRows = await prisma.staff.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      position: true,
      status: true,
    },
  });

  const staffRows = await prisma.staff.findMany({
    where: query
      ? {
          name: {
            contains: query,
          },
        }
      : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      position: true,
      status: true,
    },
  });

  const fileStatusWhere =
    fileFilter === "COMPLETED"
      ? FileStatus.COMPLETED
      : fileFilter === "CANCELLED"
        ? FileStatus.CANCELLED
        : {
            in: [
              FileStatus.OPEN,
              FileStatus.IN_PROGRESS,
              FileStatus.ON_HOLD,
            ],
          };

  const dbFiles = await prisma.clientFile.findMany({
    where: {
      status: fileStatusWhere,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileNumber: true,
      title: true,
      status: true,
      client: {
        select: {
          name: true,
        },
      },
      fileWorkflows: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          workflowTemplate: {
            select: {
              name: true,
            },
          },
          assignedStaffId: true,
          assignedStaff: {
            select: {
              id: true,
              name: true,
            },
          },
          tasks: {
            orderBy: {
              workflowStep: {
                stepNumber: "asc",
              },
            },
            select: {
              id: true,
              status: true,
              assignedStaffId: true,
              assignedStaff: {
                select: {
                  id: true,
                  name: true,
                },
              },
              workflowStep: {
                select: {
                  stepNumber: true,
                  title: true,
                },
              },
              subTasks: {
                orderBy: {
                  workflowSubTask: {
                    subTaskNumber: "asc",
                  },
                },
                select: {
                  id: true,
                  status: true,
                  assignedStaffId: true,
                  assignedStaff: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                  workflowSubTask: {
                    select: {
                      subTaskNumber: true,
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

  const staffMap = new Map<number, StaffView>();

  for (const member of staffRows as StaffDb[]) {
    staffMap.set(member.id, {
      id: member.id,
      name: member.name,
      position: member.position,
      active: member.status,
      files: [],
    });
  }

  for (const file of dbFiles) {
    for (const workflow of file.fileWorkflows) {
      // Show each file only under its MAIN responsible staff.
      // Step and subtask-specific assignments are displayed inside the
      // same file and must not create duplicate file cards.
      if (workflow.assignedStaffId === null) continue;

      const staff = staffMap.get(workflow.assignedStaffId);
      if (!staff) continue;

      const fileView: FileView = {
        id: file.id,
        fileNumber: file.fileNumber,
        title: file.title,
        clientName: file.client.name,
        status:
          file.status === "COMPLETED"
            ? "COMPLETED"
            : file.status === "CANCELLED"
              ? "CANCELLED"
              : "IN_PROGRESS",
        workflows: [
          {
            id: workflow.id,
            name: workflow.workflowTemplate.name,
            status: workflow.status,
            steps: workflow.tasks.map((task) => ({
              id: task.id,
              number: task.workflowStep.stepNumber,
              title: task.workflowStep.title,
              status: task.status,
              assignedStaffName: task.assignedStaff?.name ?? null,
              subtasks: task.subTasks.map((subTask) => ({
                id: subTask.id,
                number: subTask.workflowSubTask.subTaskNumber,
                title: subTask.workflowSubTask.title,
                status: subTask.status,
                assignedStaffName: subTask.assignedStaff?.name ?? null,
              })),
            })),
          },
        ],
      };

      const existingFile = staff.files.find((item) => item.id === file.id);

      if (!existingFile) {
        staff.files.push(fileView);
      } else {
        existingFile.workflows.push(fileView.workflows[0]);
      }
    }
  }

  const visibleStaff = Array.from(staffMap.values()).filter(
    (member) => member.files.length > 0
  );

  const totalFiles = new Set(
    visibleStaff.flatMap((member) => member.files.map((file) => file.id))
  ).size;

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

      <Navigation currentPage="staff-work" />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
            Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Staff Work</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/50">
            Review every file handled by staff, including all workflow steps and
            subtasks with their current status.
          </p>
        </div>

        <StaffWorkFilters
          status={fileFilter}
          query={query}
          staff={reportStaffRows}
        />

        <div className="mt-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">
              {fileFilter === "COMPLETED"
                ? "Completed files"
                : fileFilter === "CANCELLED"
                  ? "Cancelled files"
                  : "In-progress files"}
            </p>
            <p className="mt-1 text-xs text-black/40">
              {query
                ? `Staff results for “${query}”.`
                : "Every file with at least one staff assignment is shown."}
            </p>
          </div>
          <span className="text-[10px] font-medium text-black/30">
            {visibleStaff.length} staff · {totalFiles} file{totalFiles === 1 ? "" : "s"}
          </span>
        </div>

        {visibleStaff.length === 0 ? (
          <div className="mt-4 rounded-xl border border-black/10 bg-white p-10 text-center">
            <p className="text-sm font-medium text-black/45">No files found.</p>
            <p className="mt-1 text-xs text-black/30">
              No files in this status have a staff, step, or subtask assignment
              matching your search.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {visibleStaff.map((member) => (
              <section
                key={member.id}
                className="rounded-xl border border-black/10 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 border-b border-black/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{member.name}</h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide ${
                          member.active
                            ? "bg-[#f0f8ef] text-[#4b7f45]"
                            : "bg-black/5 text-black/40"
                        }`}
                      >
                        {member.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {member.position ? (
                      <p className="mt-1 text-xs text-black/40">{member.position}</p>
                    ) : null}
                  </div>
                  <span className="text-[10px] text-black/35">
                    {member.files.length} file{member.files.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-5 space-y-5">
                  {member.files.map((file) => (
                    <article key={file.id} className="rounded-xl border border-black/10 bg-[#fafaf9] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{file.fileNumber}</span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-medium text-black/40">
                              {file.status === "COMPLETED"
                                ? "Completed"
                                : file.status === "CANCELLED"
                                  ? "Cancelled"
                                  : "In Progress"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-black/60">
                            {file.clientName} · {file.title}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-4">
                        {file.workflows.map((workflow) => {
                          const completedSteps = workflow.steps.filter(
                            (step) => step.status === "COMPLETED"
                          ).length;
                          const totalSteps = workflow.steps.length;

                          return (
                            <div key={workflow.id} className="rounded-lg border border-black/10 bg-white p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold">{workflow.name}</p>
                                  <p className="mt-1 text-[10px] text-black/35">
                                    {completedSteps} of {totalSteps} steps completed · {statusLabel(workflow.status)}
                                  </p>
                                </div>
                                <span
                                  className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-semibold ${
                                    workflow.status === "COMPLETED"
                                      ? "bg-[#edf7e8] text-[#4f8a45]"
                                      : "bg-black/5 text-black/45"
                                  }`}
                                >
                                  {statusIcon(workflow.status)} {statusLabel(workflow.status)}
                                </span>
                              </div>

                              <div className="mt-4 space-y-3">
                                {workflow.steps.length === 0 ? (
                                  <p className="text-xs text-black/30">No workflow steps found.</p>
                                ) : (
                                  workflow.steps.map((step) => (
                                    <div key={step.id} className="rounded-lg border border-black/10 bg-[#fafaf9] px-3 py-3">
                                      <div className="flex items-start gap-3">
                                        <span
                                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                            step.status === "COMPLETED"
                                              ? "bg-[#edf7e8] text-[#4f8a45]"
                                              : step.status === "CANCELLED"
                                                ? "bg-red-50 text-red-400"
                                                : "bg-black/5 text-black/40"
                                          }`}
                                        >
                                          {statusIcon(step.status)}
                                        </span>

                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-xs font-semibold">
                                              Step {step.number}: {step.title}
                                            </p>
                                            <span className="text-[9px] text-black/35">
                                              {statusLabel(step.status)}
                                            </span>
                                          </div>

                                          {step.assignedStaffName ? (
                                            <p className="mt-1 text-[9px] text-black/30">
                                              Assigned to: {step.assignedStaffName}
                                            </p>
                                          ) : null}

                                          {step.subtasks.length > 0 ? (
                                            <div className="mt-3 space-y-1.5 border-l border-black/10 pl-3">
                                              {step.subtasks.map((subtask) => (
                                                <div key={subtask.id} className="flex items-start gap-2">
                                                  <span
                                                    className={`mt-0.5 text-[11px] font-bold ${
                                                      subtask.status === "COMPLETED"
                                                        ? "text-[#4f8a45]"
                                                        : subtask.status === "CANCELLED"
                                                          ? "text-red-400"
                                                          : "text-black/30"
                                                    }`}
                                                  >
                                                    {statusIcon(subtask.status)}
                                                  </span>
                                                  <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] text-black/70">
                                                      {subtask.assignedStaffName
                                                        ? `${subtask.assignedStaffName} · `
                                                        : ""}
                                                      {subtask.number}. {subtask.title}
                                                    </p>
                                                    <p className="text-[9px] text-black/30">
                                                      {statusLabel(subtask.status)}
                                                    </p>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="mt-2 text-[9px] text-black/30">No subtasks.</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="mt-5 text-[10px] leading-5 text-black/30">
          Each file is shown once under its main responsible staff member.
          Step and subtask-specific staff assignments are shown beside those
          items inside the same file, so the admin can review the full workflow
          without duplicate file cards.
        </p>
      </section>
    </main>
  );
}
