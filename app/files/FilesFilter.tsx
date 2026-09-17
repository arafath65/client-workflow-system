
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const fileStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
];

export default function FilesFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get("search") || "";
  const initialStatus = searchParams.get("status") || "";

  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (search.trim()) {
        params.set("search", search.trim());
      } else {
        params.delete("search");
      }

      if (status) {
        params.set("status", status);
      } else {
        params.delete("status");
      }

      const query = params.toString();
      const nextUrl = query ? `${pathname}?${query}` : pathname;

      router.replace(nextUrl, { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [search, status, pathname, router, searchParams]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search file or client..."
        className="rounded-lg border border-black/10 px-3 py-2 text-xs outline-none focus:border-[#f9a800]"
      />

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#f9a800]"
      >
        <option value="">All statuses</option>

        {fileStatuses.map((item) => (
          <option key={item} value={item}>
            {item.replaceAll("_", " ")}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => {
          setSearch("");
          setStatus("");
          router.replace(pathname, { scroll: false });
        }}
        className="rounded-lg border border-black/10 px-4 py-2 text-xs font-medium hover:bg-black/[0.03]"
      >
        Reset
      </button>
    </div>
  );
}