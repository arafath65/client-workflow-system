import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

import Navigation from "../components/Navigation";
import LogoutButton from "../dashboard/LogoutButton";
import AddWorkflowButton from "./AddWorkflowButton";
import EditWorkflowButton from "./EditWorkflowButton";
import WorkflowStatusButton from "./WorkflowStatusButton";
import WorkflowFilter from "./WorkflowFilter";

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
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
  // Filter
  // --------------------------------------------------
  const params = await searchParams;
  const filter = params.status || "active";

  // --------------------------------------------------
  // Workflows
  // --------------------------------------------------
  const workflows = await prisma.workflowTemplate.findMany({
    where:
      filter === "inactive"
        ? { status: false }
        : filter === "all"
          ? undefined
          : { status: true },
    orderBy: {
      name: "asc",
    },
  });

  // --------------------------------------------------
  // Summary Counts
  // --------------------------------------------------
  const [totalWorkflows, activeCount, inactiveCount] =
    await Promise.all([
      prisma.workflowTemplate.count(),

      prisma.workflowTemplate.count({
        where: {
          status: true,
        },
      }),

      prisma.workflowTemplate.count({
        where: {
          status: false,
        },
      }),
    ]);

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
        {/* Page Heading */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
              Administration
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Workflows
            </h1>

            <p className="mt-2 text-sm text-black/50">
              Create and manage service workflows used for client
              files.
            </p>
          </div>

          <AddWorkflowButton />
        </div>

        {/* Summary Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Total Workflows"
            value={totalWorkflows.toString()}
          />

          <SummaryCard
            title="Active"
            value={activeCount.toString()}
          />

          <SummaryCard
            title="Inactive"
            value={inactiveCount.toString()}
          />
        </div>

        {/* Workflow List */}
        <div className="mt-8 overflow-hidden rounded-xl border border-black/10 bg-white">
          {/* Section Header */}
          <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">
                Workflow Templates
              </h2>

              <p className="mt-1 text-xs text-black/40">
                Workflows available when creating client files.
              </p>
            </div>

            <WorkflowFilter />
          </div>

          {/* Empty State */}
          {workflows.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04]">
                  <span className="text-lg text-black/30">
                    +
                  </span>
                </div>

                <p className="mt-4 text-sm font-medium text-black/50">
                  {filter === "inactive"
                    ? "No inactive workflows"
                    : filter === "all"
                      ? "No workflows yet"
                      : "No active workflows"}
                </p>

                <p className="mt-1 text-xs text-black/30">
                  {filter === "active"
                    ? "Create your first workflow to get started."
                    : "Try changing the workflow filter."}
                </p>
              </div>
            </div>
          ) : (
            /* Workflow Table */
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-black/10 bg-[#fafaf9]">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Workflow
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Description
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {workflows.map((workflow) => (
                    <tr
                      key={workflow.id}
                      className={`border-b border-black/5 transition last:border-b-0 hover:bg-[#fafaf9] ${
                        !workflow.status ? "opacity-60" : ""
                      }`}
                    >
                      {/* Workflow Title */}
                      <td className="px-5 py-4">
  <Link
    href={`/workflows/${workflow.id}`}
    className="text-sm font-semibold text-black transition hover:text-[#f9a800]"
  >
    {workflow.name}
  </Link>
</td>

                      {/* Description */}
                      <td className="max-w-md px-5 py-4">
                        <p className="truncate text-xs text-black/55">
                          {workflow.description || "—"}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge active={workflow.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-4">
                          <EditWorkflowButton
                            workflow={workflow}
                          />

                          <WorkflowStatusButton
                            id={workflow.id}
                            active={workflow.status}
                          />
                        </div>
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

/* --------------------------------------------------
   Summary Card
-------------------------------------------------- */

function SummaryCard({
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