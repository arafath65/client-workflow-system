"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type PaymentDashboardFiltersProps = {
  from: string;
  to: string;
  status: "ALL" | "CLEARED" | "REFUNDED" | "CANCELLED";
  search: string;
  currentMonthStart: string;
  currentMonthEnd: string;
  lastMonthStart: string;
  lastMonthEnd: string;
  lastTwelveMonthsStart: string;
  lastTwelveMonthsEnd: string;
  selectedRangeLabel: string;
};

export default function PaymentDashboardFilters({
  from,
  to,
  status,
  search,
  currentMonthStart,
  currentMonthEnd,
  lastMonthStart,
  lastMonthEnd,
  lastTwelveMonthsStart,
  lastTwelveMonthsEnd,
  selectedRangeLabel,
}: PaymentDashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(search);

  const replaceQuery = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();

    if (nextQuery === currentQuery) return;

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  useEffect(() => {
    const currentUrlSearch = searchParams.get("search") ?? "";

    if (searchValue === currentUrlSearch) return;

    const timer = window.setTimeout(() => {
      replaceQuery({ search: searchValue.trim() || null });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchValue, searchParams]);

  const isThisMonth =
    from === currentMonthStart && to === currentMonthEnd;

  const isLastMonth =
    from === lastMonthStart && to === lastMonthEnd;

  const isLastTwelveMonths =
    from === lastTwelveMonthsStart && to === lastTwelveMonthsEnd;

  const presetClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[10px] font-medium transition ${
      active
        ? "border-[#f9a800] bg-[#fff4d9] text-black"
        : "border-black/10 bg-white text-black/55 hover:border-[#f9a800]/40 hover:bg-[#fffaf0] hover:text-black"
    }`;

  const selectClass =
    "h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10";

  const applyPreset = (presetFrom: string, presetTo: string) => {
    replaceQuery({
      from: presetFrom,
      to: presetTo,
      status,
    });
  };

  const handleReset = () => {
    replaceQuery({
      from: currentMonthStart,
      to: currentMonthEnd,
      status: "ALL",
      search: null,
    });
    setSearchValue("");
  };

  return (
    <div className="mt-8 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor="payments-from"
            className="mb-1.5 block text-xs font-medium text-black/50"
          >
            From
          </label>
          <input
            id="payments-from"
            type="date"
            value={from}
            onChange={(e) => replaceQuery({ from: e.target.value })}
            className={selectClass}
          />
        </div>

        <div>
          <label
            htmlFor="payments-to"
            className="mb-1.5 block text-xs font-medium text-black/50"
          >
            To
          </label>
          <input
            id="payments-to"
            type="date"
            value={to}
            onChange={(e) => replaceQuery({ to: e.target.value })}
            className={selectClass}
          />
        </div>

        <div className="min-w-44">
          <label
            htmlFor="payments-status"
            className="mb-1.5 block text-xs font-medium text-black/50"
          >
            Payment History
          </label>
          <select
            id="payments-status"
            value={status}
            onChange={(e) =>
              replaceQuery({
                status:
                  e.target.value === "CLEARED"
                    ? "CLEARED"
                    : e.target.value === "REFUNDED"
                      ? "REFUNDED"
                      : e.target.value === "CANCELLED"
                        ? "CANCELLED"
                        : "ALL",
              })
            }
            className={selectClass}
          >
            <option value="ALL">All</option>
            <option value="CLEARED">Cleared</option>
            <option value="REFUNDED">Refunded</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="min-w-56 flex-1">
          <label
            htmlFor="payments-search"
            className="mb-1.5 block text-xs font-medium text-black/50"
          >
            Search
          </label>
          <input
            id="payments-search"
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Client, file number, service or reference..."
            className={selectClass}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-black/30">
          Presets
        </span>

        <button
          type="button"
          onClick={() => applyPreset(currentMonthStart, currentMonthEnd)}
          className={presetClass(isThisMonth)}
        >
          This Month
        </button>

        <button
          type="button"
          onClick={() => applyPreset(lastMonthStart, lastMonthEnd)}
          className={presetClass(isLastMonth)}
        >
          Last Month
        </button>

        <button
          type="button"
          onClick={() =>
            applyPreset(lastTwelveMonthsStart, lastTwelveMonthsEnd)
          }
          className={presetClass(isLastTwelveMonths)}
        >
          Last 12 Months
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[10px] font-semibold text-black/45 transition hover:border-black/20 hover:bg-black hover:text-white"
        >
          Reset
        </button>

        <span className="ml-auto text-[10px] text-black/35">
          Showing {selectedRangeLabel}
        </span>
      </div>
    </div>
  );
}
