"use client";

import Link from "next/link";
import { useState } from "react";

type PaymentRow = {
  id: number;
  amount: number;
  paymentMethod: string;
  status: string;
  referenceNo: string | null;
  paidAt: string;
  clientFile: {
    id: number;
    fileNumber: string;
    title: string;
    client: {
      id: number;
      name: string;
    };
  };
};

type Props = {
  initialPayments: PaymentRow[];
  initialTotal: number;
  pageSize: number;
  from: string;
  to: string;
  status: "ALL" | "CLEARED" | "REFUNDED" | "CANCELLED";
  search: string;
};

export default function PaymentHistory({
  initialPayments,
  initialTotal,
  pageSize,
  from,
  to,
  status,
  search,
}: Props) {
  const [payments, setPayments] = useState(initialPayments);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function loadPage(nextPage: number) {
    if (
      loading ||
      nextPage < 1 ||
      nextPage > totalPages ||
      nextPage === page
    ) {
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        from,
        to,
        status,
        page: String(nextPage),
        pageSize: String(pageSize),
      });

      if (search) {
        params.set("search", search);
      }

      const response = await fetch(`/api/finance/transactions?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load transactions.");
      }

      const data = (await response.json()) as {
        payments: PaymentRow[];
        total: number;
        page: number;
        pageSize: number;
      };

      setPayments(data.payments);
      setTotal(data.total);
      setPage(data.page);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 px-5 py-5 sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b77900]">
            Transactions
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Payment history
          </h2>
          <p className="mt-1 text-xs text-black/40">
            {status === "ALL"
              ? "All"
              : status === "CLEARED"
                ? "Cleared"
                : status === "REFUNDED"
                  ? "Refunded"
                  : "Cancelled"}{" "}
            payment activity in the selected period.
          </p>
        </div>

        <div className="rounded-xl bg-[#f6f6f4] px-3 py-2 text-right">
          <p className="text-[9px] uppercase tracking-wider text-black/35">
            Showing
          </p>
          <p className="mt-0.5 text-sm font-bold">
            {total} transaction{total === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="p-5 sm:p-6">
          <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-black/10 bg-[#fafaf8] px-5 text-center">
            <p className="text-xs text-black/35">
              No payment activity found for the selected filters.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="relative overflow-x-auto">
            {loading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                <div className="rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white shadow-lg">
                  Loading...
                </div>
              </div>
            ) : null}

            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="bg-[#fafaf8] text-left">
                  <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                    Date
                  </th>
                  <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                    Client
                  </th>
                  <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                    File
                  </th>
                  <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                    Method
                  </th>
                  <th className="px-5 py-3 text-right text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                    Reference
                  </th>
                  <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-t border-black/5 transition hover:bg-[#fcfcfa]"
                  >
                    <td className="px-5 py-4 text-xs text-black/55">
                      {formatDateTime(payment.paidAt)}
                    </td>

                    <td className="px-5 py-4 text-xs font-semibold">
                      {payment.clientFile.client.name}
                    </td>

                    <td className="px-5 py-4">
                      <Link
                        href={`/files/${payment.clientFile.id}`}
                        className="text-xs font-semibold hover:text-[#b77900]"
                      >
                        {payment.clientFile.fileNumber}
                      </Link>
                      <p className="mt-0.5 max-w-[240px] truncate text-[10px] text-black/35">
                        {payment.clientFile.title}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-xs text-black/55">
                      {formatPaymentMethod(payment.paymentMethod)}
                    </td>

                    <td className="px-5 py-4 text-right text-xs font-bold">
                      {formatLkr(payment.amount)}
                    </td>

                    <td className="px-5 py-4 text-xs text-black/45">
                      {payment.referenceNo || "—"}
                    </td>

                    <td className="px-5 py-4">
                      <PaymentBadge status={payment.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-black/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-[10px] text-black/40">
              Showing {startItem}-{endItem} of {total} transaction
              {total === 1 ? "" : "s"}
            </p>

            <div className="flex items-center gap-1.5">
              <PaginationButton
                label="First"
                disabled={page === 1 || loading}
                onClick={() => loadPage(1)}
              />
              <PaginationButton
                label="Previous"
                disabled={page === 1 || loading}
                onClick={() => loadPage(page - 1)}
              />

              <span className="mx-1 min-w-[82px] text-center text-[10px] font-semibold text-black/55">
                Page {page} of {totalPages}
              </span>

              <PaginationButton
                label="Next"
                disabled={page === totalPages || loading}
                onClick={() => loadPage(page + 1)}
              />
              <PaginationButton
                label="Last"
                disabled={page === totalPages || loading}
                onClick={() => loadPage(totalPages)}
              />
            </div>
          </div>
        </>
      )}

      <div className="border-t border-black/5 px-5 py-3 sm:px-6">
        <p className="text-[10px] leading-5 text-black/35">
          Cleared payments are included in Received. Refunded payments are
          excluded from Received and remain visible here for reconciliation.
        </p>
      </div>
    </section>
  );
}

function PaginationButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 rounded-lg border border-black/10 bg-black px-3 text-[10px] font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:cursor-not-allowed disabled:border-black/5 disabled:bg-black/5 disabled:text-black/25"
    >
      {label}
    </button>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const className =
    status === "CLEARED"
      ? "bg-[#edf7e7] text-[#456a29]"
      : status === "REFUNDED"
        ? "bg-[#fff5df] text-[#986600]"
        : "bg-[#f8eaea] text-[#974848]";

  const label =
    status === "CLEARED"
      ? "Cleared"
      : status === "REFUNDED"
        ? "Refunded"
        : "Cancelled";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Colombo",
  }).format(new Date(value));
}

function formatLkr(value: number) {
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatPaymentMethod(method: string) {
  switch (method) {
    case "BANK_TRANSFER":
      return "Bank Transfer";
    case "CASH":
      return "Cash";
    case "CARD":
      return "Card";
    case "CHEQUE":
      return "Cheque";
    default:
      return method;
  }
}
