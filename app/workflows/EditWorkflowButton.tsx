
"use client";

import { FormEvent, useState } from "react";

type StaffData = {
  id: number;
  name: string;
  status: boolean;
};

type WorkflowData = {
  id: number;
  name: string;
  description: string | null;
  status: boolean;
  defaultStaffId?: number | null;
  baseAmount: string | number;
};

type Props = {
  workflow: WorkflowData;
};

export default function EditWorkflowButton({
  workflow,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staff, setStaff] = useState<StaffData[]>([]);
  const [defaultStaffId, setDefaultStaffId] = useState(
    workflow.defaultStaffId?.toString() ?? ""
  );

  const [baseAmount, setBaseAmount] = useState(
    String(workflow.baseAmount ?? "0")
  );

  const [staffError, setStaffError] = useState("");

  const handleOpen = async () => {
    setOpen(true);
    setStaffLoading(true);
    setStaffError("");

    try {
      const response = await fetch("/api/staff");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load staff members."
        );
      }

      setStaff(data.staff ?? []);
    } catch (error) {
      console.error("Load staff error:", error);
      setStaffError("Unable to load staff members.");
    } finally {
      setStaffLoading(false);
    }
  };

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (loading) return;

    const formData = new FormData(e.currentTarget);

    const name = String(
      formData.get("name") ?? ""
    ).trim();

    const description = String(
      formData.get("description") ?? ""
    ).trim();

    const cleanBaseAmount = baseAmount.trim();

    if (!name) {
      alert("Workflow name is required.");
      return;
    }

    if (!/^\d+(?:\.\d{1,2})?$/.test(cleanBaseAmount)) {
      alert("Valid service price is required.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/workflows/${workflow.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            description,
            defaultStaffId: defaultStaffId
              ? Number(defaultStaffId)
              : null,
            baseAmount: cleanBaseAmount,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.message || "Unable to update workflow."
        );
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("Update workflow error:", error);

      alert("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs font-medium text-black/40 transition hover:text-black"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-base font-semibold">
                  Edit Workflow
                </h2>

                <p className="mt-1 text-xs text-black/40">
                  Update the workflow details.
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
              {/* Name */}
              <div>
                <label
                  htmlFor={`edit-workflow-name-${workflow.id}`}
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Workflow Name{" "}
                  <span className="text-red-500">*</span>
                </label>

                <input
                  id={`edit-workflow-name-${workflow.id}`}
                  name="name"
                  type="text"
                  defaultValue={workflow.name}
                  required
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor={`edit-workflow-description-${workflow.id}`}
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Description
                </label>

                <textarea
                  id={`edit-workflow-description-${workflow.id}`}
                  name="description"
                  rows={4}
                  defaultValue={workflow.description ?? ""}
                  className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Default Service Price */}
              <div>
                <label
                  htmlFor={`edit-workflow-price-${workflow.id}`}
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Default Service Price (LKR)
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <input
                  id={`edit-workflow-price-${workflow.id}`}
                  name="baseAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                />

                <p className="mt-1.5 text-[11px] text-black/40">
                  This price becomes the starting price for new client files using this service. Existing files keep their saved price.
                </p>
              </div>

              {/* Default Responsible Staff */}
              <div>
                <label
                  htmlFor={`edit-workflow-staff-${workflow.id}`}
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Default Responsible Staff
                </label>

                <select
                  id={`edit-workflow-staff-${workflow.id}`}
                  value={defaultStaffId}
                  onChange={(e) =>
                    setDefaultStaffId(e.target.value)
                  }
                  disabled={staffLoading || !!staffError}
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                >
                  <option value="">
                    Unassigned
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

                {staffLoading && (
                  <p className="mt-1.5 text-xs text-black/40">
                    Loading staff members...
                  </p>
                )}

                {staffError && (
                  <div className="mt-2">
                    <p className="text-xs text-red-500">
                      {staffError}
                    </p>

                    <button
                      type="button"
                      onClick={handleOpen}
                      className="mt-1 text-xs font-medium text-black underline"
                    >
                      Try again
                    </button>
                  </div>
                )}

                <p className="mt-1.5 text-xs text-black/40">
                  This staff member will be the default
                  responsible person for this workflow.
                </p>
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
                  disabled={loading || staffLoading}
                  className="rounded-lg bg-black px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}