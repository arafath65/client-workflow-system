"use client";

import { FormEvent, useState } from "react";

type Staff = {
  id: number;
  name: string;
};

type Props = {
  workflowId: number;
  staff: Staff[];
};

export default function AddWorkflowStepButton({
  workflowId,
  staff,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (loading) return;

    const formData = new FormData(e.currentTarget);

    const title = String(
      formData.get("title") ?? ""
    ).trim();

    const defaultStaffIdValue = String(
      formData.get("defaultStaffId") ?? ""
    );

    const defaultStaffId = defaultStaffIdValue
      ? Number(defaultStaffIdValue)
      : null;

    if (!title) {
      alert("Step name is required.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/workflows/${workflowId}/steps`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            defaultStaffId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.message ||
            "Unable to create workflow step."
        );
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error(
        "Create workflow step error:",
        error
      );

      alert(
        "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black"
      >
        + Add Step
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-base font-semibold">
                  Add Workflow Step
                </h2>

                <p className="mt-1 text-xs text-black/40">
                  Add a step to this workflow.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-black/40 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-4 px-6 py-6"
            >
              {/* Step Name */}
              <div>
                <label
                  htmlFor="workflow-step-title"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Step Name{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <input
                  id="workflow-step-title"
                  name="title"
                  type="text"
                  placeholder="e.g. Document Collecting"
                  required
                  autoFocus
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Default Staff */}
              <div>
                <label
                  htmlFor="workflow-step-staff"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Default Staff
                </label>

                <select
                  id="workflow-step-staff"
                  name="defaultStaffId"
                  defaultValue=""
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-black/70 outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                >
                  <option value="">
                    Not assigned
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

                {staff.length === 0 && (
                  <p className="mt-1.5 text-[10px] text-black/35">
                    No active staff members available.
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="rounded-lg border border-black/10 px-4 py-2.5 text-xs font-medium text-black/50 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-black px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
                >
                  {loading
                    ? "Saving..."
                    : "Save Step"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}