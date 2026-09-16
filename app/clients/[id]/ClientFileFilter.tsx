"use client";

import { useRouter, useSearchParams } from "next/navigation";

type ClientFileFilterProps = {
  currentStatus: string;
};

export default function ClientFileFilter({
  currentStatus,
}: ClientFileFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const status = event.target.value;

    const params = new URLSearchParams(
      searchParams.toString()
    );

    params.set("fileStatus", status);

    router.push(`?${params.toString()}`);
  };

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      aria-label="Filter client files by status"
      className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black outline-none transition hover:border-[#f9a800] focus:border-[#f9a800] focus:ring-1 focus:ring-[#f9a800]/20"
    >
      <option value="IN_PROGRESS">
        In Progress
      </option>

      <option value="COMPLETED">
        Completed
      </option>

      <option value="CANCELLED">
        Cancelled
      </option>
    </select>
  );
}