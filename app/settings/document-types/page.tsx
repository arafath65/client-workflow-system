import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

import Navigation from "../../components/Navigation";
import LogoutButton from "../../dashboard/LogoutButton";
import DocumentTypesClient from "./DocumentTypesClient";

export default async function DocumentTypesPage() {
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
  // Load All Document Types + Language Pricing
  // Filtering is handled client-side so changing the
  // filter does not refresh the page.
  // --------------------------------------------------

  const documentTypes = await prisma.documentType.findMany({
    orderBy: {
      name: "asc",
    },

    include: {
      languages: {
        include: {
          language: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: {
          language: {
            name: "asc",
          },
        },
      },
    },
  });

  // --------------------------------------------------
  // Load Languages
  // --------------------------------------------------

  const languages = await prisma.language.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
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
      defaultAmount: Number(
        documentType.defaultAmount
      ),
      status: documentType.status,
      languages: documentType.languages.map((item) => ({
        languageId: item.languageId,
        language: {
          id: item.language.id,
          name: item.language.name,
          status: item.language.status,
        },
        price: Number(item.price),
      })),
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

      <Navigation currentPage="document-types" />

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
            Manage reusable document types, languages,
            and language-specific translation prices for
            document-based workflows.
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
          <DocumentTypesClient
            initialDocumentTypes={serializedDocumentTypes}
            initialLanguages={languages}
          />
        </div>
      </section>
    </main>
  );
}
