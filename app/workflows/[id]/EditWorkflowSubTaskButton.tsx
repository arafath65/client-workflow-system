"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type EditWorkflowSubTaskButtonProps = {
  subTaskId: number;
  initialTitle: string;
  initialDescription: string | null;
  initialDefaultStaffId: number | null;
};

type Staff = {
  id: number;
  name: string;
  position?: string | null;
  status?: boolean;
};

export default function EditWorkflowSubTaskButton({
  subTaskId,
  initialTitle,
  initialDescription,
  initialDefaultStaffId,
}: EditWorkflowSubTaskButtonProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(
    initialDescription || ""
  );
  const [defaultStaffId, setDefaultStaffId] = useState(
    initialDefaultStaffId
      ? String(initialDefaultStaffId)
      : ""
  );

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const loadStaff = async () => {
      try {
        setLoadingStaff(true);

        const response = await fetch("/api/staff");
        const data = await response.json();

        if (!response.ok) {
          setError(
            data?.message || "Unable to load staff."
          );
          return;
        }

        setStaff(
          Array.isArray(data?.staff)
            ? data.staff.filter(
                (member: Staff) =>
                  member.status !== false
              )
            : []
        );
      } catch (error) {
        console.error(
          "Load staff error:",
          error
        );

        setError("Unable to load staff.");
      } finally {
        setLoadingStaff(false);
      }
    };

    loadStaff();
  }, [open]);

  const handleOpen = () => {
    setTitle(initialTitle);
    setDescription(initialDescription || "");
    setDefaultStaffId(
      initialDefaultStaffId
        ? String(initialDefaultStaffId)
        : ""
    );
    setError("");
    setOpen(true);
  };

  const handleClose = () => {
    if (saving) return;

    setOpen(false);
    setError("");
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setError("Sub task name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `/api/workflows/subtasks/${subTaskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: cleanTitle,
            description:
              description.trim() || null,
            defaultStaffId:
              defaultStaffId
                ? Number(defaultStaffId)
                : null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.message ||
            "Unable to update sub task."
        );
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      console.error(
        "Update sub task error:",
        error
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs font-medium text-black/45 transition hover:text-black"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-black">
                  Edit Sub Task
                </h2>

                <p className="mt-1 text-xs text-black/45">
                  Update sub-task details and default staff.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-black/30 transition hover:bg-black/5 hover:text-black disabled:opacity-40"
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-5 px-6 py-6">
                {/* Sub Task Name */}
                <div>
                  <label
                    htmlFor={`edit-subtask-title-${subTaskId}`}
                    className="mb-2 block text-xs font-medium text-black/60"
                  >
                    Sub Task Name
                  </label>

                  <input
                    id={`edit-subtask-title-${subTaskId}`}
                    type="text"
                    value={title}
                    onChange={(e) =>
                      setTitle(e.target.value)
                    }
                    disabled={saving}
                    className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:bg-black/[0.02]"
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor={`edit-subtask-description-${subTaskId}`}
                    className="mb-2 block text-xs font-medium text-black/60"
                  >
                    Description
                    <span className="ml-1 text-black/30">
                      (Optional)
                    </span>
                  </label>

                  <textarea
                    id={`edit-subtask-description-${subTaskId}`}
                    value={description}
                    onChange={(e) =>
                      setDescription(
                        e.target.value
                      )
                    }
                    rows={3}
                    disabled={saving}
                    className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:bg-black/[0.02]"
                  />
                </div>

                {/* Default Staff */}
                <div>
                  <label
                    htmlFor={`edit-subtask-staff-${subTaskId}`}
                    className="mb-2 block text-xs font-medium text-black/60"
                  >
                    Default Staff
                    <span className="ml-1 text-black/30">
                      (Optional)
                    </span>
                  </label>

                  <select
                    id={`edit-subtask-staff-${subTaskId}`}
                    value={defaultStaffId}
                    onChange={(e) =>
                      setDefaultStaffId(
                        e.target.value
                      )
                    }
                    disabled={
                      saving || loadingStaff
                    }
                    className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:bg-black/[0.02]"
                  >
                    <option value="">
                      No default staff
                    </option>

                    {staff.map((member) => (
                      <option
                        key={member.id}
                        value={member.id}
                      >
                        {member.name}
                        {member.position
                          ? ` — ${member.position}`
                          : ""}
                      </option>
                    ))}
                  </select>

                  <p className="mt-2 text-[10px] text-black/40">
                    This is the template-level fallback
                    staff for this sub-task.
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t border-black/10 px-6 py-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-black/50 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#f9a800] px-5 py-2 text-xs font-semibold text-black transition hover:bg-[#e99b00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}