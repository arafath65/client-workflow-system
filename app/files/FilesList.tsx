"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import FileActions from "./FileActions";

type FileStatusFilter =
  | "ALL"
  | "OPEN"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

type FileRow = {
  id: number;
  fileNumber: string;
  title: string;
  status: string;

  client: {
    id: number;
    name: string;
    whatsapp: string | null;
  };

  totalTasks: number;
  completedTasks: number;
  assignedNames: string[];

  nextEvent: {
    title: string;
    startAt: string;
  } | null;

  updatedAt: string | null;
};

type FilesListProps = {
  files: FileRow[];
};

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function statusClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-700";

    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-700";

    case "ON_HOLD":
      return "bg-amber-100 text-amber-700";

    case "CANCELLED":
      return "bg-red-100 text-red-700";

    case "OPEN":
      return "bg-sky-100 text-sky-700";

    default:
      return "bg-black/5 text-black/50";
  }
}

function formatEventDate(
  value: string
) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function FilesList({
  files,
}: FilesListProps) {
  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<FileStatusFilter>("ALL");

  // --------------------------------------------------
  // Local filtering
  // --------------------------------------------------

  const filteredFiles = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return files.filter((file) => {
      // Status
      if (
        statusFilter !== "ALL" &&
        file.status !== statusFilter
      ) {
        return false;
      }

      // Search
      if (query) {
        const fileNumber =
          file.fileNumber.toLowerCase();

        const title =
          file.title.toLowerCase();

        const clientName =
          file.client.name.toLowerCase();

        const whatsapp =
          file.client.whatsapp
            ?.toLowerCase() || "";

        const matches =
          fileNumber.includes(query) ||
          title.includes(query) ||
          clientName.includes(query) ||
          whatsapp.includes(query);

        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }, [files, search, statusFilter]);

  return (
    <>
      {/* Section Header */}
      <div className="flex flex-col gap-4 border-b border-black/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left */}
        <div>
          <h2 className="text-sm font-semibold">
            All Client Files
          </h2>

          <p className="mt-1 text-xs text-black/40">
            Search and filter files from
            every client.
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
              placeholder="Search file or client..."
              className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 pr-9 text-xs outline-none transition placeholder:text-black/30 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              aria-label="Search files"
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
                  .value as FileStatusFilter
              )
            }
            className="h-10 rounded-lg border border-black/10 bg-white px-3 text-xs font-medium outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
            aria-label="Filter files by status"
          >
            <option value="ALL">
              All statuses
            </option>

            <option value="OPEN">
              Open
            </option>

            <option value="IN_PROGRESS">
              In Progress
            </option>

            <option value="ON_HOLD">
              On Hold
            </option>

            <option value="COMPLETED">
              Completed
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>
      </div>

      {/* Result Summary */}
      <div className="flex min-h-10 items-center gap-2">
        <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[10px] font-medium text-black/50">
          Showing:{" "}
          {statusFilter === "ALL"
            ? "All"
            : formatStatus(statusFilter)}
        </span>

        {search.trim() ? (
          <span className="rounded-full bg-[#f9a800]/10 px-2.5 py-1 text-[10px] font-medium text-[#9b6800]">
            Search: &quot;
            {search.trim()}
            &quot;
          </span>
        ) : null}

        <span className="text-[10px] text-black/30">
          {filteredFiles.length} file
          {filteredFiles.length === 1
            ? ""
            : "s"}
        </span>
      </div>

      {/* Empty */}
      {filteredFiles.length === 0 ? (
        <div className="mt-2 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9]">
          <div className="text-center">
            <p className="text-sm font-medium text-black/50">
              No files found
            </p>

            <p className="mt-1 text-xs text-black/30">
              Try changing your search or
              status filter.
            </p>
          </div>
        </div>
      ) : (
        /* Table */
        <div className="mt-2 overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="bg-[#fafaf9]">
              <tr className="border-b border-black/10">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  File
                </th>

                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Client
                </th>

                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Status
                </th>

                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Workflow
                </th>

                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Assigned Staff
                </th>

                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Next Calendar Event
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredFiles.map((file) => {
                const progress =
                  file.totalTasks > 0
                    ? Math.round(
                        (file.completedTasks /
                          file.totalTasks) *
                          100
                      )
                    : 0;

                return (
                  <tr
                    key={file.id}
                    className="border-b border-black/5 last:border-b-0 hover:bg-[#fafaf9]"
                  >
                    {/* File */}
                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold">
                        {file.fileNumber}
                      </p>

                      <p className="mt-1 max-w-48 truncate text-xs text-black/50">
                        {file.title}
                      </p>

                      {file.updatedAt ? (
                        <p className="mt-1 text-[10px] text-black/30">
                          Updated{" "}
                          {file.updatedAt}
                        </p>
                      ) : null}
                    </td>

                    {/* Client */}
                    <td className="px-4 py-4">
                      <Link
                        href={`/clients/${file.client.id}`}
                        className="text-xs font-medium transition hover:text-[#d99000]"
                      >
                        {file.client.name}
                      </Link>

                      {file.client.whatsapp ? (
                        <p className="mt-1 text-[10px] text-black/35">
                          {file.client.whatsapp}
                        </p>
                      ) : null}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClass(
                          file.status
                        )}`}
                      >
                        {formatStatus(
                          file.status
                        )}
                      </span>
                    </td>

                    {/* Workflow */}
                    <td className="px-4 py-4">
                      <p className="text-xs font-medium">
                        {file.completedTasks} /{" "}
                        {file.totalTasks} tasks
                      </p>

                      <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-black/10">
                        <div
                          className="h-full rounded-full bg-[#f9a800]"
                          style={{
                            width: `${progress}%`,
                          }}
                        />
                      </div>

                      <p className="mt-1 text-[10px] text-black/40">
                        {progress}% complete
                      </p>
                    </td>

                    {/* Assigned Staff */}
                    <td className="px-4 py-4">
                      {file.assignedNames.length >
                      0 ? (
                        <p className="max-w-40 text-xs text-black/60">
                          {file.assignedNames.join(
                            ", "
                          )}
                        </p>
                      ) : (
                        <span className="text-xs text-black/35">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Calendar */}
                    <td className="px-4 py-4">
                      {file.nextEvent ? (
                        <>
                          <p className="max-w-44 truncate text-xs font-medium">
                            {
                              file.nextEvent
                                .title
                            }
                          </p>

                          <p className="mt-1 text-[10px] text-black/45">
                            {formatEventDate(
                              file.nextEvent
                                .startAt
                            )}
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-black/35">
                          No scheduled event
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <FileActions
                          fileId={file.id}
                          fileNumber={
                            file.fileNumber
                          }
                          clientName={
                            file.client.name
                          }
                          title={file.title}
                          canCancel={
                            file.status !==
                              "CANCELLED" &&
                            file.status !==
                              "COMPLETED"
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}