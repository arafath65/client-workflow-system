import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

import Navigation from "../components/Navigation";
import LogoutButton from "../dashboard/LogoutButton";

type SearchParams = {
  q?: string;
};

type SubTaskRow = {
  id: number;
  title: string;
  status: "PENDING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  assignedStaffName: string | null;
};

type WorkStep = {
  key: string;
  fileNumber: string;
  fileTitle: string;
  clientName: string;
  workflowName: string;
  stepNumber: number;
  stepTitle: string;
  status: "PENDING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  assignedAsStep: boolean;
  subtasks: SubTaskRow[];
};

type StaffWork = {
  id: number;
  name: string;
  position: string | null;
  active: boolean;
  completedSteps: WorkStep[];
  pendingSteps: WorkStep[];
  completedSubtasks: number;
  pendingSubtasks: number;
};

function getParam(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function stepIcon(status: WorkStep["status"]): string {
  if (status === "COMPLETED") return "✓";
  if (status === "ACTIVE") return "●";
  if (status === "ON_HOLD") return "⏸";
  return "○";
}

function stepLabel(status: WorkStep["status"]): string {
  if (status === "COMPLETED") return "Done";
  if (status === "ACTIVE") return "Active";
  if (status === "ON_HOLD") return "On hold";
  return "Pending";
}

function subtaskIcon(status: SubTaskRow["status"]): string {
  if (status === "COMPLETED") return "✓";
  if (status === "CANCELLED") return "×";
  return "○";
}

function subtaskLabel(status: SubTaskRow["status"]): string {
  if (status === "COMPLETED") return "Done";
  if (status === "CANCELLED") return "Cancelled";
  return "Pending";
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

  const [staff, tasks] = await Promise.all([
    prisma.staff.findMany({
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
    }),
    prisma.workflowTask.findMany({
      where: {
        status: {
          not: "CANCELLED",
        },
        fileWorkflow: {
          clientFile: {
            status: {
              in: ["OPEN", "IN_PROGRESS", "ON_HOLD"],
            },
          },
        },
      },
      orderBy: [
        {
          fileWorkflow: {
            clientFile: {
              createdAt: "desc",
            },
          },
        },
        {
          workflowStep: {
            stepNumber: "asc",
          },
        },
      ],
      select: {
        id: true,
        status: true,
        assignedStaffId: true,
        workflowStep: {
          select: {
            stepNumber: true,
            title: true,
          },
        },
        fileWorkflow: {
          select: {
            id: true,
            workflowTemplate: {
              select: {
                name: true,
              },
            },
            clientFile: {
              select: {
                id: true,
                fileNumber: true,
                title: true,
                client: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        subTasks: {
          where: {
            status: {
              not: "CANCELLED",
            },
          },
          orderBy: {
            workflowSubTask: {
              subTaskNumber: "asc",
            },
          },
          select: {
            id: true,
            status: true,
            assignedStaffId: true,
            workflowSubTask: {
              select: {
                title: true,
              },
            },
            assignedStaff: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const workMap = new Map<number, StaffWork>();

  for (const member of staff) {
    workMap.set(member.id, {
      id: member.id,
      name: member.name,
      position: member.position,
      active: member.status,
      completedSteps: [],
      pendingSteps: [],
      completedSubtasks: 0,
      pendingSubtasks: 0,
    });
  }

  const stepMaps = new Map<number, Map<string, WorkStep>>();

  for (const member of staff) {
    stepMaps.set(member.id, new Map());
  }

  for (const task of tasks) {
    const eligibleStaffIds = new Set<number>();

    if (task.assignedStaffId !== null && workMap.has(task.assignedStaffId)) {
      eligibleStaffIds.add(task.assignedStaffId);
    }

    for (const subTask of task.subTasks) {
      if (
        subTask.assignedStaffId !== null &&
        workMap.has(subTask.assignedStaffId)
      ) {
        eligibleStaffIds.add(subTask.assignedStaffId);
      }
    }

    for (const staffId of eligibleStaffIds) {
      const map = stepMaps.get(staffId)!;
      const assignedAsStep = task.assignedStaffId === staffId;

      const visibleSubtasks = assignedAsStep
        ? task.subTasks
        : task.subTasks.filter(
            (subTask) => subTask.assignedStaffId === staffId
          );

      const key = `${task.fileWorkflow.clientFile.id}|${task.fileWorkflow.id}|${task.id}`;
      const existing = map.get(key);

      if (existing) {
        const existingIds = new Set(existing.subtasks.map((item) => item.id));
        for (const subTask of visibleSubtasks) {
          if (!existingIds.has(subTask.id)) {
            existing.subtasks.push({
              id: subTask.id,
              title: subTask.workflowSubTask.title,
              status: subTask.status as SubTaskRow["status"],
              assignedStaffName: subTask.assignedStaff?.name ?? null,
            });
          }
        }
        existing.assignedAsStep = existing.assignedAsStep || assignedAsStep;
        continue;
      }

      map.set(key, {
        key,
        fileNumber: task.fileWorkflow.clientFile.fileNumber,
        fileTitle: task.fileWorkflow.clientFile.title,
        clientName: task.fileWorkflow.clientFile.client.name,
        workflowName: task.fileWorkflow.workflowTemplate.name,
        stepNumber: task.workflowStep.stepNumber,
        stepTitle: task.workflowStep.title,
        status: task.status,
        assignedAsStep,
        subtasks: visibleSubtasks.map((subTask) => ({
          id: subTask.id,
          title: subTask.workflowSubTask.title,
          status: subTask.status,
          assignedStaffName: subTask.assignedStaff?.name ?? null,
        })),
      });

    }
  }

  for (const member of staff) {
    const work = workMap.get(member.id)!;
    const steps = Array.from(stepMaps.get(member.id)!.values()).sort(
      (a, b) =>
        a.fileNumber.localeCompare(b.fileNumber) ||
        a.workflowName.localeCompare(b.workflowName) ||
        a.stepNumber - b.stepNumber
    );

    work.completedSteps = steps.filter(
      (step) => step.status === "COMPLETED"
    );
    work.pendingSteps = steps.filter(
      (step) => step.status !== "COMPLETED"
    );

    for (const step of steps) {
      for (const subtask of step.subtasks) {
        if (subtask.status === "COMPLETED") {
          work.completedSubtasks += 1;
        } else {
          work.pendingSubtasks += 1;
        }
      }
    }
  }

  const workRows = Array.from(workMap.values());
  const staffWithWork = workRows.filter(
    (member) =>
      member.completedSteps.length > 0 || member.pendingSteps.length > 0
  );

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

      <Navigation currentPage="staff-work" />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
            Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Staff Work
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/50">
            Search staff members and review their assigned workflow steps and
            subtasks.
          </p>
        </div>

        <form className="mt-6 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search staff by name..."
              className="h-10 flex-1 rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
            />
            <button
              type="submit"
              className="h-10 rounded-lg bg-black px-5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black"
            >
              Search
            </button>
            {query ? (
              <a
                href="/staff-work"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-black/10 px-5 text-xs font-semibold text-black/60 transition hover:border-black/20 hover:bg-black/5 hover:text-black"
              >
                Reset
              </a>
            ) : null}
          </div>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Staff workload</p>
            <p className="mt-1 text-xs text-black/40">
              {query
                ? `Search results for “${query}”`
                : "All staff members with their current assigned work."}
            </p>
          </div>
          <span className="text-[10px] font-medium text-black/30">
            {staffWithWork.length} with work / {staff.length} staff
          </span>
        </div>

        {staff.length === 0 ? (
          <div className="mt-4 rounded-xl border border-black/10 bg-white p-8 text-center">
            <p className="text-sm text-black/45">No staff members found.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {workRows.map((member) => (
              <section
                key={member.id}
                className="rounded-xl border border-black/10 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 border-b border-black/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
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
                      <p className="mt-1 text-xs text-black/40">
                        {member.position}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-4 gap-2 sm:min-w-[430px]">
                    <Stat label="Done steps" value={member.completedSteps.length} />
                    <Stat label="Pending steps" value={member.pendingSteps.length} />
                    <Stat label="Done subtasks" value={member.completedSubtasks} />
                    <Stat label="Pending subtasks" value={member.pendingSubtasks} />
                  </div>
                </div>

                {member.completedSteps.length === 0 &&
                member.pendingSteps.length === 0 ? (
                  <div className="pt-5 text-sm text-black/35">
                    No current workflow work is assigned to this staff member.
                  </div>
                ) : (
                  <div className="grid gap-5 pt-5 lg:grid-cols-2">
                    <WorkSection
                      title="Done steps"
                      emptyMessage="No completed steps."
                      steps={member.completedSteps}
                      emptyClass="text-black/30"
                    />
                    <WorkSection
                      title="Pending / active steps"
                      emptyMessage="No pending or active steps."
                      steps={member.pendingSteps}
                      emptyClass="text-black/30"
                    />
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        <p className="mt-5 text-[10px] leading-5 text-black/30">
          Cancelled files and cancelled tasks are excluded from this page. A
          step shows all of its subtasks when the staff member owns the step;
          when the staff member is assigned only to a subtask, only that
          subtask is shown.
        </p>
      </section>
    </main>
  );
}

function WorkSection({
  title,
  emptyMessage,
  steps,
  emptyClass,
}: {
  title: string;
  emptyMessage: string;
  steps: WorkStep[];
  emptyClass: string;
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-[#fafaf9] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-black/50">
        {title}
      </h3>

      {steps.length === 0 ? (
        <p className={`mt-4 text-sm ${emptyClass}`}>{emptyMessage}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {steps.map((step) => (
            <div key={step.key} className="rounded-lg border border-black/10 bg-white p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.status === "COMPLETED"
                      ? "bg-[#edf7e8] text-[#4f8a45]"
                      : "bg-black/5 text-black/45"
                  }`}
                >
                  {stepIcon(step.status)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-semibold">
                      Step {step.stepNumber}: {step.stepTitle}
                    </p>
                    <span className="text-[10px] font-medium text-black/35">
                      {stepLabel(step.status)}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-black/45">
                    {step.clientName} · {step.fileNumber} · {step.fileTitle}
                  </p>
                  <p className="mt-1 text-[10px] text-black/30">
                    Workflow: {step.workflowName}
                  </p>

                  {step.subtasks.length > 0 ? (
                    <div className="mt-4 border-l border-black/10 pl-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35">
                        Subtasks
                      </p>
                      <div className="mt-2 space-y-2">
                        {step.subtasks.map((subtask) => (
                          <div key={subtask.id} className="flex items-start gap-2">
                            <span
                              className={`mt-0.5 text-xs font-bold ${
                                subtask.status === "COMPLETED"
                                  ? "text-[#4f8a45]"
                                  : "text-black/30"
                              }`}
                            >
                              {subtaskIcon(subtask.status)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-xs ${
                                  subtask.status === "COMPLETED"
                                    ? "text-black/65"
                                    : "text-black/80"
                                }`}
                              >
                                {subtask.title}
                              </p>
                              <p className="text-[9px] text-black/30">
                                {subtaskLabel(subtask.status)}
                                {subtask.assignedStaffName
                                  ? ` · ${subtask.assignedStaffName}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-[10px] text-black/30">
                      No subtasks defined for this step.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-[#fafaf9] px-3 py-2">
      <p className="text-[9px] uppercase tracking-wide text-black/30">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
