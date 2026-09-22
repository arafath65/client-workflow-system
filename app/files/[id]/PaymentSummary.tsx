"use client";

import ExtraCharges from "./ExtraCharges";
import { FormEvent, useEffect, useState } from "react";

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
  clientName: string;
  whatsapp: string | null;
  fileNumber: string;
};

export default function PaymentSummary({
  fileId,
  clientName,
  whatsapp,
  fileNumber,
}: PaymentSummaryProps) {
  const [summary, setSummary] =
    useState<Summary | null>(null);

  const [payments, setPayments] =
    useState<Payment[]>([]);

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
    useState<"CLEARED" | "CANCELLED" | "REFUNDED">(
      "CLEARED"
    );

  const [paidAt, setPaidAt] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  // --------------------------------------------------
  // Load payment summary
  // --------------------------------------------------

  const loadPaymentSummary = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/files/${fileId}/payments`,
        { cache: "no-store" }
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
  };

  useEffect(() => {
    loadPaymentSummary();
  }, [fileId]);

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

  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  // --------------------------------------------------
  // Normalize Sri Lankan WhatsApp numbers
  // --------------------------------------------------

  const getWhatsAppNumber = () => {
    if (!whatsapp) return "";

    let phone = whatsapp.replace(/\D/g, "");

    // Convert local Sri Lankan number:
    // 0771234567 -> 94771234567
    if (phone.startsWith("0")) {
      phone = "94" + phone.substring(1);
    }

    return phone;
  };

  // --------------------------------------------------
  // Generate printable receipt
  // --------------------------------------------------

  const generateReceipt = (payment: Payment) => {
    const receiptWindow = window.open(
      "",
      "_blank",
      "width=800,height=700"
    );

    if (!receiptWindow) {
      alert(
        "Please allow pop-ups in your browser to generate the receipt."
      );
      return;
    }

    const safeClientName =
      escapeHtml(clientName);

    const safeFileNumber =
      escapeHtml(fileNumber);

    const safeMethod = escapeHtml(
      payment.paymentMethod.replaceAll("_", " ")
    );

    const safeReference = escapeHtml(
      payment.referenceNo || "—"
    );

    const safeRemarks = escapeHtml(
      payment.remarks || "—"
    );

    const receiptDate = date(payment.paidAt);

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt-${safeFileNumber}-${payment.id}</title>
          <meta charset="UTF-8" />
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #222;
              background: #fff;
            }

            .receipt {
              max-width: 700px;
              margin: 0 auto;
              border: 1px solid #ddd;
              padding: 36px;
            }

            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 20px;
            }

            h1 {
              margin: 0;
              font-size: 26px;
            }

            .muted {
              color: #666;
              font-size: 13px;
            }

            .row {
              display: flex;
              justify-content: space-between;
              gap: 20px;
              padding: 13px 0;
              border-bottom: 1px solid #eee;
              font-size: 14px;
            }

            .row span {
              color: #666;
            }

            .amount {
              font-size: 25px;
              font-weight: bold;
            }

            .footer {
              margin-top: 35px;
              font-size: 12px;
              color: #777;
            }

            @media print {
              body {
                padding: 0;
              }

              .receipt {
                border: none;
                max-width: none;
              }
            }
          </style>
        </head>

        <body>
          <div class="receipt">
            <div class="header">
              <div>
                <h1>PAYMENT RECEIPT</h1>
                <p class="muted">A&I Global</p>
              </div>

              <div style="text-align:right">
                <p class="muted">Receipt No.</p>
                <strong>${payment.id}</strong>
              </div>
            </div>

            <hr />

            <div class="row">
              <span>Client Name</span>
              <strong>${safeClientName}</strong>
            </div>

            <div class="row">
              <span>File Number</span>
              <strong>${safeFileNumber}</strong>
            </div>

            <div class="row">
              <span>Payment Date</span>
              <strong>${receiptDate}</strong>
            </div>

            <div class="row">
              <span>Payment Method</span>
              <strong>${safeMethod}</strong>
            </div>

            <div class="row">
              <span>Reference Number</span>
              <strong>${safeReference}</strong>
            </div>

            <div class="row">
              <span>Remarks</span>
              <strong>${safeRemarks}</strong>
            </div>

            <div class="row">
              <span>Amount Received</span>
              <strong class="amount">
                LKR ${money(payment.amount)}
              </strong>
            </div>

            <div class="footer">
              <p>Thank you for your payment.</p>
              <p>A&I Global</p>
            </div>
          </div>

          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    receiptWindow.document.close();
  };

  // --------------------------------------------------
  // Send payment summary through WhatsApp
  // --------------------------------------------------

  const sendPaymentSummaryWhatsApp = () => {
    const phone = getWhatsAppNumber();

    if (!phone) {
      alert(
        "This client does not have a WhatsApp number saved."
      );
      return;
    }

    if (!summary) {
      alert("Payment summary is not available.");
      return;
    }

    const message = [
      `Hello ${clientName},`,
      "",
      `Payment summary for file ${fileNumber}:`,
      "",
      `Service Fees: LKR ${money(summary.workflowFees)}`,
      `Extra Charges: LKR ${money(summary.extraCharges)}`,
      `Total Amount: LKR ${money(summary.totalAmount)}`,
      `Total Paid: LKR ${money(summary.totalPaid)}`,
      `Outstanding Balance: LKR ${money(summary.outstanding)}`,
      "",
      "Thank you.",
      "A&I Global",
    ].join("\n");

    const url =
      `https://wa.me/${phone}?text=` +
      encodeURIComponent(message);

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  };

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
      !/^\d+(?:\.\d{1,2})?$/.test(cleanAmount) ||
      Number(cleanAmount) <= 0
    ) {
      setError("Enter a valid payment amount.");
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

      const savedPayment =
        data.payment as Payment | undefined;

      setAmount("");
      setPaymentMethod("CASH");
      setPaidAt("");
      setReferenceNo("");
      setRemarks("");
      setShowPaymentForm(false);

      await loadPaymentSummary();

      if (
        savedPayment &&
        window.confirm(
          "Payment saved successfully. Do you want to generate the receipt PDF now?"
        )
      ) {
        generateReceipt(savedPayment);
      }
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
  // Reverse payment
  // --------------------------------------------------

  const handleReversePayment = async (
    paymentId: number,
    paymentAmount: string
  ) => {
    const confirmed = window.confirm(
      `Reverse this payment of ${money(paymentAmount)}?\n\n` +
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
    (payment) =>
      payment.status === paymentFilter
  );

  // --------------------------------------------------
  // Loading UI
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

  // --------------------------------------------------
  // Main UI
  // --------------------------------------------------

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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={sendPaymentSummaryWhatsApp}
            className="rounded-lg border border-green-600 px-4 py-2.5 text-xs font-semibold text-green-700 transition hover:bg-green-50"
          >
            Send Payment Summary
          </button>

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
      </div>

      {/* Summary */}

      {summary && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryItem
            label="Service Fees"
            value={money(summary.workflowFees)}
          />

          <SummaryItem
            label="Extra Charges"
            value={money(summary.extraCharges)}
          />

          <SummaryItem
            label="Total Amount"
            value={money(summary.totalAmount)}
          />

          <SummaryItem
            label="Total Paid"
            value={money(summary.totalPaid)}
          />

          <SummaryItem
            label="Outstanding"
            value={money(summary.outstanding)}
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
                required
                className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              />
            </div>

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
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">
                  Bank Transfer
                </option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

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

            <div>
              <label className="mb-1.5 block text-xs font-medium text-black/60">
                Reference No
              </label>

              <input
                type="text"
                value={referenceNo}
                onChange={(e) =>
                  setReferenceNo(e.target.value)
                }
                placeholder="Optional"
                className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              />
            </div>
          </div>

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

      {/* Extra Charges */}

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
              {visiblePayments.length === 1
                ? ""
                : "s"}
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
                      {payment.referenceNo || "—"}
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

// --------------------------------------------------
// Summary Item
// --------------------------------------------------

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