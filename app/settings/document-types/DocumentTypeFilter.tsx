"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

export default function DocumentTypeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedStatus =
    searchParams.get("status") || "active";

  const handleChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = event.target.value;

    const params = new URLSearchParams(
      searchParams.toString()
    );

    params.set("status", value);

    router.push(
      `${pathname}?${params.toString()}`
    );
  };

  return (
    <select
      value={selectedStatus}
      onChange={handleChange}
      className="h-10 rounded-lg border border-black/10 bg-white px-3 text-xs outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
    >
      <option value="active">
        Active
      </option>

      <option value="inactive">
        Inactive
      </option>

      <option value="all">
        All
      </option>
    </select>
  );
}