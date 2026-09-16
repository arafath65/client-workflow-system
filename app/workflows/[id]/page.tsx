import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

import Navigation from "../../components/Navigation";
import LogoutButton from "../../dashboard/LogoutButton";

import AddWorkflowStepButton from "./AddWorkflowStepButton";
import WorkflowStepFilter from "./WorkflowStepFilter";
import WorkflowSteps from "./WorkflowSteps";

export default async function WorkflowDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    stepStatus?: string;
  }>;
}) {
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
  // Workflow ID
  // --------------------------------------------------

  const { id } = await params;
  const workflowId = Number(id);

  if (
    !Number.isInteger(workflowId) ||
    workflowId <= 0
  ) {
    redirect("/workflows");
  }

  // --------------------------------------------------
  // Step Filter
  // --------------------------------------------------

  const { stepStatus } = await searchParams;

  const selectedStepStatus =
    stepStatus === "inactive" ||
    stepStatus === "all"
      ? stepStatus
      : "active";

  // --------------------------------------------------
  // Load Workflow
  // --------------------------------------------------

  const workflow =
    await prisma.workflowTemplate.findUnique({
      where: {
        id: workflowId,
      },
      include: {
        steps: {
          where:
            selectedStepStatus === "all"
              ? undefined
              : {
                  status:
                    selectedStepStatus === "active",
                },
          orderBy: {
            stepNumber: "asc",
          },
          include: {
            defaultStaff: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },

            subTasks: {
              orderBy: {
                subTaskNumber: "asc",
              },
              include: {
                defaultStaff: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

  if (!workflow) {
    redirect("/workflows");
  }

  // --------------------------------------------------
  // Load Active Staff
  // --------------------------------------------------

  const activeStaff =
    await prisma.staff.findMany({
      where: {
        status: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    });

  // --------------------------------------------------
  // Page
  // --------------------------------------------------

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

      {/* Navigation */}

      <Navigation currentPage="workflows" />

      {/* Main Content */}

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Back */}

        <Link
          href="/workflows"
          className="inline-flex items-center gap-2 text-xs font-medium text-black/40 transition hover:text-black"
        >
          <span>←</span>
          Back to Workflows
        </Link>

        {/* Workflow Header */}

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {workflow.name}
              </h1>

              <StatusBadge
                active={workflow.status}
              />
            </div>

            <p className="mt-2 max-w-2xl text-sm text-black/50">
              {workflow.description ||
                "Configure the steps and sub-tasks for this workflow."}
            </p>
          </div>
        </div>

        {/* Workflow Steps */}

        <div className="mt-8 overflow-hidden rounded-xl border border-black/10 bg-white">
          {/* Section Header */}

          <div className="flex flex-col gap-4 border-b border-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Workflow Steps
              </h2>

              <p className="mt-1 text-xs text-black/40">
                Drag steps to change their order.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <WorkflowStepFilter />

              <AddWorkflowStepButton
                workflowId={workflow.id}
                staff={activeStaff}
              />
            </div>
          </div>

          {/* Interactive Steps */}

          <WorkflowSteps
            steps={workflow.steps}
            staff={activeStaff}
          />
        </div>

        {/* Workflow Information */}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <InfoCard
            title="Steps"
            value={workflow.steps.length.toString()}
          />

          <InfoCard
            title="Sub Tasks"
            value={workflow.steps
              .reduce(
                (total, step) =>
                  total + step.subTasks.length,
                0
              )
              .toString()}
          />

          <InfoCard
            title="Default Staff"
            value={new Set(
              workflow.steps
                .map(
                  (step) =>
                    step.defaultStaff?.id
                )
                .filter(
                  (
                    staffId
                  ): staffId is number =>
                    staffId !== undefined
                )
            )
              .size.toString()}
          />
        </div>
      </section>
    </main>
  );
}

/* --------------------------------------------------
   Status Badge
-------------------------------------------------- */

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${
        active
          ? "bg-[#f9a800]/10 text-[#a66f00]"
          : "bg-black/[0.05] text-black/40"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* --------------------------------------------------
   Info Card
-------------------------------------------------- */

function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-black/45">
        {title}
      </p>

      <p className="mt-3 text-2xl font-semibold">
        {value}
      </p>
    </div>
  );
}