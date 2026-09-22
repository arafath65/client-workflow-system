"use client";

import ExtraCharges from "./ExtraCharges";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Summary = {
  workflowFees: string;
  extraCharges: string;
  totalAmount: string;
  totalPaid: string;
  outstanding: string;
};

type Payment = {
  id: number;
  amount: string;
  paymentMethod:
    | "CASH"
    | "CARD"
    | "BANK_TRANSFER"
    | "CHEQUE";
  status:
    | "PENDING"
    | "CLEARED"
    | "CANCELLED"
    | "REFUNDED"
    | "RETURNED"
    | "BOUNCED";
  referenceNo: string | null;
  remarks: string | null;
  paidAt: string;
};

type PaymentSummaryProps = {
  fileId: number;
};

export default function PaymentSummary({
  fileId,
}: PaymentSummaryProps) {
  const [summary, setSummary] =
    useState<Summary | null>(null);

  const [payments, setPayments] = useState<Payment[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showPaymentForm, setShowPaymentForm] =
    useState(false);

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<
      "CASH" | "CARD" | "BANK_TRANSFER" | "CHEQUE"
    >("CASH");

  const [reversingPaymentId, setReversingPaymentId] =
    useState<number | null>(null);

  const [paymentFilter, setPaymentFilter] =
    useState<"CLEARED" | "CANCELLED" | "REFUNDED">("CLEARED");

  const [paidAt, setPaidAt] = useState("");
  const [referenceNo, setReferenceNo] =
    useState("");
  const [remarks, setRemarks] = useState("");

  const [error, setError] = useState("");

  // --------------------------------------------------
  // Load payment summary
  // --------------------------------------------------

  const loadPaymentSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/files/${fileId}/payments`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to load payment summary."
        );
      }

      setSummary(data.summary);
      setPayments(data.payments ?? []);
    } catch (error) {
      console.error(
        "Load payment summary error:",
        error
      );

      setError(
        "Unable to load payment information."
      );
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPaymentSummary();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadPaymentSummary]);

  // --------------------------------------------------
  // Record payment
  // --------------------------------------------------

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (saving) return;

    const cleanAmount = amount.trim();

    if (
      !/^\d+(?:\.\d{1,2})?$/.test(cleanAmount)
    ) {
      setError(
        "Enter a valid payment amount."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/files/${fileId}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: cleanAmount,
            paymentMethod,
            paidAt: paidAt || undefined,
            referenceNo,
            remarks,
            status: "CLEARED",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.message ||
            "Unable to record payment."
        );
        return;
      }

      setAmount("");
      setPaymentMethod("CASH");
      setPaidAt("");
      setReferenceNo("");
      setRemarks("");
      setShowPaymentForm(false);

      await loadPaymentSummary();
    } catch (error) {
      console.error(
        "Record payment error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  const money = (value: string | number) =>
    Number(value).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const date = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  if (loading && !summary) {
    return (
      <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#f9a800]">
          Payments
        </p>

        <h2 className="mt-1 text-lg font-semibold">
          Payment Summary
        </h2>

        <div className="mt-5 rounded-lg bg-[#fafaf9] p-6 text-center">
          <p className="text-sm text-black/40">
            Loading payment information...
          </p>
        </div>
      </div>
    );
  }

  const handleReversePayment = async (
    paymentId: number,
    amount: string
  ) => {
    const confirmed = window.confirm(
      `Reverse this payment of ${money(amount)}?\n\n` +
        "The payment will remain in history but will no longer count as paid."
    );

    if (!confirmed) return;

    setReversingPaymentId(paymentId);
    setError("");

    try {
      const response = await fetch(
        `/api/files/${fileId}/payments`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.message ||
            "Unable to reverse payment."
        );
        return;
      }

      await loadPaymentSummary();
    } catch (error) {
      console.error(
        "Reverse payment error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );
    } finally {
      setReversingPaymentId(null);
    }
  };

  const visiblePayments = payments.filter(
    (payment) => payment.status === paymentFilter
  );

  return (
    <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
      {/* Header */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#f9a800]">
            Payments
          </p>

          <h2 className="mt-1 text-lg font-semibold">
            Payment Summary
          </h2>
        </div>

        <button
          type="button"
          onClick={() => {
            setError("");
            setShowPaymentForm(
              (value) => !value
            );
          }}
          className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black"
        >
          {showPaymentForm
            ? "Cancel"
            : "+ Record Payment"}
        </button>
      </div>

      {/* Summary */}

      {summary && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryItem
            label="Service Fees"
            value={money(
              summary.workflowFees
            )}
          />

          <SummaryItem
            label="Extra Charges"
            value={money(
              summary.extraCharges
            )}
          />

          <SummaryItem
            label="Total Amount"
            value={money(
              summary.totalAmount
            )}
          />

          <SummaryItem
            label="Total Paid"
            value={money(
              summary.totalPaid
            )}
          />

          <SummaryItem
            label="Outstanding"
            value={money(
              summary.outstanding
            )}
            highlight
          />
        </div>
      )}

      {/* Error */}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Payment Form */}

      {showPaymentForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-xl border border-black/10 bg-[#fafaf9] p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {/* Amount */}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-black/60">
                Payment Amount *
              </label>

              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value)
                }
                placeholder="0.00"
                className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              />
            </div>

            {/* Payment Method */}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-black/60">
                Payment Method *
              </label>

              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(
                    e.target.value as
                      | "CASH"
                      | "CARD"
                      | "BANK_TRANSFER"
                      | "CHEQUE"
                  )
                }
                className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              >
                <option value="CASH">
                  Cash
                </option>

                <option value="CARD">
                  Card
                </option>

                <option value="BANK_TRANSFER">
                  Bank Transfer
                </option>

                <option value="CHEQUE">
                  Cheque
                </option>
              </select>
            </div>

            {/* Paid Date */}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-black/60">
                Payment Date
              </label>

              <input
                type="date"
                value={paidAt}
                onChange={(e) =>
                  setPaidAt(e.target.value)
                }
                className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              />
            </div>

            {/* Reference */}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-black/60">
                Reference No
              </label>

              <input
                type="text"
                value={referenceNo}
                onChange={(e) =>
                  setReferenceNo(
                    e.target.value
                  )
                }
                placeholder="Optional"
                className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              />
            </div>
          </div>

          {/* Remarks */}

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-black/60">
              Remarks
            </label>

            <textarea
              value={remarks}
              onChange={(e) =>
                setRemarks(e.target.value)
              }
              rows={3}
              placeholder="Optional payment remarks..."
              className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
            />
          </div>

          {/* Form Button */}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-black px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Payment"}
            </button>
          </div>
        </form>
      )}

      <ExtraCharges
        fileId={fileId}
        onChanged={loadPaymentSummary}
      />

      {/* Payment History */}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">
              Payment History
            </h3>

            <p className="mt-1 text-[10px] text-black/35">
              {visiblePayments.length} payment
              {visiblePayments.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor={`payment-status-filter-${fileId}`}
              className="text-xs font-medium text-black/40"
            >
              Show
            </label>

            <select
              id={`payment-status-filter-${fileId}`}
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(
                  e.target.value as
                    | "CLEARED"
                    | "REFUNDED"
                    | "CANCELLED"
                )
              }
              className="h-9 rounded-lg border border-black/10 bg-white px-3 text-xs font-medium text-black/70 outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
            >
              <option value="CLEARED">
                Cleared
              </option>

              <option value="REFUNDED">
                Refunded
              </option>

              <option value="CANCELLED">
                Cancelled
              </option>
            </select>
          </div>
        </div>

        {visiblePayments.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-black/10 bg-[#fafaf9] p-6 text-center">
            <p className="text-sm text-black/40">
              {paymentFilter === "CLEARED"
                ? "No cleared payments recorded yet."
                : paymentFilter === "REFUNDED"
                  ? "No refunded payments."
                  : "No cancelled payments."}
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-black/10 bg-[#fafaf9]">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Date
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Method
                  </th>

                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Amount
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Reference
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Status
                  </th>

                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {visiblePayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-black/5 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-xs text-black/65">
                      {date(payment.paidAt)}
                    </td>

                    <td className="px-4 py-3 text-xs font-medium">
                      {payment.paymentMethod.replaceAll(
                        "_",
                        " "
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {money(payment.amount)}
                    </td>

                    <td className="px-4 py-3 text-xs text-black/50">
                      {payment.referenceNo ||
                        "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-black/[0.05] px-2.5 py-1 text-[10px] font-medium text-black/55">
                        {payment.status === "REFUNDED"
                          ? "Refunded"
                          : payment.status.replaceAll(
                              "_",
                              " "
                            )}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {payment.status === "CLEARED" ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleReversePayment(
                              payment.id,
                              payment.amount
                            )
                          }
                          disabled={
                            reversingPaymentId ===
                            payment.id
                          }
                          className="text-xs font-medium text-black/40 transition hover:text-red-600 disabled:opacity-50"
                        >
                          {reversingPaymentId ===
                          payment.id
                            ? "Reversing..."
                            : "Reverse"}
                        </button>
                      ) : (
                        <span className="text-[10px] text-black/25">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-[#fafaf9] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-black/35">
        {label}
      </p>

      <p
        className={`mt-2 text-base font-semibold ${
          highlight
            ? "text-[#a66f00]"
            : "text-black"
        }`}
      >
        {value}
      </p>
    </div>
  );
}