import Link from "next/link";

import { prisma } from "@/lib/prisma";

type ReceivableRow = {
  id: number;
  clientFileId: number;
  fileNumber: string;
  clientName: string;
  serviceName: string;
  dueDate: Date | null;
  amount: number;
  paid: number;
  balance: number;
  status: "PENDING" | "PARTIALLY_PAID";
};

export default async function InstallmentReceivables() {
  const today = sriLankaStartOfDay(getColomboDateParts(new Date()).date);
  const nextSevenDays = sriLankaStartOfDay(addDays(getColomboDateParts(new Date()).date, 7));

  const installments = await prisma.paymentInstallment.findMany({
    where: {
      status: {
        in: ["PENDING", "PARTIALLY_PAID"],
      },
    },
    orderBy: [
      { dueDate: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
    select: {
      id: true,
      amount: true,
      status: true,
      dueDate: true,
      clientFile: {
        select: {
          id: true,
          fileNumber: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      },
      fileWorkflow: {
        select: {
          workflowTemplate: {
            select: {
              name: true,
            },
          },
        },
      },
      allocations: {
        where: {
          payment: {
            status: "CLEARED",
          },
        },
        select: {
          amount: true,
        },
      },
    },
  });

  const rows: ReceivableRow[] = installments.map((installment) => {
    const amount = Number(installment.amount);
    const paid = roundMoney(
      installment.allocations.reduce(
        (sum, allocation) => sum + Number(allocation.amount),
        0
      )
    );

    return {
      id: installment.id,
      clientFileId: installment.clientFile.id,
      fileNumber: installment.clientFile.fileNumber,
      clientName: installment.clientFile.client.name,
      serviceName:
        installment.fileWorkflow?.workflowTemplate.name ?? "Whole Client File",
      dueDate: installment.dueDate,
      amount,
      paid,
      balance: roundMoney(Math.max(amount - paid, 0)),
      status:
        installment.status === "PARTIALLY_PAID"
          ? "PARTIALLY_PAID"
          : "PENDING",
    };
  });

  const scheduledOutstanding = roundMoney(
    rows.reduce((sum, row) => sum + row.balance, 0)
  );

  const overdueOutstanding = roundMoney(
    rows.reduce((sum, row) => {
      if (!row.dueDate || row.dueDate >= today) return sum;
      return sum + row.balance;
    }, 0)
  );

  const upcomingOutstanding = roundMoney(
    rows.reduce((sum, row) => {
      if (!row.dueDate) return sum;
      if (row.dueDate < today || row.dueDate >= nextSevenDays) return sum;
      return sum + row.balance;
    }, 0)
  );

  return (
    <section className="mt-6 rounded-xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f9a800]">
            Receivables
          </p>
          <h2 className="mt-1 text-sm font-semibold">
            Installment Collections
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-black/40">
            Current unpaid installment balances, including overdue and upcoming
            collections. Cancelled and fully paid installments are excluded.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MiniMetric
            label="Scheduled Balance"
            value={formatLkr(scheduledOutstanding)}
          />
          <MiniMetric
            label="Overdue"
            value={formatLkr(overdueOutstanding)}
          />
          <MiniMetric
            label="Next 7 Days"
            value={formatLkr(upcomingOutstanding)}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 flex min-h-32 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9] px-5 text-center">
          <p className="text-sm text-black/40">
            No outstanding installment receivables.
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full min-w-[1040px]">
            <thead>
              <tr className="border-b border-black/10 bg-[#fafaf9]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  File
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Service
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Due Date
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Amount
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Paid
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Balance
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.slice(0, 20).map((row) => {
                const overdue = Boolean(
                  row.dueDate && row.dueDate < today
                );

                return (
                  <tr
                    key={row.id}
                    className="border-b border-black/5 last:border-b-0 hover:bg-[#fafaf9]"
                  >
                    <td className="px-4 py-3 text-xs font-medium">
                      {row.clientName}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/files/${row.clientFileId}`}
                        className="text-xs font-medium hover:text-[#b77900]"
                      >
                        {row.fileNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-black/55">
                      {row.serviceName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-black/60">
                        {row.dueDate ? formatDate(row.dueDate) : "No due date"}
                      </div>
                      {overdue ? (
                        <span className="mt-1 inline-flex rounded-full bg-[#fff0f0] px-2 py-0.5 text-[9px] font-semibold text-[#9b4141]">
                          Overdue
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-black/60">
                      {formatLkr(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-black/55">
                      {formatLkr(row.paid)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold">
                      {formatLkr(row.balance)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                          row.status === "PARTIALLY_PAID"
                            ? "bg-[#fff7e6] text-[#a56e00]"
                            : "bg-black/[0.05] text-black/55"
                        }`}
                      >
                        {row.status === "PARTIALLY_PAID"
                          ? "Partially Paid"
                          : "Pending"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 20 ? (
        <p className="mt-3 text-[10px] text-black/30">
          Showing the first 20 of {rows.length} outstanding installments on the
          dashboard. Open the relevant client file to view the full schedule.
        </p>
      ) : null}
    </section>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[150px] rounded-lg border border-black/10 bg-[#fafaf9] px-3 py-2.5">
      <p className="text-[10px] font-medium text-black/40">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function sriLankaStartOfDay(dateString: string) {
  return new Date(`${dateString}T00:00:00+05:30`);
}

function addDays(dateString: string, days: number) {
  const date = sriLankaStartOfDay(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return getColomboDateParts(date).date;
}

function getColomboDateParts(date: Date) {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    formatted
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
  };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).format(date);
}

function formatLkr(value: number) {
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
