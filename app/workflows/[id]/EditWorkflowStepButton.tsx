"use client";

import { useState } from "react";

type Staff = {
  id: number;
  name: string;
};

type WorkflowStep = {
  id: number;
  title: string;
  defaultStaffId: number | null;
};

type EditWorkflowStepButtonProps = {
  step: WorkflowStep;
  staff: Staff[];
};

export default function EditWorkflowStepButton({
  step,
  staff,
}: EditWorkflowStepButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(step.title);
  const [defaultStaffId, setDefaultStaffId] = useState(
    step.defaultStaffId ? String(step.defaultStaffId) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleOpen = () => {
    setTitle(step.title);
    setDefaultStaffId(
      step.defaultStaffId ? String(step.defaultStaffId) : ""
    );
    setError("");
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setError("Step name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `/api/workflows/steps/${step.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: cleanTitle,
            defaultStaffId: defaultStaffId
              ? Number(defaultStaffId)
              : null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.message || "Unable to update workflow step."
        );
        return;
      }

      setOpen(false);
      window.location.reload();
    } catch (error) {
      console.error("Edit workflow step error:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs font-medium text-black/40 transition hover:text-[#f9a800]"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="border-b border-black/10 px-6 py-5">
              <h2 className="text-lg font-semibold text-black">
                Edit Workflow Step
              </h2>

              <p className="mt-1 text-xs text-black/45">
                Update the step details and default staff.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-5 px-6 py-6">
                {/* Step Name */}
                <div>
                  <label
                    htmlFor={`step-title-${step.id}`}
                    className="mb-2 block text-xs font-medium text-black/60"
                  >
                    Step Name
                  </label>

                  <input
                    id={`step-title-${step.id}`}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                    autoFocus
                  />
                </div>

                {/* Default Staff */}
                <div>
                  <label
                    htmlFor={`step-staff-${step.id}`}
                    className="mb-2 block text-xs font-medium text-black/60"
                  >
                    Default Staff
                  </label>

                  <select
                    id={`step-staff-${step.id}`}
                    value={defaultStaffId}
                    onChange={(e) =>
                      setDefaultStaffId(e.target.value)
                    }
                    className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                  >
                    <option value="">
                      No staff assigned
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
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-black/10 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
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
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}