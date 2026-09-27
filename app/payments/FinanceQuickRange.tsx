"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type PresetName = "thisMonth" | "lastMonth" | "lastTwelveMonths";

type FinanceQuickRangeProps = {
  currentMonthStart: string;
  currentMonthEnd: string;
  lastMonthStart: string;
  lastMonthEnd: string;
  lastTwelveMonthsStart: string;
  lastTwelveMonthsEnd: string;
};

export default function FinanceQuickRange({
  currentMonthStart,
  currentMonthEnd,
  lastMonthStart,
  lastMonthEnd,
  lastTwelveMonthsStart,
  lastTwelveMonthsEnd,
}: FinanceQuickRangeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restoreScrollY = useRef<number | null>(null);

  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";

  const ranges = useMemo(
    () => ({
      thisMonth: [currentMonthStart, currentMonthEnd] as const,
      lastMonth: [lastMonthStart, lastMonthEnd] as const,
      lastTwelveMonths: [
        lastTwelveMonthsStart,
        lastTwelveMonthsEnd,
      ] as const,
    }),
    [
      currentMonthStart,
      currentMonthEnd,
      lastMonthStart,
      lastMonthEnd,
      lastTwelveMonthsStart,
      lastTwelveMonthsEnd,
    ]
  );

  const activePreset: PresetName | null =
    currentFrom === ranges.thisMonth[0] && currentTo === ranges.thisMonth[1]
      ? "thisMonth"
      : currentFrom === ranges.lastMonth[0] &&
          currentTo === ranges.lastMonth[1]
        ? "lastMonth"
        : currentFrom === ranges.lastTwelveMonths[0] &&
            currentTo === ranges.lastTwelveMonths[1]
          ? "lastTwelveMonths"
          : null;

  useEffect(() => {
    if (restoreScrollY.current === null) return;

    const targetY = restoreScrollY.current;
    restoreScrollY.current = null;

    const restore = () => {
      window.scrollTo({
        top: targetY,
        left: 0,
        behavior: "auto",
      });
    };

    const frame1 = window.requestAnimationFrame(restore);
    const frame2 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(restore);
    });
    const timer = window.setTimeout(restore, 180);

    return () => {
      window.cancelAnimationFrame(frame1);
      window.cancelAnimationFrame(frame2);
      window.clearTimeout(timer);
    };
  }, [currentFrom, currentTo]);

  const applyPreset = (preset: PresetName) => {
    const [from, to] = ranges[preset];
    const params = new URLSearchParams(searchParams.toString());

    params.set("from", from);
    params.set("to", to);

    restoreScrollY.current = window.scrollY;

    const nextUrl = `${pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
    router.refresh();
  };

  const buttonClass = (preset: PresetName) => {
    const active = activePreset === preset;

    return `rounded-full border px-3.5 py-1.5 text-[10px] font-semibold transition-all duration-150 ${
      active
        ? "border-[#f9a800] bg-[#f9a800] text-black shadow-[0_3px_10px_rgba(249,168,0,0.24)]"
        : "border-black/10 bg-white text-black/55 hover:border-[#f9a800]/60 hover:bg-[#fff8e8] hover:text-black"
    }`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/30">
        Quick range
      </span>

      <button
        type="button"
        onClick={() => applyPreset("thisMonth")}
        className={buttonClass("thisMonth")}
      >
        This month
      </button>

      <button
        type="button"
        onClick={() => applyPreset("lastMonth")}
        className={buttonClass("lastMonth")}
      >
        Last month
      </button>

      <button
        type="button"
        onClick={() => applyPreset("lastTwelveMonths")}
        className={buttonClass("lastTwelveMonths")}
      >
        Last 12 months
      </button>
    </div>
  );
}
