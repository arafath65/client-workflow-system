import Link from "next/link";
import Navigation from "../components/Navigation";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AddClientButton from "./AddClientButton";
import EditClientButton from "./EditClientButton";
import ClientFilter from "./ClientFilter";

type ClientsPageProps = {
  searchParams: Promise<{
    search?: string;
  }>;
};

export default async function ClientsPage({
  searchParams,
}: ClientsPageProps) {
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
  // Search
  // --------------------------------------------------
  const params = await searchParams;
  const search = params.search?.trim() || "";

  const clients = await prisma.client.findMany({
    where: search
      ? {
          OR: [
            {
              name: {
                contains: search,
              },
            },
            {
              whatsapp: {
                contains: search,
              },
            },
          ],
        }
      : undefined,
    orderBy: {
      name: "asc",
    },
  });

  const totalClients = await prisma.client.count();

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

            <form action="/api/auth/logout" method="POST">
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
        {/* Heading */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
              Clients
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Clients
            </h1>

            <p className="mt-2 text-sm text-black/50">
              Manage your registered clients and their contact
              information.
            </p>
          </div>

          <AddClientButton />
        </div>

        {/* Summary */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-xs font-medium text-black/45">
              Total Clients
            </p>

            <p className="mt-3 text-2xl font-semibold">
              {totalClients}
            </p>

            <p className="mt-1 text-xs text-black/35">
              Registered clients
            </p>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-xs font-medium text-black/45">
              Search Results
            </p>

            <p className="mt-3 text-2xl font-semibold">
              {clients.length}
            </p>

            <p className="mt-1 text-xs text-black/35">
              Clients matching current search
            </p>
          </div>
        </div>

        {/* Client List */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Client List
              </h2>

              <p className="mt-1 text-xs text-black/40">
                Search and manage client records.
              </p>
            </div>

            <ClientFilter />
          </div>

          {clients.length === 0 ? (
            <div className="mt-6 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9]">
              <div className="text-center">
                <p className="text-sm font-medium text-black/50">
                  No clients found
                </p>

                <p className="mt-1 text-xs text-black/30">
                  Add a client or change your search.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-lg border border-black/10">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b border-black/10 bg-[#fafaf9] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Client
                </p>

                <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  WhatsApp
                </p>

                <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Action
                </p>
              </div>

              {clients.map((client) => (
                <div
                  key={client.id}
                  className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 border-b border-black/5 px-4 py-4 last:border-b-0 hover:bg-[#fafaf9]"
                >
                  <div>
                    <Link
  href={`/clients/${client.id}`}
  className="text-xs font-semibold hover:text-[#d99000]"
>
  {client.name}
</Link>

                    <p className="mt-0.5 text-[10px] text-black/35">
                      Client #{client.id}
                    </p>
                  </div>

                  <p className="text-xs text-black/55">
                    {client.whatsapp || "—"}
                  </p>

                  <EditClientButton
                    id={client.id}
                    name={client.name}
                    whatsapp={client.whatsapp}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}