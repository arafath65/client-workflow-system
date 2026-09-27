import Navigation from "../components/Navigation";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AddClientButton from "./AddClientButton";
import ClientsList from "./ClientsList";

type ClientFileSummary = {
  status: string;
  fileWorkflows: {
    finalAmount: unknown;
  }[];
  charges: {
    totalAmount: unknown;
  }[];
  payments: {
    amount: unknown;
    status: string;
  }[];
};

function calculateFileDue(file: ClientFileSummary) {
  if (file.status === "CANCELLED") {
    return 0;
  }

  const workflowTotal =
    file.fileWorkflows.reduce(
      (sum, workflow) =>
        sum + Number(workflow.finalAmount),
      0
    );

  const chargeTotal =
    file.charges.reduce(
      (sum, charge) =>
        sum + Number(charge.totalAmount),
      0
    );

  const clearedPayments =
    file.payments.reduce(
      (sum, payment) =>
        payment.status === "CLEARED"
          ? sum + Number(payment.amount)
          : sum,
      0
    );

  return Math.max(
    0,
    workflowTotal +
      chargeTotal -
      clearedPayments
  );
}

export default async function ClientsPage() {
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

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    redirect("/login");
  }

  const user =
    await prisma.user.findUnique({
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
  // Load all clients once
  // --------------------------------------------------

  const [
    clients,
    totalActiveClients,
    inProgressClients,
    completedClients,
  ] = await Promise.all([
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        whatsapp: true,
        status: true,

        files: {
          select: {
            status: true,

            fileWorkflows: {
              select: {
                finalAmount: true,
              },
            },

            charges: {
              select: {
                totalAmount: true,
              },
            },

            payments: {
              select: {
                amount: true,
                status: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.client.count({
      where: {
        status: true,
      },
    }),

    prisma.client.count({
      where: {
        status: true,
        files: {
          some: {
            status: {
              in: [
                "OPEN",
                "IN_PROGRESS",
                "ON_HOLD",
              ],
            },
          },
        },
      },
    }),

    prisma.client.count({
      where: {
        status: true,
        files: {
          some: {
            status: "COMPLETED",
          },
          none: {
            status: {
              in: [
                "OPEN",
                "IN_PROGRESS",
                "ON_HOLD",
              ],
            },
          },
        },
      },
    }),
  ]);

  // --------------------------------------------------
  // Prepare client data
  // --------------------------------------------------

  const clientRows = clients.map(
    (client) => {
      const totalFiles =
        client.files.length;

      const inProgressFiles =
        client.files.filter(
          (file) =>
            file.status === "OPEN" ||
            file.status === "IN_PROGRESS" ||
            file.status === "ON_HOLD"
        ).length;

      const totalDue =
        client.files.reduce(
          (sum, file) =>
            sum +
            calculateFileDue(file),
          0
        );

      return {
        id: client.id,
        name: client.name,
        whatsapp: client.whatsapp,
        status: client.status,
        totalFiles,
        inProgressFiles,
        totalDue,
      };
    }
  );

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

      <Navigation currentPage="clients" />

      {/* Main */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Page Heading */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
              Clients
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Clients
            </h1>

            <p className="mt-2 text-sm text-black/50">
              Manage your registered clients and
              their contact information.
            </p>
          </div>

          <AddClientButton />
        </div>

        {/* Summary */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Total Clients"
            value={String(totalActiveClients)}
            description="Active registered clients"
          />

          <SummaryCard
            title="In Progress"
            value={String(inProgressClients)}
            description="Clients with active files"
          />

          <SummaryCard
            title="Completed"
            value={String(completedClients)}
            description="Clients with no active files"
          />
        </div>

        {/* Client List */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <ClientsList clients={clientRows} />
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