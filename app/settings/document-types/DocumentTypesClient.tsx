"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

type DocumentType = {
  id: number;
  name: string;
  description: string | null;
  defaultAmount: number;
  status: boolean;
};

type Props = {
  initialDocumentTypes: DocumentType[];
};

export default function DocumentTypesClient({
  initialDocumentTypes,
}: Props) {
  const searchParams = useSearchParams();

  const currentFilter =
    searchParams.get("status") === "inactive" ||
    searchParams.get("status") === "all"
      ? searchParams.get("status")
      : "active";

  const [documentTypes, setDocumentTypes] =
    useState<DocumentType[]>(
      initialDocumentTypes
    );

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");
  const [defaultAmount, setDefaultAmount] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  // --------------------------------------------------
  // Reset Form
  // --------------------------------------------------

  const resetForm = () => {
    setName("");
    setDescription("");
    setDefaultAmount("");
    setEditingId(null);
  };

  // --------------------------------------------------
  // Open Add
  // --------------------------------------------------

  const handleOpenAdd = () => {
    resetForm();
    setOpen(true);
  };

  // --------------------------------------------------
  // Open Edit
  // --------------------------------------------------

  const handleOpenEdit = (
    documentType: DocumentType
  ) => {
    setEditingId(documentType.id);
    setName(documentType.name);
    setDescription(
      documentType.description ?? ""
    );
    setDefaultAmount(
      documentType.defaultAmount.toFixed(2)
    );
    setOpen(true);
  };

  // --------------------------------------------------
  // Close Modal
  // --------------------------------------------------

  const handleClose = () => {
    if (loading) return;

    setOpen(false);
    resetForm();
  };

  // --------------------------------------------------
  // Save Document Type
  // --------------------------------------------------

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (loading) return;

    const cleanName = name.trim();
    const cleanDescription =
      description.trim();
    const cleanAmount =
      defaultAmount.trim();

    if (!cleanName) {
      alert(
        "Document type name is required."
      );
      return;
    }

    if (
      !/^\d+(?:\.\d{1,2})?$/.test(
        cleanAmount
      )
    ) {
      alert(
        "Valid default price is required."
      );
      return;
    }

    setLoading(true);

    try {
      const isEditing =
        editingId !== null;

      const response = await fetch(
        isEditing
          ? `/api/document-types/${editingId}`
          : "/api/document-types",
        {
          method: isEditing
            ? "PATCH"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: cleanName,
            description:
              cleanDescription,
            defaultAmount:
              cleanAmount,
          }),
        }
      );

      const responseText =
        await response.text();

      let data: {
        success?: boolean;
        message?: string;
        documentType?: DocumentType;
      } = {};

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        data = {
          message: responseText,
        };
      }

      if (
        !response.ok ||
        !data.success
      ) {
        alert(
          data.message ||
            `Unable to save document type. HTTP ${response.status}`
        );
        return;
      }

      if (!data.documentType) {
        alert(
          "Server did not return the saved document type."
        );
        return;
      }

      const saved =
        data.documentType;

      setDocumentTypes((current) => {
        if (isEditing) {
          return current
            .map((item) =>
              item.id === saved.id
                ? saved
                : item
            )
            .sort((a, b) =>
              a.name.localeCompare(
                b.name
              )
            );
        }

        return [...current, saved].sort(
          (a, b) =>
            a.name.localeCompare(
              b.name
            )
        );
      });

      setOpen(false);
      resetForm();
    } catch (error) {
      console.error(
        "Save document type error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Activate / Deactivate
  // --------------------------------------------------

  const handleToggleStatus = async (
    documentType: DocumentType
  ) => {
    const nextStatus =
      !documentType.status;

    // ------------------------------------------------
    // Confirmation before Deactivate
    // ------------------------------------------------

    if (!nextStatus) {
      const confirmed =
        window.confirm(
          `Deactivate "${documentType.name}"?\n\n` +
            "It will no longer be available when adding new documents to client files."
        );

      if (!confirmed) {
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/document-types/${documentType.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      const responseText =
        await response.text();

      let data: {
        success?: boolean;
        message?: string;
        documentType?: DocumentType;
      } = {};

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        data = {
          message: responseText,
        };
      }

      if (
        !response.ok ||
        !data.success
      ) {
        alert(
          data.message ||
            `Unable to update document type. HTTP ${response.status}`
        );
        return;
      }

      if (!data.documentType) {
        alert(
          "Server did not return the updated document type."
        );
        return;
      }

      const updated =
        data.documentType;

      // ------------------------------------------------
      // Immediately update the local list.
      //
      // Active filter:
      // Deactivated item disappears immediately.
      //
      // Inactive filter:
      // Activated item disappears immediately.
      //
      // All filter:
      // Item remains and status is updated.
      // ------------------------------------------------

      setDocumentTypes((current) => {
        if (
          currentFilter === "active" &&
          !updated.status
        ) {
          return current.filter(
            (item) =>
              item.id !== updated.id
          );
        }

        if (
          currentFilter ===
            "inactive" &&
          updated.status
        ) {
          return current.filter(
            (item) =>
              item.id !== updated.id
          );
        }

        return current
          .map((item) =>
            item.id === updated.id
              ? updated
              : item
          )
          .sort((a, b) =>
            a.name.localeCompare(
              b.name
            )
          );
      });
    } catch (error) {
      console.error(
        "Toggle document type status error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <>
      {/* Document Type List */}

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
        {/* Section Header */}

        <div className="flex flex-col gap-4 border-b border-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              Document Types
            </h2>

            <p className="mt-1 text-xs text-black/40">
              Reusable document types and their
              default service prices.
            </p>
          </div>

          <button
            type="button"
            onClick={
              handleOpenAdd
            }
            className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black"
          >
            + Add Document Type
          </button>
        </div>

        {/* Empty State */}

        {documentTypes.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center px-6">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04]">
                <span className="text-lg text-black/30">
                  +
                </span>
              </div>

              <p className="mt-4 text-sm font-medium text-black/50">
                No document types found
              </p>

              <p className="mt-1 text-xs text-black/30">
                There are no document types in
                the current filter.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              {/* Table Header */}

              <thead>
                <tr className="border-b border-black/10 bg-[#fafaf9]">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Document Type
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Description
                  </th>

                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Default Price
                  </th>

                  <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Action
                  </th>
                </tr>
              </thead>

              {/* Table Body */}

              <tbody>
                {documentTypes.map(
                  (documentType) => (
                    <tr
                      key={
                        documentType.id
                      }
                      className="border-b border-black/5 last:border-b-0"
                    >
                      {/* Document Type */}

                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-black">
                          {
                            documentType.name
                          }
                        </p>
                      </td>

                      {/* Description */}

                      <td className="px-5 py-4">
                        <p className="max-w-md truncate text-xs text-black/45">
                          {documentType.description?.trim()
                            ? documentType.description
                            : "—"}
                        </p>
                      </td>

                      {/* Default Price */}

                      <td className="px-5 py-4 text-right">
                        <p className="whitespace-nowrap text-sm font-medium text-black">
                          LKR{" "}
                          {documentType.defaultAmount.toLocaleString(
                            "en-LK",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>
                      </td>

                      {/* Status */}

                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold ${
                            documentType.status
                              ? "bg-green-100 text-green-700"
                              : "bg-black/5 text-black/40"
                          }`}
                        >
                          {documentType.status
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      {/* Action */}

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {/* Edit */}

                          <button
                            type="button"
                            onClick={() =>
                              handleOpenEdit(
                                documentType
                              )
                            }
                            disabled={
                              loading
                            }
                            className="text-xs font-medium text-black/45 transition hover:text-black disabled:opacity-50"
                          >
                            Edit
                          </button>

                          {/* Activate / Deactivate */}

                          <button
                            type="button"
                            onClick={() =>
                              handleToggleStatus(
                                documentType
                              )
                            }
                            disabled={
                              loading
                            }
                            className={
                              documentType.status
                                ? "text-xs font-medium text-red-500 transition hover:text-red-700 disabled:opacity-50"
                                : "text-xs font-medium text-green-600 transition hover:text-green-700 disabled:opacity-50"
                            }
                          >
                            {documentType.status
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}

            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-base font-semibold">
                  {editingId !==
                  null
                    ? "Edit Document Type"
                    : "Add Document Type"}
                </h2>

                <p className="mt-1 text-xs text-black/40">
                  Set the reusable document name
                  and default price.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  handleClose
                }
                disabled={
                  loading
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-black/40 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* Form */}

            <form
              onSubmit={
                handleSubmit
              }
              className="max-h-[calc(100vh-9rem)] space-y-4 overflow-y-auto px-6 py-6"
            >
              {/* Name */}

              <div>
                <label
                  htmlFor="document-type-name"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Document Type
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <input
                  id="document-type-name"
                  value={name}
                  onChange={(
                    event
                  ) =>
                    setName(
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. Birth Certificate"
                  required
                  disabled={
                    loading
                  }
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                />
              </div>

              {/* Description */}

              <div>
                <label
                  htmlFor="document-type-description"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Description
                </label>

                <textarea
                  id="document-type-description"
                  value={
                    description
                  }
                  onChange={(
                    event
                  ) =>
                    setDescription(
                      event.target
                        .value
                    )
                  }
                  rows={3}
                  placeholder="Brief description..."
                  disabled={
                    loading
                  }
                  className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                />
              </div>

              {/* Default Price */}

              <div>
                <label
                  htmlFor="document-type-price"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Default Price (LKR)
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <input
                  id="document-type-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    defaultAmount
                  }
                  onChange={(
                    event
                  ) =>
                    setDefaultAmount(
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. 5000.00"
                  required
                  disabled={
                    loading
                  }
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                />

                <p className="mt-1.5 text-[11px] text-black/40">
                  This price will be used as
                  the starting price when this
                  document is added to a client
                  file.
                </p>
              </div>

              {/* Buttons */}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={
                    handleClose
                  }
                  disabled={
                    loading
                  }
                  className="rounded-lg border border-black/10 px-4 py-2.5 text-xs font-medium text-black/50 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    loading
                  }
                  className="rounded-lg bg-black px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
                >
                  {loading
                    ? "Saving..."
                    : editingId !==
                      null
                      ? "Save Changes"
                      : "Add Document Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}