import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

import Navigation from "../components/Navigation";
import LogoutButton from "../dashboard/LogoutButton";

import AddThirdPartyButton from "./AddThirdPartyButton";
import EditThirdPartyButton from "./EditThirdPartyButton";
import ThirdPartyStatusButton from "./ThirdPartyStatusButton";
import ThirdPartyFilter from "./ThirdPartyFilter";

export default async function ThirdPartiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
  }>;
}) {
  /* =========================================================
     AUTHENTICATION
     ========================================================= */

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

  /* =========================================================
     FILTER
     ========================================================= */

  const { status } = await searchParams;

  const selectedStatus =
    status === "inactive" || status === "all"
      ? status
      : "active";

  /* =========================================================
     LOAD THIRD PARTIES
     ========================================================= */

  const thirdParties =
    await prisma.thirdParty.findMany({
      where:
        selectedStatus === "all"
          ? undefined
          : {
              status: selectedStatus === "active",
            },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        whatsapp: true,
        status: true,
      },
    });

  /* =========================================================
     SUMMARY COUNTS
     ========================================================= */

  const [
    totalCount,
    activeCount,
    inactiveCount,
  ] = await Promise.all([
    prisma.thirdParty.count(),

    prisma.thirdParty.count({
      where: {
        status: true,
      },
    }),

    prisma.thirdParty.count({
      where: {
        status: false,
      },
    }),
  ]);

  /* =========================================================
     PAGE
     ========================================================= */

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

            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <Navigation currentPage="third-parties" />

      {/* Content */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Third Parties
            </h1>

            <p className="mt-2 text-sm text-black/50">
              Manage referral partners who send clients
              to A&I Global.
            </p>
          </div>

          <AddThirdPartyButton />
        </div>

        {/* Summary Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Total Third Parties"
            value={totalCount.toString()}
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

        {/* Third Party List */}
        <div className="mt-8 overflow-hidden rounded-xl border border-black/10 bg-white">
          {/* List Header */}
          <div className="flex flex-col gap-4 border-b border-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Third Party List
              </h2>

              <p className="mt-1 text-xs text-black/40">
                Manage your referral partners.
              </p>
            </div>

            <ThirdPartyFilter />
          </div>

          {/* Table */}
          {thirdParties.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center px-6">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04]">
                  <span className="text-lg text-black/30">
                    +
                  </span>
                </div>

                <p className="mt-4 text-sm font-medium text-black/50">
                  No third parties found
                </p>

                <p className="mt-1 text-xs text-black/30">
                  Add a third party to get started.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px]">
                <thead>
                  <tr className="border-b border-black/10 bg-[#fafaf9]">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-black/35">
                      Third Party
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-black/35">
                      WhatsApp
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-black/35">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-black/35">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {thirdParties.map(
                    (thirdParty) => (
                      <tr
                        key={thirdParty.id}
                        className="border-b border-black/5 last:border-b-0"
                      >
                        {/* Name */}
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-black/80">
                            {thirdParty.name}
                          </p>
                        </td>

                        {/* WhatsApp */}
                        <td className="px-5 py-4">
                          <p className="text-xs text-black/50">
                            {thirdParty.whatsapp ||
                              "—"}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <StatusBadge
                            active={
                              thirdParty.status
                            }
                          />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-4">
                            <EditThirdPartyButton
                              thirdParty={{
                                id: thirdParty.id,
                                name: thirdParty.name,
                                whatsapp:
                                  thirdParty.whatsapp,
                              }}
                            />

                            <ThirdPartyStatusButton
                              thirdPartyId={
                                thirdParty.id
                              }
                              active={
                                thirdParty.status
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   SUMMARY CARD
   ========================================================= */

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

/* =========================================================
   STATUS BADGE
   ========================================================= */

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