"use client";

import { FormEvent, useState } from "react";

type StaffData = {
  id: number;
  name: string;
  status: boolean;
};

type DocumentTypeData = {
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
  trackingMode?: "STANDARD" | "DOCUMENT_BASED";
  documentTypeId?: number | null;
  documentType?: {
    id: number;
    name: string;
  } | null;
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
  const [documentTypesLoading, setDocumentTypesLoading] =
    useState(false);

  const [staff, setStaff] = useState<StaffData[]>([]);
  const [documentTypes, setDocumentTypes] =
    useState<DocumentTypeData[]>([]);

  const [defaultStaffId, setDefaultStaffId] = useState(
    workflow.defaultStaffId?.toString() ?? ""
  );

  const [baseAmount, setBaseAmount] = useState(
    String(workflow.baseAmount ?? "0")
  );

  const [trackingMode, setTrackingMode] = useState<
    "STANDARD" | "DOCUMENT_BASED"
  >(
    workflow.trackingMode === "DOCUMENT_BASED"
      ? "DOCUMENT_BASED"
      : "STANDARD"
  );

  const [documentTypeId, setDocumentTypeId] = useState(
    workflow.documentTypeId?.toString() ??
      workflow.documentType?.id?.toString() ??
      ""
  );

  const [staffError, setStaffError] = useState("");
  const [documentTypeError, setDocumentTypeError] =
    useState("");

  const handleOpen = async () => {
    setOpen(true);
    setStaffLoading(true);
    setDocumentTypesLoading(true);
    setStaffError("");
    setDocumentTypeError("");

    try {
      const [staffResponse, documentTypeResponse] =
        await Promise.all([
          fetch("/api/staff", {
            cache: "no-store",
          }),
          fetch("/api/document-types", {
            cache: "no-store",
          }),
        ]);

      const staffData = await staffResponse.json();
      const documentTypeData =
        await documentTypeResponse.json();

      if (!staffResponse.ok || !staffData.success) {
        throw new Error(
          staffData.message ||
            "Unable to load staff members."
        );
      }

      if (
        !documentTypeResponse.ok ||
        !documentTypeData.success
      ) {
        throw new Error(
          documentTypeData.message ||
            "Unable to load document types."
        );
      }

      setStaff(
        (staffData.staff ?? []).filter(
          (member: StaffData) =>
            member.status !== false
        )
      );

      setDocumentTypes(
        (documentTypeData.documentTypes ?? []).filter(
          (item: DocumentTypeData) =>
            item.status !== false
        )
      );
    } catch (error) {
      console.error("Load edit workflow data error:", error);

      setStaffError(
        error instanceof Error
          ? error.message
          : "Unable to load staff members."
      );

      setDocumentTypeError(
        error instanceof Error
          ? error.message
          : "Unable to load document types."
      );
    } finally {
      setStaffLoading(false);
      setDocumentTypesLoading(false);
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

    const cleanBaseAmount =
      trackingMode === "DOCUMENT_BASED"
        ? "0.00"
        : baseAmount.trim();

    if (!name) {
      alert("Workflow name is required.");
      return;
    }

    if (
      trackingMode === "DOCUMENT_BASED" &&
      !documentTypeId
    ) {
      alert("Document Base is required for a document-based workflow.");
      return;
    }

    if (
      trackingMode === "STANDARD" &&
      !/^\d+(?:\.\d{1,2})?$/.test(
        cleanBaseAmount
      )
    ) {
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
            trackingMode,
            documentTypeId:
              trackingMode === "DOCUMENT_BASED"
                ? Number(documentTypeId)
                : null,
            baseAmount: cleanBaseAmount,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(
          data.message ||
            "Unable to update workflow."
        );
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error(
        "Update workflow error:",
        error
      );

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

            <form
              onSubmit={handleSubmit}
              className="space-y-4 px-6 py-6"
            >
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
                  rows={3}
                  defaultValue={workflow.description ?? ""}
                  className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-black/60">
                  Tracking Mode
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setTrackingMode("STANDARD")
                    }
                    disabled={loading}
                    className={`rounded-lg border px-3 py-2.5 text-left text-xs ${
                      trackingMode === "STANDARD"
                        ? "border-[#f9a800] bg-[#f9a800]/10"
                        : "border-black/10 bg-white"
                    }`}
                  >
                    <p className="font-semibold">
                      Standard
                    </p>
                    <p className="mt-0.5 text-[10px] text-black/40">
                      One workflow task chain.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setTrackingMode("DOCUMENT_BASED")
                    }
                    disabled={loading}
                    className={`rounded-lg border px-3 py-2.5 text-left text-xs ${
                      trackingMode === "DOCUMENT_BASED"
                        ? "border-[#f9a800] bg-[#f9a800]/10"
                        : "border-black/10 bg-white"
                    }`}
                  >
                    <p className="font-semibold">
                      Document Based
                    </p>
                    <p className="mt-0.5 text-[10px] text-black/40">
                      Independent chain per language document.
                    </p>
                  </button>
                </div>
              </div>

              {trackingMode === "DOCUMENT_BASED" ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-black/60">
                    Document Base{" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <select
                    value={documentTypeId}
                    onChange={(event) =>
                      setDocumentTypeId(
                        event.target.value
                      )
                    }
                    disabled={
                      loading ||
                      documentTypesLoading
                    }
                    className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                  >
                    <option value="">
                      {documentTypesLoading
                        ? "Loading document types..."
                        : "Select Document Base"}
                    </option>

                    {documentTypes.map(
                      (documentType) => (
                        <option
                          key={documentType.id}
                          value={documentType.id}
                        >
                          {documentType.name}
                        </option>
                      )
                    )}
                  </select>

                  {documentTypeError && (
                    <p className="mt-1.5 text-xs text-red-500">
                      {documentTypeError}
                    </p>
                  )}
                </div>
              ) : (
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
                    onChange={(event) =>
                      setBaseAmount(
                        event.target.value
                      )
                    }
                    required
                    disabled={loading}
                    className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                  />
                </div>
              )}

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
                  onChange={(event) =>
                    setDefaultStaffId(
                      event.target.value
                    )
                  }
                  disabled={
                    staffLoading ||
                    !!staffError
                  }
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
                    Loading...
                  </p>
                )}

                {staffError && (
                  <p className="mt-1.5 text-xs text-red-500">
                    {staffError}
                  </p>
                )}
              </div>

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
                  disabled={
                    loading ||
                    staffLoading ||
                    documentTypesLoading
                  }
                  className="rounded-lg bg-black px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
                >
                  {loading
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
