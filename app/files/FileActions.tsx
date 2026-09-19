"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Settlement =
  | "NO_PAYMENT"
  | "REFUND_PAID"
  | "NON_REFUNDABLE"
  | "TRANSFER_CREDIT";

type TargetFile = {
  id: number;
  fileNumber: string;
  title: string;
  clientName: string;
};

type FileActionsProps = {
  fileId: number;
  fileNumber: string;
  clientName: string;
  title: string;
  canCancel: boolean;
};

export default function FileActions({
  fileId,
  fileNumber,
  clientName,
  title,
  canCancel,
}: FileActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [settlement, setSettlement] =
    useState<Settlement>("NO_PAYMENT");
  const [transferTargetFileId, setTransferTargetFileId] =
    useState("");
  const [targetFiles, setTargetFiles] = useState<TargetFile[]>([]);

  const money = (value: number) =>
    value.toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const openCancel = async () => {
    if (!canCancel || loading || saving) return;

    setOpen(true);
    setLoading(true);
    setError("");
    setReason("");
    setReasonError(false);
    setTransferTargetFileId("");

    try {
      const response = await fetch(`/api/files/${fileId}/cancel`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load cancellation details."
        );
      }

      const paid = Number(data.totalPaid ?? 0);
      setTotalAmount(Number(data.totalAmount ?? 0));
      setTotalPaid(paid);
      setOutstanding(Number(data.outstanding ?? 0));
      setSettlement(paid > 0 ? "REFUND_PAID" : "NO_PAYMENT");
      setTargetFiles(data.targetFiles ?? []);
    } catch (err) {
      console.error("Load cancellation details error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load cancellation details."
      );
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
    setError("");
    setReasonError(false);
  };

  const confirmCancel = async () => {
    if (saving) return;

    if (!reason.trim()) {
      setError("");
      setReasonError(true);
      reasonRef.current?.focus();
      return;
    }

    setReasonError(false);

    if (totalPaid <= 0 && settlement !== "NO_PAYMENT") {
      setError("This file has no payment. Select No payment received.");
      return;
    }

    if (totalPaid > 0 && settlement === "NO_PAYMENT") {
      setError("Select how the paid amount should be settled.");
      return;
    }

    if (
      settlement === "TRANSFER_CREDIT" &&
      !transferTargetFileId
    ) {
      setError("Select the file that should receive the credit.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/files/${fileId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: reason.trim(),
          settlement,
          transferTargetClientFileId:
            settlement === "TRANSFER_CREDIT"
              ? Number(transferTargetFileId)
              : null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to cancel this file."
        );
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Cancel file error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to cancel this file."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Link
          href={`/files/${fileId}`}
          className="inline-flex rounded-md border border-black/10 px-2.5 py-1.5 text-[10px] font-medium hover:border-[#f9a800] hover:bg-[#fffaf0]"
        >
          View
        </Link>

        {canCancel ? (
          <button
            type="button"
            onClick={openCancel}
            className="inline-flex rounded-md border border-red-200 px-2.5 py-1.5 text-[10px] font-medium text-red-600 hover:bg-red-50"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-lg max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold">
                  Cancel Client File
                </h2>
                <p className="mt-1 text-xs text-black/40">
                  {fileNumber} · {title}
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="text-lg text-black/30 hover:text-black"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto space-y-5 px-6 py-5">
              {loading ? (
                <p className="text-sm text-black/45">
                  Loading financial details...
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-[#fafaf9] p-3">
                      <p className="text-[10px] text-black/40">Total</p>
                      <p className="mt-1 text-xs font-semibold">
                        LKR {money(totalAmount)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#fafaf9] p-3">
                      <p className="text-[10px] text-black/40">Paid</p>
                      <p className="mt-1 text-xs font-semibold">
                        LKR {money(totalPaid)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#fafaf9] p-3">
                      <p className="text-[10px] text-black/40">Outstanding</p>
                      <p className="mt-1 text-xs font-semibold">
                        LKR {money(outstanding)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-black/50">
                      Cancellation Reason
                    </label>
                    <textarea
                      ref={reasonRef}
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        if (event.target.value.trim()) {
                          setReasonError(false);
                        }
                      }}
                      rows={3}
                      placeholder={
                        reasonError
                          ? "Cancellation reason is required."
                          : "Why is this file being cancelled?"
                      }
                      className={`w-full rounded-lg px-3 py-2.5 text-sm outline-none ${
                        reasonError
                          ? "border border-red-500 bg-red-50/30 placeholder:text-red-500 focus:border-red-500"
                          : "border border-black/10 focus:border-[#f9a800]"
                      }`}
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-black/50">
                      Payment Settlement
                    </p>

                    <div className="space-y-2">
                      {totalPaid <= 0 ? (
                        <label className="flex items-start gap-2 rounded-lg border border-black/10 p-3 text-xs">
                          <input
                            type="radio"
                            name={`settlement-${fileId}`}
                            checked={settlement === "NO_PAYMENT"}
                            onChange={() => setSettlement("NO_PAYMENT")}
                          />
                          <span>
                            <span className="font-medium">
                              No payment received
                            </span>
                          </span>
                        </label>
                      ) : (
                        <>
                          <label className="flex items-start gap-2 rounded-lg border border-black/10 p-3 text-xs">
                            <input
                              type="radio"
                              name={`settlement-${fileId}`}
                              checked={settlement === "REFUND_PAID"}
                              onChange={() => setSettlement("REFUND_PAID")}
                            />
                            <span>
                              <span className="font-medium">
                                Refund paid amount
                              </span>
                              <span className="mt-0.5 block text-[10px] text-black/40">
                                LKR {money(totalPaid)}
                              </span>
                            </span>
                          </label>

                          <label className="flex items-start gap-2 rounded-lg border border-black/10 p-3 text-xs">
                            <input
                              type="radio"
                              name={`settlement-${fileId}`}
                              checked={settlement === "NON_REFUNDABLE"}
                              onChange={() => setSettlement("NON_REFUNDABLE")}
                            />
                            <span className="font-medium">
                              Payment is non-refundable
                            </span>
                          </label>

                          <label className="flex items-start gap-2 rounded-lg border border-black/10 p-3 text-xs">
                            <input
                              type="radio"
                              name={`settlement-${fileId}`}
                              checked={settlement === "TRANSFER_CREDIT"}
                              onChange={() => setSettlement("TRANSFER_CREDIT")}
                            />
                            <span className="font-medium">
                              Transfer paid amount as credit
                            </span>
                          </label>

                          {settlement === "TRANSFER_CREDIT" ? (
                            <select
                              value={transferTargetFileId}
                              onChange={(event) =>
                                setTransferTargetFileId(event.target.value)
                              }
                              className="ml-6 h-10 w-[calc(100%-1.5rem)] rounded-lg border border-black/10 bg-white px-3 text-xs outline-none focus:border-[#f9a800]"
                            >
                              <option value="">
                                Select target client file
                              </option>
                              {targetFiles.map((target) => (
                                <option key={target.id} value={target.id}>
                                  {target.fileNumber} — {target.clientName} — {target.title}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] leading-5 text-black/35">
                    Cancelling stops the file workflow and scheduled calendar
                    events. Existing payment records are preserved.
                  </p>
                </>
              )}

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-black/10 px-6 py-4">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="rounded-lg border border-black/10 px-4 py-2 text-xs font-medium hover:bg-black/[0.03]"
              >
                Keep File
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={loading || saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
