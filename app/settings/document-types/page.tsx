import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

import Navigation from "../../components/Navigation";
import LogoutButton from "../../dashboard/LogoutButton";
import DocumentTypesClient from "./DocumentTypesClient";
import DocumentTypeFilter from "./DocumentTypeFilter";

export default async function DocumentTypesPage({
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

  if (!Number.isInteger(userId) || userId <= 0) {
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
  // Status Filter
  // --------------------------------------------------

  const params = await searchParams;

  const filter =
    params.status === "inactive" || params.status === "all"
      ? params.status
      : "active";

  // --------------------------------------------------
  // Load Document Types
  // --------------------------------------------------

  const documentTypes = await prisma.documentType.findMany({
    where:
      filter === "inactive"
        ? {
            status: false,
          }
        : filter === "all"
          ? undefined
          : {
              status: true,
            },

    orderBy: {
      name: "asc",
    },

    select: {
      id: true,
      name: true,
      description: true,
      defaultAmount: true,
      status: true,
    },
  });

  // --------------------------------------------------
  // Summary Counts
  // --------------------------------------------------

  const [totalCount, activeCount, inactiveCount] =
    await Promise.all([
      prisma.documentType.count(),

      prisma.documentType.count({
        where: {
          status: true,
        },
      }),

      prisma.documentType.count({
        where: {
          status: false,
        },
      }),
    ]);

  // --------------------------------------------------
  // Serialize Decimal Values
  // --------------------------------------------------

  const serializedDocumentTypes = documentTypes.map(
    (documentType) => ({
      id: documentType.id,
      name: documentType.name,
      description: documentType.description,
      defaultAmount: Number(documentType.defaultAmount),
      status: documentType.status,
    })
  );

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

      <Navigation currentPage="settings" />

      {/* Content */}

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Page Heading */}

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
            Settings
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Document Types
          </h1>

          <p className="mt-2 text-sm text-black/50">
            Manage reusable document types and their
            default prices for document-based
            workflows.
          </p>
        </div>

        {/* Summary */}

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-xs text-black/40">
              Total Document Types
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {totalCount}
            </p>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-xs text-black/40">
              Active
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {activeCount}
            </p>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-xs text-black/40">
              Inactive
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {inactiveCount}
            </p>
          </div>
        </div>

        {/* Document Type Section */}

        <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
          {/* Section Header */}

          <div className="flex flex-col gap-4 border-b border-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Document Types
              </h2>

              <p className="mt-1 text-xs text-black/40">
                Reusable document types and their
                default service prices.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <DocumentTypeFilter />
            </div>
          </div>

          {/* Client Component */}

          <DocumentTypesClient
  key={filter}
  initialDocumentTypes={
    serializedDocumentTypes
  }
/>
        </div>
      </section>
    </main>
  );
}