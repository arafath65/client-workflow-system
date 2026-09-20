"use client";

import { useState } from "react";

type FileFilter =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type StaffOption = {
  id: number;
  name: string;
  position: string | null;
  status: boolean;
};

type Props = {
  status: FileFilter;
  staff: StaffOption[];
};

export default function StaffWorkPdfButton({
  status,
  staff,
}: Props) {
  const [
    selectedStaffId,
    setSelectedStaffId,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const openPdf = () => {
    if (loading) return;

    setLoading(true);

    const params =
      new URLSearchParams();

    params.set(
      "status",
      status
    );

    if (selectedStaffId) {
      params.set(
        "staffId",
        selectedStaffId
      );
    } else {
      params.set(
        "all",
        "true"
      );
    }

    const url =
      `/api/reports/staff-work?${params.toString()}`;

    const reportWindow =
      window.open(
        url,
        "_blank"
      );

    if (!reportWindow) {
      alert(
        "Please allow pop-ups to open the PDF report."
      );
    }

    window.setTimeout(
      () => setLoading(false),
      800
    );
  };

  return (
    <div className="flex w-full flex-col gap-2 border-t border-black/10 pt-3 sm:w-auto sm:flex-row sm:items-center sm:border-t-0 sm:border-l sm:pl-3 sm:pt-0">
      <select
        aria-label="Select staff for PDF report"
        value={selectedStaffId}
        onChange={(event) =>
          setSelectedStaffId(
            event.target.value
          )
        }
        disabled={loading}
        className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 sm:w-48"
      >
        <option value="">
          All Staff
        </option>

        {staff.map(
          (member) => (
            <option
              key={member.id}
              value={member.id}
            >
              {member.name}
              {member.status
                ? ""
                : " (Inactive)"}
            </option>
          )
        )}
      </select>

      <button
        type="button"
        onClick={openPdf}
        disabled={loading}
        className="h-10 rounded-lg bg-black px-4 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Opening..."
          : "Generate PDF"}
      </button>
    </div>
  );
}