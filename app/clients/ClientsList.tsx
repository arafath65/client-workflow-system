"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import EditClientButton from "./EditClientButton";
import ClientStatusButton from "./ClientStatusButton";

type ClientStatusFilter =
  | "ACTIVE"
  | "INACTIVE"
  | "ALL";

type ClientRow = {
  id: number;
  name: string;
  whatsapp: string | null;
  status: boolean;
  totalFiles: number;
  inProgressFiles: number;
  totalDue: number;
};

type ClientsListProps = {
  clients: ClientRow[];
};

function formatLkr(amount: number) {
  return `LKR ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ClientsList({
  clients,
}: ClientsListProps) {
  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<ClientStatusFilter>("ACTIVE");

  // --------------------------------------------------
  // Local filtering
  // No page refresh
  // No URL change
  // --------------------------------------------------

  const filteredClients = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return clients.filter((client) => {
      // Status filter
      if (
        statusFilter === "ACTIVE" &&
        !client.status
      ) {
        return false;
      }

      if (
        statusFilter === "INACTIVE" &&
        client.status
      ) {
        return false;
      }

      // Search filter
      if (normalizedSearch) {
        const name =
          client.name.toLowerCase();

        const whatsapp =
          client.whatsapp?.toLowerCase() || "";

        const matches =
          name.includes(normalizedSearch) ||
          whatsapp.includes(normalizedSearch);

        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }, [clients, search, statusFilter]);

  return (
    <>
      {/* Client List Header */}
      <div className="flex flex-col gap-4 border-b border-black/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left */}
        <div>
          <h2 className="text-sm font-semibold">
            Client List
          </h2>

          <p className="mt-1 text-xs text-black/40">
            Search and manage client records.
          </p>
        </div>

        {/* Right */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name or WhatsApp..."
              className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 pr-9 text-xs outline-none transition placeholder:text-black/30 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              aria-label="Search clients"
            />

            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-sm text-black/30 transition hover:bg-black/5 hover:text-black"
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target
                  .value as ClientStatusFilter
              )
            }
            className="h-10 rounded-lg border border-black/10 bg-white px-3 text-xs font-medium outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
            aria-label="Filter clients by status"
          >
            <option value="ACTIVE">
              Active
            </option>

            <option value="INACTIVE">
              Inactive
            </option>

            <option value="ALL">
              All
            </option>
          </select>
        </div>
      </div>

      {/* Result Summary */}
      <div className="flex min-h-10 items-center gap-2">
        <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[10px] font-medium text-black/50">
          Showing:{" "}
          {statusFilter === "ACTIVE"
            ? "Active"
            : statusFilter === "INACTIVE"
              ? "Inactive"
              : "All"}
        </span>

        {search.trim() ? (
          <span className="rounded-full bg-[#f9a800]/10 px-2.5 py-1 text-[10px] font-medium text-[#9b6800]">
            Search: &quot;{search.trim()}&quot;
          </span>
        ) : null}

        <span className="text-[10px] text-black/30">
          {filteredClients.length} client
          {filteredClients.length === 1
            ? ""
            : "s"}
        </span>
      </div>

      {/* Empty State */}
      {filteredClients.length === 0 ? (
        <div className="mt-2 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9]">
          <div className="text-center">
            <p className="text-sm font-medium text-black/50">
              No clients found
            </p>

            <p className="mt-1 text-xs text-black/30">
              Try changing your search or status
              filter.
            </p>
          </div>
        </div>
      ) : (
        /* Client Table */
        <div className="mt-2 overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-black/10 bg-[#fafaf9]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Client
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  WhatsApp
                </th>

                <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Total Files
                </th>

                <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  In Progress
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Total Due
                </th>

                <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Status
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredClients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-black/5 last:border-b-0 hover:bg-[#fafaf9]"
                >
                  {/* Client */}
                  <td className="px-4 py-4">
                    <Link
                      href={`/clients/${client.id}`}
                      className="text-xs font-semibold transition hover:text-[#d99000]"
                    >
                      {client.name}
                    </Link>

                    <p className="mt-0.5 text-[10px] text-black/35">
                      Client #{client.id}
                    </p>
                  </td>

                  {/* WhatsApp */}
                  <td className="px-4 py-4 text-xs text-black/55">
                    {client.whatsapp || "—"}
                  </td>

                  {/* Total Files */}
                  <td className="px-4 py-4 text-center">
                    <span className="text-xs font-semibold">
                      {client.totalFiles}
                    </span>
                  </td>

                  {/* In Progress */}
                  <td className="px-4 py-4 text-center">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        client.inProgressFiles > 0
                          ? "bg-blue-100 text-blue-700"
                          : "bg-black/[0.04] text-black/40"
                      }`}
                    >
                      {client.inProgressFiles}
                    </span>
                  </td>

                  {/* Total Due */}
                  <td className="px-4 py-4 text-right">
                    <span
                      className={`text-xs font-semibold ${
                        client.totalDue > 0
                          ? "text-black"
                          : "text-black/35"
                      }`}
                    >
                      {formatLkr(
                        client.totalDue
                      )}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4 text-center">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        client.status
                          ? "bg-green-100 text-green-700"
                          : "bg-black/5 text-black/40"
                      }`}
                    >
                      {client.status
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-xs font-medium text-black/50 transition hover:text-black"
                      >
                        View
                      </Link>

                      <EditClientButton
                        id={client.id}
                        name={client.name}
                        whatsapp={client.whatsapp}
                      />

                      <ClientStatusButton
                        id={client.id}
                        name={client.name}
                        status={client.status}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}