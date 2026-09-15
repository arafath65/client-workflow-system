"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AddWorkflowSubTaskButtonProps = {
  workflowStepId: number;
};

export default function AddWorkflowSubTaskButton({
  workflowStepId,
}: AddWorkflowSubTaskButtonProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleOpen = () => {
    setTitle("");
    setDescription("");
    setError("");
    setOpen(true);
  };

  const handleClose = () => {
    if (saving) return;

    setOpen(false);
    setTitle("");
    setDescription("");
    setError("");

    // Refresh the server-rendered workflow step list
    // so newly added sub-tasks are visible.
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
        `/api/workflows/steps/${workflowStepId}/subtasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: cleanTitle,
            description: description.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.message || "Unable to create sub task."
        );
        return;
      }

      // Keep the modal open so another sub-task
      // can be entered immediately.
      setTitle("");
      setDescription("");
      setError("");

      // Refresh the page data while keeping
      // this client-side modal open.
      router.refresh();
    } catch (error) {
      console.error("Create sub task error:", error);

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
        className="mt-3 ml-1 text-xs font-medium text-[#a66f00] transition hover:text-black"
      >
        + Add Sub Task
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-black">
                  Add Sub Task
                </h2>

                <p className="mt-1 text-xs text-black/45">
                  Add multiple sub-tasks one by one.
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
                    htmlFor={`subtask-title-${workflowStepId}`}
                    className="mb-2 block text-xs font-medium text-black/60"
                  >
                    Sub Task Name
                  </label>

                  <input
                    id={`subtask-title-${workflowStepId}`}
                    type="text"
                    value={title}
                    onChange={(e) =>
                      setTitle(e.target.value)
                    }
                    placeholder="e.g. Passport"
                    autoFocus
                    disabled={saving}
                    className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:bg-black/[0.02]"
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor={`subtask-description-${workflowStepId}`}
                    className="mb-2 block text-xs font-medium text-black/60"
                  >
                    Description
                    <span className="ml-1 text-black/30">
                      (Optional)
                    </span>
                  </label>

                  <textarea
                    id={`subtask-description-${workflowStepId}`}
                    value={description}
                    onChange={(e) =>
                      setDescription(e.target.value)
                    }
                    rows={3}
                    placeholder="Optional details..."
                    disabled={saving}
                    className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:bg-black/[0.02]"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between border-t border-black/10 px-6 py-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-black/50 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
                >
                  Done
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#f9a800] px-5 py-2 text-xs font-semibold text-black transition hover:bg-[#e99b00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : "Add Sub Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}