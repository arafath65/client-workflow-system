"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function StaffFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentFilter = searchParams.get("status") || "active";

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "active") {
      params.delete("status");
    } else {
      params.set("status", value);
    }

    const query = params.toString();

    router.push(query ? `/staff?${query}` : "/staff");
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <label
        htmlFor="staff-status-filter"
        className="text-xs font-medium text-black/40"
      >
        Show
      </label>

      <select
        id="staff-status-filter"
        value={currentFilter}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 rounded-lg border border-black/10 bg-white px-3 text-xs font-medium text-black/70 outline-none transition hover:border-black/20 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="all">All</option>
      </select>
    </div>
  );
}