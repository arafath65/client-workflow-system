"use client";

import { useState } from "react";

type AuditLog = {
  id: number;
  createdAt: string;
  module: string;
  action: string;
  entity: string | null;
  entityId: number | null;
  description: string;
  user: {
    username: string;
  };
};

type Filters = {
  from: string;
  to: string;
  module: string;
  action: string;
  search: string;
};

type Props = {
  initialLogs: AuditLog[];
  initialTotal: number;
  initialPage: number;
  pageSize: number;
  filters: Filters;
};

export default function AuditLogsClient({
  initialLogs,
  initialTotal,
  initialPage,
  pageSize,
  filters,
}: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  async function loadPage(page: number) {
    if (loading || page < 1 || page > totalPages || page === currentPage) {
      return;
    }

    setLoading(true);

    try {
      const query = new URLSearchParams();
      query.set("from", filters.from);
      query.set("to", filters.to);
      if (filters.module) query.set("module", filters.module);
      if (filters.action) query.set("action", filters.action);
      if (filters.search) query.set("search", filters.search);
      query.set("page", String(page));
      query.set("pageSize", String(pageSize));

      const response = await fetch(`/api/audit-logs?${query.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load audit logs.");
      }

      const data = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
      setCurrentPage(data.page);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Activity History</h2>
          <p className="mt-1 text-xs text-black/40">
            Newest actions appear first.
          </p>
        </div>

        {total > 0 ? (
          <span className="text-[10px] text-black/35">
            Page {currentPage} of {totalPages}
          </span>
        ) : null}
      </div>

      {logs.length === 0 ? (
        <div className="mt-5 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9]">
          <p className="text-sm text-black/40">
            No audit activity found for the selected filters.
          </p>
        </div>
      ) : (
        <div className="relative mt-5 overflow-x-auto rounded-lg border border-black/10">
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <div className="rounded-md bg-black px-3 py-2 text-[11px] font-semibold text-white">
                Loading...
              </div>
            </div>
          ) : null}

          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-black/10 bg-[#fafaf9]">
                {["Date / Time", "User", "Module", "Action", "Details"].map(
                  (head) => (
                    <th
                      key={head}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40"
                    >
                      {head}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-black/5 last:border-b-0 hover:bg-[#fafaf9]"
                >
                  <td className="px-4 py-3 text-xs text-black/60">
                    {formatDateTime(log.createdAt)}
                  </td>

                  <td className="px-4 py-3 text-xs font-medium">
                    {log.user.username}
                  </td>

                  <td className="px-4 py-3">
                    <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[10px] font-medium text-black/55">
                      {formatLabel(log.module)}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#fff7e6] px-2.5 py-1 text-[10px] font-medium text-[#a56e00]">
                      {formatLabel(log.action)}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-xs font-medium">{log.description}</p>

                    {log.entity ? (
                      <p className="mt-0.5 text-[10px] text-black/35">
                        {formatLabel(log.entity)}
                        {log.entityId ? ` #${log.entityId}` : ""}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-black/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-black/40">
            {startItem}-{endItem} of {total} logs
          </p>

          <div className="flex items-center gap-1.5">
            <PaginationButton
              onClick={() => loadPage(1)}
              disabled={loading || currentPage === 1}
            >
              First
            </PaginationButton>

            <PaginationButton
              onClick={() => loadPage(currentPage - 1)}
              disabled={loading || currentPage === 1}
            >
              Previous
            </PaginationButton>

            <span className="px-2 text-xs text-black/50">
              Page {currentPage} of {totalPages}
            </span>

            <PaginationButton
              onClick={() => loadPage(currentPage + 1)}
              disabled={loading || currentPage === totalPages}
            >
              Next
            </PaginationButton>

            <PaginationButton
              onClick={() => loadPage(totalPages)}
              disabled={loading || currentPage === totalPages}
            >
              Last
            </PaginationButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PaginationButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        disabled
          ? "inline-flex h-8 items-center rounded-md border border-black/10 bg-black/[0.02] px-3 text-[11px] font-medium text-black/25"
          : "inline-flex h-8 items-center rounded-md border border-black bg-black px-3 text-[11px] font-semibold text-white transition hover:border-[#f9a800] hover:bg-[#f9a800] hover:text-black"
      }
    >
      {children}
    </button>
  );
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Colombo",
  }).format(new Date(value));
}
