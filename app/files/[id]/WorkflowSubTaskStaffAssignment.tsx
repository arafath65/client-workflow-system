
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
  status: string;
};

export default function WorkflowSubTaskStaffAssignment({
  subTaskId,
  assignedStaffId,
  inheritedStaffName,
  status,
}: WorkflowSubTaskStaffAssignmentProps) {
  const router = useRouter();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState(
    assignedStaffId?.toString() ?? ""
  );
  const [completed, setCompleted] = useState(
    status === "COMPLETED"
  );
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [savingStaff, setSavingStaff] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState("");

  // Keep checkbox state synchronized with server updates.
  useEffect(() => {
    setCompleted(status === "COMPLETED");
  }, [status]);

  // Synchronize staff selection when server data refreshes.
  useEffect(() => {
    setSelectedStaffId(
      assignedStaffId?.toString() ?? ""
    );
  }, [assignedStaffId]);

  // Load available staff.
  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      try {
        const response = await fetch("/api/staff");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load staff."
          );
        }

        const staffList = Array.isArray(data)
          ? data
          : data.staff ?? [];

        if (!cancelled) {
          setStaff(staffList);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load staff."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingStaff(false);
        }
      }
    }

    loadStaff();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStaffChange(value: string) {
    const previousStaffId = selectedStaffId;

    setSelectedStaffId(value);
    setSavingStaff(true);
    setError("");

    try {
      const response = await fetch(
        `/api/files/subtasks/${subTaskId}/staff`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignedStaffId: value
              ? Number(value)
              : null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to update subtask staff."
        );
      }

      router.refresh();
    } catch (err) {
      setSelectedStaffId(previousStaffId);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update subtask staff."
      );
    } finally {
      setSavingStaff(false);
    }
  }

  async function handleStatusChange() {
    if (savingStatus) return;

    const nextCompleted = !completed;

    setSavingStatus(true);
    setError("");

    try {
      const response = await fetch(
        `/api/files/subtasks/${subTaskId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            completed: nextCompleted,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to update subtask status."
        );
      }

      // Update immediately; server refresh will confirm it.
      setCompleted(nextCompleted);

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update subtask status."
      );
    } finally {
      setSavingStatus(false);
    }
  }

  const selectedStaff = staff.find(
    (item) => item.id.toString() === selectedStaffId
  );

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {/* Subtask completion checkbox */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={completed}
            disabled={savingStatus}
            onChange={handleStatusChange}
            className="h-4 w-4 cursor-pointer"
          />

          <span
            className={
              completed
                ? "text-green-700 line-through"
                : "text-gray-700"
            }
          >
            {savingStatus
              ? "Updating..."
              : completed
                ? "Completed"
                : "Mark completed"}
          </span>
        </label>

        {/* Staff assignment */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">
            {selectedStaffId
              ? "Subtask Override"
              : `Inherited: ${
                  inheritedStaffName || "Unassigned"
                }`}
          </span>

          <select
            value={selectedStaffId}
            disabled={loadingStaff || savingStaff}
            onChange={(event) =>
              handleStaffChange(event.target.value)
            }
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
          >
            <option value="">
              Inherit — {inheritedStaffName || "Step Staff"}
            </option>

            {staff.map((person) => (
              <option
                key={person.id}
                value={person.id.toString()}
              >
                {person.name}
              </option>
            ))}
          </select>

          {savingStaff && (
            <span className="text-xs text-gray-500">
              Saving...
            </span>
          )}
        </div>
      </div>

      {/* Selected staff */}
      {selectedStaffId && selectedStaff && (
        <p className="text-xs text-gray-500">
          Assigned to: {selectedStaff.name}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}