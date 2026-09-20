"use client";

import { ChangeEvent, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import StaffWorkPdfButton from "./StaffWorkPdfButton";

type FileFilter = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type StaffOption = {
  id: number;
  name: string;
  position: string | null;
  status: boolean;
};

type Props = {
  status: FileFilter;
  query: string;
  staff: StaffOption[];
};

export default function StaffWorkFilters({ status, query, staff }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const updateUrl = (nextStatus: FileFilter, nextSearch: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", nextStatus);

    const trimmed = nextSearch.trim();
    if (trimmed) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateUrl(status, event.target.value);
  };

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    updateUrl(
      event.target.value as FileFilter,
      searchRef.current?.value ?? query
    );
  };

  const handleReset = () => {
    if (searchRef.current) {
      searchRef.current.value = "";
    }

    startTransition(() => {
      router.replace(`${pathname}?status=IN_PROGRESS`, { scroll: false });
    });
  };

  return (
    <div className="mt-6 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={status}
            onChange={handleStatusChange}
            aria-label="Filter staff work by file status"
            className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 sm:w-44"
          >
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <input
            ref={searchRef}
            defaultValue={query}
            onChange={handleSearchChange}
            placeholder="Search staff by name..."
            aria-label="Search staff by name"
            className="h-10 flex-1 rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
          />

          {query.trim() || status !== "IN_PROGRESS" ? (
            <button
              type="button"
              onClick={handleReset}
              className="h-10 rounded-lg border border-black/10 px-5 text-xs font-semibold text-black/60 transition hover:border-black/20 hover:bg-black/5 hover:text-black"
            >
              Reset
            </button>
          ) : null}
        </div>

        <StaffWorkPdfButton status={status} staff={staff} />
      </div>
    </div>
  );
}
