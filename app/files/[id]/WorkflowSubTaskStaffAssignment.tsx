"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Staff = {
  id: number;
  name: string;
};

type WorkflowSubTaskStaffAssignmentProps = {
  subTaskId: number;
  assignedStaffId: number | null;
  inheritedStaffName: string;
};

export default function WorkflowSubTaskStaffAssignment({
  subTaskId,
  assignedStaffId,
  inheritedStaffName,
}: WorkflowSubTaskStaffAssignmentProps) {
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
        `/api/files/subtasks/${subTaskId}/staff`,
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
            "Unable to update subtask staff."
        );

        return;
      }

      setSelectedStaffId(value);

      router.refresh();
    } catch (error) {
      console.error(
        "Update subtask staff error:",
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
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-black/25">
          Responsible
        </span>

        {!hasOverride && (
          <span className="text-[10px] font-medium text-black/50">
            {inheritedStaffName}
          </span>
        )}

        {hasOverride && (
          <span className="rounded-full bg-[#f9a800]/15 px-2 py-0.5 text-[8px] font-semibold text-black">
            Subtask Override
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={selectedStaffId}
          onChange={(e) =>
            handleChange(e.target.value)
          }
          disabled={
            loadingStaff || saving
          }
          className="w-full max-w-xs rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[10px] outline-none transition focus:border-[#f9a800] disabled:cursor-wait disabled:bg-black/[0.03]"
        >
          <option value="">
            {inheritedStaffName
              ? `Inherit — ${inheritedStaffName}`
              : "Inherit Step Staff"}
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
          <span className="text-[9px] text-black/30">
            Saving...
          </span>
        )}
      </div>

      <p className="mt-1 text-[8px] text-black/25">
        Leave as Inherit to use this step&apos;s
        responsible staff.
      </p>
    </div>
  );
}