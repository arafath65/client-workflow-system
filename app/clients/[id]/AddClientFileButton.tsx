
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WorkflowTemplate = {
  id: number;
  name: string;
  status?: boolean;
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
  const [thirdPartyId, setThirdPartyId] = useState("");
  const [description, setDescription] = useState("");

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
    setThirdPartyId("");
    setDescription("");
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
      setThirdPartyId("");
      setDescription("");
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
                      setServiceTypeId(e.target.value)
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
                      !fileNumber
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