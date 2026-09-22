
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WorkflowTemplate = {
  id: number;
  name: string;
  baseAmount?: string | number | null;
  trackingMode?: "STANDARD" | "DOCUMENT_BASED";
  status?: boolean;
};

type DocumentType = {
  id: number;
  name: string;
  description: string | null;
  defaultAmount: number | string;
  status?: boolean;
};

type DocumentRow = {
  rowId: string;
  documentTypeId: string;
  baseAmount: string;
  discountAmount: string;
};

type ThirdParty = {
  id: number;
  name: string;
  status?: boolean;
};

type AddClientFileButtonProps = {
  clientId: number;
};

export default function AddClientFileButton({
  clientId,
}: AddClientFileButtonProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [fileNumberType, setFileNumberType] =
    useState<"SYSTEM" | "CUSTOM">("SYSTEM");

  const [fileNumber, setFileNumber] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [trackingMode, setTrackingMode] = useState<
    "STANDARD" | "DOCUMENT_BASED"
  >("STANDARD");
  const [thirdPartyId, setThirdPartyId] = useState("");
  const [description, setDescription] = useState("");

  const [baseAmount, setBaseAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");

  const [documentTypes, setDocumentTypes] = useState<
    DocumentType[]
  >([]);

  const [documents, setDocuments] = useState<
    DocumentRow[]
  >([]);

  const [serviceTypes, setServiceTypes] = useState<
    WorkflowTemplate[]
  >([]);

  const [thirdParties, setThirdParties] = useState<
    ThirdParty[]
  >([]);

  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // Read JSON response safely
  // --------------------------------------------------

  const readResponse = async (response: Response) => {
    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        message: text,
      };
    }
  };

  // --------------------------------------------------
  // Load Service Types and Third Parties
  // --------------------------------------------------

  const loadFormData = async () => {
    setLoadingData(true);
    setError("");

    try {
      // ---------------------------------------------
      // Load Service Types
      // ---------------------------------------------

      try {
        const workflowResponse = await fetch(
          "/api/workflows",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const workflowData = await readResponse(
          workflowResponse
        );

        if (!workflowResponse.ok) {
          throw new Error(
            workflowData?.message ||
              `Unable to load Service Types. HTTP ${workflowResponse.status}`
          );
        }

        const workflows = Array.isArray(
          workflowData?.workflows
        )
          ? workflowData.workflows
          : [];

        const activeWorkflows = workflows.filter(
          (workflow: WorkflowTemplate) =>
            workflow.status !== false
        );

        setServiceTypes(activeWorkflows);

        console.log(
          "Loaded Service Types:",
          activeWorkflows
        );
      } catch (error) {
        console.error(
          "Service Type loading error:",
          error
        );

        setServiceTypes([]);

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load Service Types."
        );
      }

      // ---------------------------------------------
      // Load Document Types
      // ---------------------------------------------

      try {
        const documentTypeResponse = await fetch(
          "/api/document-types",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const documentTypeData = await readResponse(
          documentTypeResponse
        );

        if (!documentTypeResponse.ok) {
          console.error(
            "Document Type API error:",
            documentTypeData
          );

          setDocumentTypes([]);
        } else {
          const types = Array.isArray(
            documentTypeData?.documentTypes
          )
            ? documentTypeData.documentTypes
            : [];

          const activeDocumentTypes = types.filter(
            (documentType: DocumentType) =>
              documentType.status !== false
          );

          setDocumentTypes(activeDocumentTypes);
        }
      } catch (error) {
        console.error(
          "Document Type loading error:",
          error
        );

        setDocumentTypes([]);
      }

      // ---------------------------------------------
      // Load Third Parties
      // ---------------------------------------------

      try {
        const thirdPartyResponse = await fetch(
          "/api/third-parties",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const thirdPartyData = await readResponse(
          thirdPartyResponse
        );

        if (!thirdPartyResponse.ok) {
          console.error(
            "Third Party API error:",
            thirdPartyData
          );

          setThirdParties([]);
        } else {
          const thirdParties = Array.isArray(
            thirdPartyData?.thirdParties
          )
            ? thirdPartyData.thirdParties
            : [];

          const activeThirdParties =
            thirdParties.filter(
              (thirdParty: ThirdParty) =>
                thirdParty.status !== false
            );

          setThirdParties(activeThirdParties);
        }
      } catch (error) {
        console.error(
          "Third Party loading error:",
          error
        );

        setThirdParties([]);
      }
    } finally {
      setLoadingData(false);
    }
  };

  // --------------------------------------------------
  // Generate System File Number
  // --------------------------------------------------

  const generateFileNumber = async () => {
    try {
      const response = await fetch(
        "/api/files/next-number",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Unable to generate File Number. HTTP ${response.status}`
        );
      }

      if (!data?.fileNumber) {
        throw new Error(
          "System did not return a File Number."
        );
      }

      setFileNumber(data.fileNumber);
    } catch (error) {
      console.error(
        "Generate file number error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to generate File Number."
      );
    }
  };

  // --------------------------------------------------
  // Open Modal
  // --------------------------------------------------

  const handleOpen = async () => {
    setFileNumberType("SYSTEM");
    setFileNumber("");
    setServiceTypeId("");
    setTrackingMode("STANDARD");
    setThirdPartyId("");
    setDescription("");
    setBaseAmount("");
    setDiscountAmount("");
    setDocuments([]);
    setError("");

    setOpen(true);
    setLoadingData(true);

    try {
      await Promise.all([
        loadFormData(),
        generateFileNumber(),
      ]);
    } finally {
      setLoadingData(false);
    }
  };

  // --------------------------------------------------
  // Close Modal
  // --------------------------------------------------

  const handleClose = () => {
    if (saving) return;

    setOpen(false);
    setError("");
  };

  // --------------------------------------------------
  // Change File Number Type
  // --------------------------------------------------

  const handleFileNumberTypeChange = async (
    type: "SYSTEM" | "CUSTOM"
  ) => {
    setFileNumberType(type);
    setError("");

    if (type === "CUSTOM") {
      setFileNumber("");
      return;
    }

    setFileNumber("");
    setLoadingData(true);

    try {
      await generateFileNumber();
    } finally {
      setLoadingData(false);
    }
  };

  // --------------------------------------------------
  // Change Service Type
  // --------------------------------------------------

  const createEmptyDocumentRow = (): DocumentRow => ({
    rowId: crypto.randomUUID(),
    documentTypeId: "",
    baseAmount: "",
    discountAmount: "",
  });

  const handleServiceTypeChange = (value: string) => {
    setServiceTypeId(value);
    setDiscountAmount("");
    setError("");

    if (!value) {
      setTrackingMode("STANDARD");
      setBaseAmount("");
      setDocuments([]);
      return;
    }

    const selectedWorkflow = serviceTypes.find(
      (workflow) => String(workflow.id) === value
    );

    const nextTrackingMode =
      selectedWorkflow?.trackingMode === "DOCUMENT_BASED"
        ? "DOCUMENT_BASED"
        : "STANDARD";

    setTrackingMode(nextTrackingMode);

    if (nextTrackingMode === "DOCUMENT_BASED") {
      setBaseAmount("");
      setDiscountAmount("");
      setDocuments((current) =>
        current.length > 0
          ? current
          : [createEmptyDocumentRow()]
      );
      return;
    }

    setDocuments([]);

    setBaseAmount(
      selectedWorkflow?.baseAmount !== undefined &&
        selectedWorkflow?.baseAmount !== null
        ? String(selectedWorkflow.baseAmount)
        : "0"
    );
  };

  const handleAddDocument = () => {
    setError("");
    setDocuments((current) => [
      ...current,
      createEmptyDocumentRow(),
    ]);
  };

  const handleRemoveDocument = (rowId: string) => {
    setError("");

    setDocuments((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter(
        (document) => document.rowId !== rowId
      );
    });
  };

  const handleDocumentTypeChange = (
    rowId: string,
    documentTypeId: string
  ) => {
    setError("");

    const alreadySelected = documents.some(
      (document) =>
        document.rowId !== rowId &&
        document.documentTypeId === documentTypeId
    );

    if (documentTypeId && alreadySelected) {
      setError("This Document Type has already been added.");
      return;
    }

    const selectedType = documentTypes.find(
      (documentType) =>
        String(documentType.id) === documentTypeId
    );

    setDocuments((current) =>
      current.map((document) =>
        document.rowId === rowId
          ? {
              ...document,
              documentTypeId,
              baseAmount: selectedType
                ? Number(selectedType.defaultAmount).toFixed(2)
                : "",
              discountAmount: "",
            }
          : document
      )
    );
  };

  const handleDocumentAmountChange = (
    rowId: string,
    field: "baseAmount" | "discountAmount",
    value: string
  ) => {
    setError("");

    setDocuments((current) =>
      current.map((document) =>
        document.rowId === rowId
          ? { ...document, [field]: value }
          : document
      )
    );
  };

  // --------------------------------------------------
  // Submit
  // --------------------------------------------------

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!serviceTypeId) {
      setError("Service Type is required.");
      return;
    }

    if (!fileNumber.trim()) {
      setError("File Number is required.");
      return;
    }

    if (trackingMode === "DOCUMENT_BASED") {
      if (documents.length === 0) {
        setError("At least one document is required.");
        return;
      }

      const selectedIds = documents.map(
        (document) => document.documentTypeId
      );

      if (selectedIds.some((id) => !id)) {
        setError("Please select a Document Type for every document.");
        return;
      }

      if (new Set(selectedIds).size !== selectedIds.length) {
        setError("The same Document Type cannot be added more than once.");
        return;
      }

      for (const document of documents) {
        if (!/^\d+(?:\.\d{1,2})?$/.test(document.baseAmount.trim())) {
          setError("Every document must have a valid base price.");
          return;
        }

        if (
          document.discountAmount.trim() &&
          !/^\d+(?:\.\d{1,2})?$/.test(document.discountAmount.trim())
        ) {
          setError("Every document must have a valid discount.");
          return;
        }

        const documentBase = Number(document.baseAmount);
        const documentDiscount = Number(document.discountAmount || "0");

        if (documentDiscount > documentBase) {
          setError("A document discount cannot be greater than its base price.");
          return;
        }
      }
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        "/api/files",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientId,

            workflowTemplateId:
              Number(serviceTypeId),

            thirdPartyId:
              thirdPartyId || null,

            fileNumberType,

            fileNumber:
              fileNumber.trim(),

            description:
              description.trim() || null,

            baseAmount:
              baseAmount || "0",

            discountAmount:
              discountAmount || "0",

            documents:
              trackingMode === "DOCUMENT_BASED"
                ? documents.map((document) => ({
                    documentTypeId: Number(
                      document.documentTypeId
                    ),
                    baseAmount: document.baseAmount.trim(),
                    discountAmount:
                      document.discountAmount.trim() || "0",
                  }))
                : [],
          }),
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        setError(
          data?.message ||
            `Unable to create file. HTTP ${response.status}`
        );
        return;
      }

      setOpen(false);

      setFileNumberType("SYSTEM");
      setFileNumber("");
      setServiceTypeId("");
      setTrackingMode("STANDARD");
      setThirdPartyId("");
      setDescription("");
      setBaseAmount("");
      setDiscountAmount("");
      setDocuments([]);
      setError("");

      router.refresh();
    } catch (error) {
      console.error(
        "Create file error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* New File Button */}

      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black"
      >
        + New File
      </button>

      {/* Modal */}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl">

            {/* Header */}

            <div className="flex shrink-0 items-start justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold">
                  Create New File
                </h2>

                <p className="mt-1 text-xs text-black/40">
                  Create a new service file for this
                  client.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="text-lg text-black/30 hover:text-black"
              >
                ×
              </button>
            </div>

            {/* Scrollable Content */}

            <div className="overflow-y-auto px-6 py-5">
              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >

                {/* File Number */}

                <div>
                  <label className="mb-2 block text-xs font-medium">
                    File Number
                  </label>

                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="fileNumberType"
                        value="SYSTEM"
                        checked={
                          fileNumberType === "SYSTEM"
                        }
                        onChange={() =>
                          handleFileNumberTypeChange(
                            "SYSTEM"
                          )
                        }
                        disabled={saving}
                      />

                      System Generated
                    </label>

                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="fileNumberType"
                        value="CUSTOM"
                        checked={
                          fileNumberType === "CUSTOM"
                        }
                        onChange={() =>
                          handleFileNumberTypeChange(
                            "CUSTOM"
                          )
                        }
                        disabled={saving}
                      />

                      Custom Number
                    </label>
                  </div>

                  {fileNumberType === "SYSTEM" ? (
                    <div className="mt-3 rounded-lg border border-black/10 bg-[#fafaf9] px-3 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-black/35">
                        Generated File Number
                      </p>

                      <p className="mt-1 text-sm font-semibold">
                        {fileNumber
                          ? fileNumber
                          : loadingData
                            ? "Generating File Number..."
                            : "Unable to generate File Number"}
                      </p>

                      <p className="mt-1 text-[10px] text-black/35">
                        Write this number on the physical
                        file.
                      </p>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={fileNumber}
                      onChange={(e) =>
                        setFileNumber(e.target.value)
                      }
                      placeholder="Enter your file number"
                      autoFocus
                      disabled={saving}
                      className="mt-3 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-[#f9a800]"
                    />
                  )}
                </div>

                {/* Service Type */}

                <div>
                  <label className="mb-1.5 block text-xs font-medium">
                    Service Type
                  </label>

                  <select
                    value={serviceTypeId}
                    onChange={(e) =>
                      handleServiceTypeChange(e.target.value)
                    }
                    disabled={
                      loadingData || saving
                    }
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#f9a800]"
                  >
                    <option value="">
                      {loadingData
                        ? "Loading Service Types..."
                        : "Select Service Type"}
                    </option>

                    {serviceTypes.map(
                      (serviceType) => (
                        <option
                          key={serviceType.id}
                          value={serviceType.id}
                        >
                          {serviceType.name}
                        </option>
                      )
                    )}
                  </select>

                  {!loadingData &&
                    serviceTypes.length === 0 && (
                      <p className="mt-1.5 text-[10px] text-red-500">
                        No active Service Types found.
                        Create one from Workflows.
                      </p>
                    )}

                  <p className="mt-1.5 text-[10px] text-black/35">
                    The main responsible staff member is
                    inherited from the selected Service Type.
                    Steps and subtasks inherit responsibility
                    unless specifically reassigned.
                  </p>
                </div>

                {/* Third Party */}

                <div>
                  <label className="mb-1.5 block text-xs font-medium">
                    Third Party
                    <span className="ml-1 font-normal text-black/35">
                      (Optional)
                    </span>
                  </label>

                  <select
                    value={thirdPartyId}
                    onChange={(e) =>
                      setThirdPartyId(e.target.value)
                    }
                    disabled={
                      loadingData || saving
                    }
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#f9a800]"
                  >
                    <option value="">
                      Direct Customer
                    </option>

                    {thirdParties.map(
                      (thirdParty) => (
                        <option
                          key={thirdParty.id}
                          value={thirdParty.id}
                        >
                          {thirdParty.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Pricing */}

                {trackingMode === "DOCUMENT_BASED" ? (
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <label className="block text-xs font-medium">
                          Documents
                        </label>

                        <p className="mt-1 text-[10px] text-black/35">
                          Each document gets its own independent workflow progress and its own client-specific price.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddDocument}
                        disabled={saving || documentTypes.length === 0}
                        className="shrink-0 rounded-lg border border-black/10 bg-white px-3 py-2 text-[11px] font-semibold transition hover:border-[#f9a800] hover:bg-[#f9a800]/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        + Add Document
                      </button>
                    </div>

                    {documentTypes.length === 0 ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700">
                        No active Document Types are available. Create one from Settings → Document Types.
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {documents.map((document, index) => {
                          const selectedType = documentTypes.find(
                            (documentType) =>
                              String(documentType.id) ===
                              document.documentTypeId
                          );

                          const documentFinal = Math.max(
                            0,
                            (Number(document.baseAmount) || 0) -
                              (Number(document.discountAmount) || 0)
                          );

                          return (
                            <div
                              key={document.rowId}
                              className="rounded-xl border border-black/10 bg-[#fafaf9] p-4"
                            >
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold">
                                  Document {index + 1}
                                </p>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveDocument(document.rowId)
                                  }
                                  disabled={saving || documents.length <= 1}
                                  className="text-[11px] font-medium text-red-500 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="md:col-span-1">
                                  <label className="mb-1.5 block text-[11px] font-medium text-black/60">
                                    Document Type *
                                  </label>

                                  <select
                                    value={document.documentTypeId}
                                    onChange={(e) =>
                                      handleDocumentTypeChange(
                                        document.rowId,
                                        e.target.value
                                      )
                                    }
                                    disabled={saving}
                                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#f9a800]"
                                  >
                                    <option value="">
                                      Select Document Type
                                    </option>

                                    {documentTypes.map(
                                      (documentType) => {
                                        const usedElsewhere = documents.some(
                                          (item) =>
                                            item.rowId !== document.rowId &&
                                            item.documentTypeId ===
                                              String(documentType.id)
                                        );

                                        return (
                                          <option
                                            key={documentType.id}
                                            value={documentType.id}
                                            disabled={usedElsewhere}
                                          >
                                            {documentType.name}
                                            {usedElsewhere ? " (Added)" : ""}
                                          </option>
                                        );
                                      }
                                    )}
                                  </select>

                                  {selectedType?.description && (
                                    <p className="mt-1.5 text-[10px] text-black/35">
                                      {selectedType.description}
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <label className="mb-1.5 block text-[11px] font-medium text-black/60">
                                    Base Price (LKR) *
                                  </label>

                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={document.baseAmount}
                                    onChange={(e) =>
                                      handleDocumentAmountChange(
                                        document.rowId,
                                        "baseAmount",
                                        e.target.value
                                      )
                                    }
                                    disabled={saving || !document.documentTypeId}
                                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#f9a800] disabled:bg-black/[0.03]"
                                  />

                                  <p className="mt-1.5 text-[10px] text-black/35">
                                    Auto-filled from the global default price; editing changes this client file only.
                                  </p>
                                </div>

                                <div>
                                  <label className="mb-1.5 block text-[11px] font-medium text-black/60">
                                    Discount (LKR)
                                  </label>

                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={document.discountAmount}
                                    onChange={(e) =>
                                      handleDocumentAmountChange(
                                        document.rowId,
                                        "discountAmount",
                                        e.target.value
                                      )
                                    }
                                    disabled={saving}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#f9a800]"
                                  />
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between rounded-lg border border-black/10 bg-white px-3 py-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-black/35">
                                    Document Final Amount
                                  </p>

                                  <p className="mt-1 text-sm font-semibold">
                                    LKR {documentFinal.toLocaleString("en-LK", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-3 rounded-lg border border-black/10 bg-[#fafaf9] px-3 py-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-black/35">
                            Total Base Price
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            LKR {documents
                              .reduce(
                                (sum, document) =>
                                  sum + (Number(document.baseAmount) || 0),
                                0
                              )
                              .toLocaleString("en-LK", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-black/35">
                            Total Discount
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            LKR {documents
                              .reduce(
                                (sum, document) =>
                                  sum + (Number(document.discountAmount) || 0),
                                0
                              )
                              .toLocaleString("en-LK", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-black/35">
                            Total Final Amount
                          </p>
                          <p className="mt-1 text-base font-semibold">
                            LKR {documents
                              .reduce(
                                (sum, document) =>
                                  sum +
                                  Math.max(
                                    0,
                                    (Number(document.baseAmount) || 0) -
                                      (Number(document.discountAmount) || 0)
                                  ),
                                0
                              )
                              .toLocaleString("en-LK", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-xs font-medium">
                      Service Pricing
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-medium text-black/60">
                          Base Price (LKR)
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={baseAmount}
                          readOnly
                          placeholder="0.00"
                          disabled={saving || !serviceTypeId}
                          className="w-full rounded-lg border border-black/10 bg-[#fafaf9] px-3 py-2.5 text-sm outline-none focus:border-[#f9a800] disabled:opacity-60"
                        />
                        <p className="mt-1.5 text-[10px] text-black/35">
                          Loaded automatically from the selected Service Type.
                        </p>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-medium text-black/60">
                          Discount (LKR)
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={discountAmount}
                          onChange={(e) =>
                            setDiscountAmount(e.target.value)
                          }
                          placeholder="0.00"
                          disabled={saving}
                          className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-[#f9a800]"
                        />
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-black/10 bg-[#fafaf9] px-3 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-black/35">
                        Final Amount
                      </p>

                      <p className="mt-1 text-base font-semibold">
                        LKR {Math.max(
                          0,
                          (Number(baseAmount) || 0) -
                            (Number(discountAmount) || 0)
                        ).toLocaleString("en-LK", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>

                      <p className="mt-1 text-[10px] text-black/35">
                        This price is saved for this workflow instance.
                      </p>
                    </div>
                  </div>
                )}

                {/* Description */}

                <div>
                  <label className="mb-1.5 block text-xs font-medium">
                    Description
                    <span className="ml-1 font-normal text-black/35">
                      (Optional)
                    </span>
                  </label>

                  <textarea
                    value={description}
                    onChange={(e) =>
                      setDescription(e.target.value)
                    }
                    rows={3}
                    placeholder="Enter any additional details..."
                    disabled={saving}
                    className="w-full resize-none rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-[#f9a800]"
                  />
                </div>

                {/* Error */}

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                    {error}
                  </div>
                )}

                {/* Buttons */}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={saving}
                    className="rounded-lg border border-black/10 px-4 py-2.5 text-xs font-medium hover:bg-black/[0.03]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      loadingData ||
                      !serviceTypeId ||
                      !fileNumber ||
                      (trackingMode === "DOCUMENT_BASED" &&
                        (documents.length === 0 ||
                          documents.some(
                            (document) =>
                              !document.documentTypeId ||
                              !document.baseAmount
                          )))
                    }
                    className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Creating..."
                      : "Create File"}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}