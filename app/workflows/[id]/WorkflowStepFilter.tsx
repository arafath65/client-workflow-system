"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function WorkflowStepFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentFilter = searchParams.get("stepStatus") || "active";

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "active") {
      params.delete("stepStatus");
    } else {
      params.set("stepStatus", value);
    }

    const query = params.toString();

    router.push(
      query
        ? `${window.location.pathname}?${query}`
        : window.location.pathname
    );
  };

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="workflow-step-status-filter"
        className="text-xs font-medium text-black/40"
      >
        Show
      </label>

      <select
        id="workflow-step-status-filter"
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