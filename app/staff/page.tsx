import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AddStaffButton from "./AddStaffButton";

export default async function StaffPage() {
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
      id: true,
      username: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  // --------------------------------------------------
  // Staff
  // --------------------------------------------------
  const staff = await prisma.staff.findMany({
    orderBy: {
      name: "asc",
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

            <a
              href="/dashboard"
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black/60 transition hover:border-black/20 hover:bg-black hover:text-white"
            >
              Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Heading */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
              Administration
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Staff
            </h1>

            <p className="mt-2 text-sm text-black/50">
              Manage staff members who can be assigned to workflow tasks.
            </p>
          </div>

          {/* Add Staff */}
          <AddStaffButton />
        </div>

        {/* Summary */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Total Staff"
            value={staff.length.toString()}
          />

          <SummaryCard
            title="Active"
            value={staff
              .filter((member) => member.status)
              .length.toString()}
          />

          <SummaryCard
            title="Inactive"
            value={staff
              .filter((member) => !member.status)
              .length.toString()}
          />
        </div>

        {/* Staff Table */}
        <div className="mt-6 overflow-hidden rounded-xl border border-black/10 bg-white">
          {/* Table Header */}
          <div className="border-b border-black/10 px-5 py-4">
            <h2 className="text-sm font-semibold">
              Staff Members
            </h2>

            <p className="mt-1 text-xs text-black/40">
              Staff available for assignment to workflow steps.
            </p>
          </div>

          {/* Empty State */}
          {staff.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04]">
                  <span className="text-lg text-black/30">
                    +
                  </span>
                </div>

                <p className="mt-4 text-sm font-medium text-black/50">
                  No staff members yet
                </p>

                <p className="mt-1 text-xs text-black/30">
                  Add your first staff member to get started.
                </p>
              </div>
            </div>
          ) : (
            /* Staff Table */
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-black/10 bg-[#fafaf9]">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Name
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Position
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Phone
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Email
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
                  {staff.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b border-black/5 transition last:border-b-0 hover:bg-[#fafaf9]"
                    >
                      {/* Name */}
                      <td className="px-5 py-4">
                        <p className="text-xs font-semibold">
                          {member.name}
                        </p>
                      </td>

                      {/* Position */}
                      <td className="px-5 py-4 text-xs text-black/55">
                        {member.position || "—"}
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-4 text-xs text-black/55">
                        {member.phone || "—"}
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 text-xs text-black/55">
                        {member.email || "—"}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge active={member.status} />
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          className="text-xs font-medium text-black/40 transition hover:text-black"
                        >
                          Edit
                        </button>
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