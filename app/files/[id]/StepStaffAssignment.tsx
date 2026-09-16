"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Staff = {
  id: number;
  name: string;
};

type StepStaffAssignmentProps = {
  taskId: number;
  assignedStaffId: number | null;
  inheritedStaffName: string;
};

export default function StepStaffAssignment({
  taskId,
  assignedStaffId,
  inheritedStaffName,
}: StepStaffAssignmentProps) {
  const router = useRouter();

  const [staff, setStaff] = useState<Staff[]>([]);

  const [selectedStaffId, setSelectedStaffId] =
    useState(
      assignedStaffId
        ? String(assignedStaffId)
        : ""
    );

  const [loadingStaff, setLoadingStaff] =
    useState(true);

  const [saving, setSaving] = useState(false);

  // --------------------------------------------------
  // Load Active Staff
  // --------------------------------------------------

  useEffect(() => {
    const loadStaff = async () => {
      try {
        setLoadingStaff(true);

        const response = await fetch(
          "/api/staff",
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Unable to load staff."
          );
        }

        setStaff(
          Array.isArray(data?.staff)
            ? data.staff
            : []
        );
      } catch (error) {
        console.error(
          "Load staff error:",
          error
        );

        alert(
          "Unable to load staff members."
        );
      } finally {
        setLoadingStaff(false);
      }
    };

    loadStaff();
  }, []);

  // --------------------------------------------------
  // Change Staff Assignment
  // --------------------------------------------------

  const handleChange = async (
    value: string
  ) => {
    if (saving) {
      return;
    }

    const newStaffId =
      value === ""
        ? null
        : Number(value);

    try {
      setSaving(true);

      const response = await fetch(
        `/api/files/tasks/${taskId}/staff`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignedStaffId: newStaffId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data?.message ||
            "Unable to update step staff."
        );

        return;
      }

      setSelectedStaffId(value);

      router.refresh();
    } catch (error) {
      console.error(
        "Update step staff error:",
        error
      );

      alert(
        "Something went wrong while updating staff."
      );
    } finally {
      setSaving(false);
    }
  };

  const hasOverride =
    selectedStaffId !== "";

  return (
    <div className="mt-3">
      {/* Assignment Label */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-black/30">
          Responsible Staff
        </span>

        {!hasOverride && (
          <span className="text-xs font-medium text-black/55">
            {inheritedStaffName}
          </span>
        )}

        {hasOverride && (
          <span className="rounded-full bg-[#f9a800]/15 px-2 py-1 text-[9px] font-semibold text-black">
            Step Override
          </span>
        )}
      </div>

      {/* Staff Select */}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={selectedStaffId}
          onChange={(e) =>
            handleChange(e.target.value)
          }
          disabled={
            loadingStaff || saving
          }
          className="w-full max-w-xs rounded-lg border border-black/10 bg-white px-3 py-2 text-xs outline-none transition focus:border-[#f9a800] disabled:cursor-wait disabled:bg-black/[0.03]"
        >
          <option value="">
            {inheritedStaffName
              ? `Inherit — ${inheritedStaffName}`
              : "Inherit Main Responsible"}
          </option>

          {staff.map((member) => (
            <option
              key={member.id}
              value={member.id}
            >
              {member.name}
            </option>
          ))}
        </select>

        {saving && (
          <span className="text-[10px] text-black/35">
            Saving...
          </span>
        )}
      </div>

      {/* Helper */}
      <p className="mt-1.5 text-[9px] text-black/30">
        Leave as Inherit to use the main
        responsible staff.
      </p>
    </div>
  );
}