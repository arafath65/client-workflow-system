
"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type Staff = {
  id: number;
  name: string;
  status?: boolean;
};

export default function AddWorkflowButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");

  const [defaultStaffId, setDefaultStaffId] = useState("");

  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // --------------------------------------------------
  // Load active staff when modal opens
  // --------------------------------------------------

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadStaff = async () => {
      setStaffLoading(true);
      setStaffError("");

      try {
        const response = await fetch("/api/staff");

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load staff."
          );
        }

        const staffList: Staff[] = Array.isArray(data.staff)
          ? data.staff
          : [];

        if (!cancelled) {
          setStaff(
            staffList.filter(
              (member) => member.status !== false
            )
          );
        }
      } catch (error) {
        console.error("Load staff error:", error);

        if (!cancelled) {
          setStaffError(
            "Unable to load staff members."
          );
        }
      } finally {
        if (!cancelled) {
          setStaffLoading(false);
        }
      }
    };

    loadStaff();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // --------------------------------------------------
  // Reset Form
  // --------------------------------------------------

  const resetForm = () => {
    if (nameRef.current) {
      nameRef.current.value = "";
    }

    if (descriptionRef.current) {
      descriptionRef.current.value = "";
    }

    setDefaultStaffId("");
    setStaffError("");
  };

  // --------------------------------------------------
  // Close Modal
  // --------------------------------------------------

  const handleClose = () => {
    if (loading) return;

    resetForm();
    setOpen(false);
  };

  // --------------------------------------------------
  // Submit
  // --------------------------------------------------

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (loading) return;

    const name =
      nameRef.current?.value.trim() || "";

    const description =
      descriptionRef.current?.value.trim() || "";

    if (!name) {
      alert("Workflow name is required.");
      nameRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          defaultStaffId: defaultStaffId
            ? Number(defaultStaffId)
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.message ||
            "Unable to create workflow."
        );
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error(
        "Create workflow error:",
        error
      );

      alert("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black"
      >
        + Add Workflow
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}

            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-base font-semibold">
                  Add Workflow
                </h2>

                <p className="mt-1 text-xs text-black/40">
                  Create a workflow for a service or process.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
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
              {/* Workflow Name */}

              <div>
                <label
                  htmlFor="workflow-name"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Workflow Name{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <input
                  ref={nameRef}
                  id="workflow-name"
                  name="name"
                  type="text"
                  placeholder="e.g. Saudi Visa"
                  required
                  autoFocus
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Description */}

              <div>
                <label
                  htmlFor="workflow-description"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Description
                </label>

                <textarea
                  ref={descriptionRef}
                  id="workflow-description"
                  name="description"
                  rows={4}
                  placeholder="Brief description of this workflow..."
                  className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Default Responsible Staff */}

              <div>
                <label
                  htmlFor="workflow-default-staff"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Default Responsible Staff
                </label>

                <select
                  id="workflow-default-staff"
                  name="defaultStaffId"
                  value={defaultStaffId}
                  onChange={(e) =>
                    setDefaultStaffId(e.target.value)
                  }
                  disabled={staffLoading || loading}
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                >
                  <option value="">
                    {staffLoading
                      ? "Loading staff..."
                      : "Unassigned"}
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

                {staffError && (
                  <p className="mt-1.5 text-xs text-red-500">
                    {staffError}
                  </p>
                )}

                <p className="mt-1.5 text-[11px] text-black/40">
                  Used as the default responsible staff
                  member for this workflow.
                </p>
              </div>

              {/* Buttons */}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="rounded-lg border border-black/10 px-4 py-2.5 text-xs font-medium text-black/50 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading || staffLoading}
                  className="rounded-lg bg-black px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
                >
                  {loading
                    ? "Saving..."
                    : "Save Workflow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}