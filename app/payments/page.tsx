import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import Navigation from "../components/Navigation";
import LogoutButton from "../dashboard/LogoutButton";
import { prisma } from "@/lib/prisma";
import ExpenseManager from "./ExpenseManager";
import FinanceQuickRange from "./FinanceQuickRange";

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

type MonthlyPoint = {
  key: string;
  label: string;
  amount: number;
};

type ReceivableRow = {
  fileId: number;
  clientId: number;
  fileNumber: string;
  title: string;
  clientName: string;
  billed: number;
  paid: number;
  due: number;
  lastPaymentAt: string | null;
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // --------------------------------------------------
  // Authentication
  // --------------------------------------------------
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("session_user");

  if (!sessionUser?.value) {
    redirect("/login");
  }

  const userId = Number(sessionUser.value);

  if (!Number.isInteger(userId)) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      username: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  // --------------------------------------------------
  // Date range + filters
  // --------------------------------------------------
  const rawParams = await searchParams;
  const nowColombo = getColomboDateParts(new Date());
  const currentMonthStart = `${nowColombo.year}-${nowColombo.month}-01`;
  const currentMonthEnd = getLastDayOfMonth(
    Number(nowColombo.year),
    Number(nowColombo.month)
  );

  const lastMonth = getPreviousMonth(
    Number(nowColombo.year),
    Number(nowColombo.month)
  );
  const lastMonthStart = `${lastMonth.year}-${pad2(lastMonth.month)}-01`;
  const lastMonthEnd = getLastDayOfMonth(
    lastMonth.year,
    lastMonth.month
  );

  const lastTwelveMonthsStart = getMonthStartYearsAgo(1);
  const lastTwelveMonthsEnd = nowColombo.date;

  const rawFrom = getParam(rawParams.from);
  const rawTo = getParam(rawParams.to);
  const from = isDateString(rawFrom)
    ? rawFrom
    : currentMonthStart;
  const to = isDateString(rawTo)
    ? rawTo
    : currentMonthEnd;

  const normalizedRange = normalizeDateRange(from, to);
  const rangeStart = sriLankaStartOfDay(normalizedRange.from);
  const rangeEndExclusive = sriLankaStartOfDay(addDays(normalizedRange.to, 1));

  const rawStatus = getParam(rawParams.status);
  const status =
    rawStatus === "CLEARED" ||
    rawStatus === "REFUNDED" ||
    rawStatus === "CANCELLED"
      ? rawStatus
      : "ALL";
  const search = getParam(rawParams.search).trim();

  // --------------------------------------------------
  // Selected-period files
  //
  // Billed = current value of workflows + file charges
  // on files opened in the selected date range.
  // Received = all CLEARED payments against those files.
  // Refunded = all REFUNDED payments against those files.
  // Due = current outstanding balance; cancelled files are always 0 due.
  // --------------------------------------------------
  const selectedFiles = await prisma.clientFile.findMany({
    where: {
      createdAt: {
        gte: rangeStart,
        lt: rangeEndExclusive,
      },
    },
    select: {
      id: true,
      clientId: true,
      fileNumber: true,
      title: true,
      status: true,
      createdAt: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      fileWorkflows: {
        select: {
          finalAmount: true,
        },
      },
      charges: {
        select: {
          totalAmount: true,
        },
      },
      payments: {
        where: {
          status: {
            in: ["CLEARED", "REFUNDED"],
          },
        },
        select: {
          amount: true,
          status: true,
          paidAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // --------------------------------------------------
  // Cleared payments received in selected period
  // --------------------------------------------------
  const periodClearedPayments = await prisma.payment.findMany({
    where: {
      status: "CLEARED",
      paidAt: {
        gte: rangeStart,
        lt: rangeEndExclusive,
      },
    },
    select: {
      id: true,
      amount: true,
      paidAt: true,
    },
    orderBy: {
      paidAt: "asc",
    },
  });

  // --------------------------------------------------
  // Refunded payments in selected period
  // --------------------------------------------------
  const periodRefundedPayments = await prisma.payment.findMany({
    where: {
      status: "REFUNDED",
      paidAt: {
        gte: rangeStart,
        lt: rangeEndExclusive,
      },
    },
    select: {
      id: true,
      amount: true,
      paidAt: true,
    },
    orderBy: {
      paidAt: "asc",
    },
  });

  // --------------------------------------------------
  // Expenses in selected period
  // --------------------------------------------------
  const periodExpenses = await prisma.expense.findMany({
    where: {
      expenseDate: {
        gte: rangeStart,
        lt: rangeEndExclusive,
      },
      ...(search
        ? {
            OR: [
              { category: { contains: search } },
              { description: { contains: search } },
              { referenceNo: { contains: search } },
              { remarks: { contains: search } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      expenseDate: true,
      category: true,
      description: true,
      amount: true,
      paymentMethod: true,
      referenceNo: true,
      remarks: true,
      createdBy: {
        select: {
          username: true,
        },
      },
    },
    orderBy: {
      expenseDate: "desc",
    },
    take: 250,
  });

  // --------------------------------------------------
  // Payment history in selected period
  // --------------------------------------------------
  const historyPayments = await prisma.payment.findMany({
    where: {
      ...(status === "ALL"
        ? {
            status: {
              in: ["CLEARED", "REFUNDED", "CANCELLED"],
            },
          }
        : {
            status,
          }),
      paidAt: {
        gte: rangeStart,
        lt: rangeEndExclusive,
      },
      ...(search
        ? {
            OR: [
              {
                clientFile: {
                  fileNumber: {
                    contains: search,
                  },
                },
              },
              {
                clientFile: {
                  title: {
                    contains: search,
                  },
                },
              },
              {
                clientFile: {
                  client: {
                    name: {
                      contains: search,
                    },
                  },
                },
              },
              {
                referenceNo: {
                  contains: search,
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      amount: true,
      paymentMethod: true,
      status: true,
      referenceNo: true,
      remarks: true,
      paidAt: true,
      clientFile: {
        select: {
          id: true,
          fileNumber: true,
          title: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      paidAt: "desc",
    },
    take: 250,
  });

  // --------------------------------------------------
  // Financial totals
  // --------------------------------------------------
  let totalBilled = 0;
  let totalDue = 0;

  for (const file of selectedFiles) {
    const workflowTotal = file.fileWorkflows.reduce(
      (sum, workflow) => sum + Number(workflow.finalAmount),
      0
    );

    const extraChargeTotal = file.charges.reduce(
      (sum, charge) => sum + Number(charge.totalAmount),
      0
    );

    const billed = roundMoney(workflowTotal + extraChargeTotal);
    const received = roundMoney(
      file.payments
        .filter((payment) => payment.status === "CLEARED")
        .reduce((sum, payment) => sum + Number(payment.amount), 0)
    );

    const due =
      file.status === "CANCELLED"
        ? 0
        : roundMoney(Math.max(billed - received, 0));

    totalBilled += billed;
    totalDue += due;
  }

  totalBilled = roundMoney(totalBilled);
  totalDue = roundMoney(totalDue);

  const totalIncome = roundMoney(
    periodClearedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    )
  );

  const totalRefunded = roundMoney(
    periodRefundedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    )
  );

  const totalExpenses = roundMoney(
    periodExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount),
      0
    )
  );

  const netIncome = roundMoney(totalIncome - totalRefunded);
  const totalProfit = roundMoney(netIncome - totalExpenses);

  const receivables: ReceivableRow[] = selectedFiles
    .flatMap((file) => {
      const workflowTotal = file.fileWorkflows.reduce(
        (sum, workflow) => sum + Number(workflow.finalAmount),
        0
      );

      const extraChargeTotal = file.charges.reduce(
        (sum, charge) => sum + Number(charge.totalAmount),
        0
      );

      const billed = roundMoney(workflowTotal + extraChargeTotal);
      const paid = roundMoney(
        file.payments
          .filter((payment) => payment.status === "CLEARED")
          .reduce((sum, payment) => sum + Number(payment.amount), 0)
      );

      const due =
        file.status === "CANCELLED"
          ? 0
          : roundMoney(Math.max(billed - paid, 0));

      const clearedPayments = file.payments.filter(
        (payment) => payment.status === "CLEARED"
      );

      const lastPaymentAt =
        clearedPayments.length > 0
          ? clearedPayments.reduce(
              (latest, payment) =>
                payment.paidAt > latest ? payment.paidAt : latest,
              clearedPayments[0].paidAt
            )
          : null;

      if (due <= 0) {
        return [];
      }

      return [
        {
          fileId: file.id,
          clientId: file.client.id,
          fileNumber: file.fileNumber,
          title: file.title,
          clientName: file.client.name,
          billed,
          paid,
          due,
          lastPaymentAt: lastPaymentAt?.toISOString() ?? null,
        },
      ];
    })
    .sort(
      (a, b) => b.due - a.due || a.clientName.localeCompare(b.clientName)
    );

  const monthlyGrowth = buildMonthlySeries(
    periodClearedPayments,
    normalizedRange.from,
    normalizedRange.to
  );

  const selectedRangeLabel = formatDisplayRange(
    normalizedRange.from,
    normalizedRange.to
  );

  const outstandingCount = receivables.length;
  const selectedFileCount = selectedFiles.length;
  const transactionCount = historyPayments.length;
  const expenseCount = periodExpenses.length;

  return (
    <main className="min-h-screen bg-[#f4f4f1] text-[#171717]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black">
              <span className="text-[11px] font-extrabold tracking-tight text-[#f9a800]">
                A&I
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">A&I Global</p>
              <p className="mt-1 text-[10px] text-black/40">
                Client Workflow System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-[10px] uppercase tracking-wider text-black/35">
                Signed in as
              </p>
              <p className="text-xs font-semibold">{user.username}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <Navigation currentPage="finance" />

      <section className="mx-auto max-w-[1480px] px-5 py-6 sm:px-8 sm:py-8">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl bg-black shadow-[0_18px_55px_rgba(0,0,0,0.09)]">
          <div className="relative px-6 py-7 sm:px-8 sm:py-8">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#f9a800]/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-white/[0.04] blur-2xl" />

            <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f9a800]" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#f9a800]">
                    Finance dashboard
                  </p>
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Financial Overview
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
                  Monitor revenue, collections, outstanding balances, refunds,
                  expenses and profit for the selected period.
                </p>
              </div>

              <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left lg:text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Selected period
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {selectedRangeLabel}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <form
          method="get"
          className="relative z-10 -mt-5 rounded-2xl border border-black/10 bg-white p-4 shadow-[0_14px_40px_rgba(0,0,0,0.06)] sm:p-5"
        >
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_2fr_auto]">
            <FilterField label="From">
              <input
                name="from"
                type="date"
                defaultValue={normalizedRange.from}
                className="h-10 w-full rounded-xl border border-black/10 bg-[#fafaf8] px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/15"
              />
            </FilterField>

            <FilterField label="To">
              <input
                name="to"
                type="date"
                defaultValue={normalizedRange.to}
                className="h-10 w-full rounded-xl border border-black/10 bg-[#fafaf8] px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/15"
              />
            </FilterField>

            <FilterField label="Payment status">
              <select
                name="status"
                defaultValue={status}
                className="h-10 w-full rounded-xl border border-black/10 bg-[#fafaf8] px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/15"
              >
                <option value="ALL">All transactions</option>
                <option value="CLEARED">Cleared</option>
                <option value="REFUNDED">Refunded</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </FilterField>

            <FilterField label="Search">
              <input
                name="search"
                type="text"
                defaultValue={search}
                placeholder="Client, file number, service or reference..."
                className="h-10 w-full rounded-xl border border-black/10 bg-[#fafaf8] px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/15"
              />
            </FilterField>

            <button
              type="submit"
              className="h-10 self-end rounded-xl bg-[#f9a800] px-5 text-xs font-bold text-black transition hover:bg-black hover:text-white"
            >
              Apply
            </button>
          </div>

          <FinanceQuickRange
            currentMonthStart={currentMonthStart}
            currentMonthEnd={currentMonthEnd}
            lastMonthStart={lastMonthStart}
            lastMonthEnd={lastMonthEnd}
            lastTwelveMonthsStart={lastTwelveMonthsStart}
            lastTwelveMonthsEnd={lastTwelveMonthsEnd}
          />
        </form>

        {/* KPI row */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            eyebrow="Billed"
            title="Total billed"
            value={formatLkr(totalBilled)}
            subtitle={`${selectedFileCount} file${selectedFileCount === 1 ? "" : "s"} opened in range`}
            tone="neutral"
          />
          <MetricCard
            eyebrow="Received"
            title="Money received"
            value={formatLkr(totalIncome)}
            subtitle={`${periodClearedPayments.length} cleared transaction${periodClearedPayments.length === 1 ? "" : "s"}`}
            tone="positive"
          />
          <MetricCard
            eyebrow="Outstanding"
            title="Amount due"
            value={formatLkr(totalDue)}
            subtitle={`${outstandingCount} open balance${outstandingCount === 1 ? "" : "s"}`}
            tone="warning"
          />
          <MetricCard
            eyebrow="Expenses"
            title="Business expenses"
            value={formatLkr(totalExpenses)}
            subtitle={`${expenseCount} expense entr${expenseCount === 1 ? "y" : "ies"}`}
            tone="expense"
          />
          <MetricCard
            eyebrow="Profit"
            title="Net profit"
            value={formatLkr(totalProfit)}
            subtitle="Received − refunds − expenses"
            tone="accent"
          />
        </div>

        {/* Main analysis */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.75fr_1fr]">
          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b77900]">
                  Cash movement
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">
                  Income trend
                </h2>
                <p className="mt-1 text-xs leading-5 text-black/40">
                  Cleared payments received during the selected period.
                </p>
              </div>
              <span className="rounded-full border border-black/10 bg-[#fafaf8] px-3 py-1.5 text-[10px] font-semibold text-black/45">
                {monthlyGrowth.length} month{monthlyGrowth.length === 1 ? "" : "s"}
              </span>
            </div>
            <MonthlyPaymentChart points={monthlyGrowth} />
          </section>

          <section className="rounded-2xl border border-black/10 bg-black p-5 text-white shadow-sm sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f9a800]">
              Financial snapshot
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              Where the money went
            </h2>

            <div className="mt-6 space-y-5">
              <SnapshotLine label="Total billed" value={totalBilled} />
              <SnapshotLine label="Received" value={totalIncome} strong />
              <SnapshotLine label="Refunded" value={totalRefunded} />
              <SnapshotLine label="Expenses" value={totalExpenses} />
              <div className="border-t border-white/10 pt-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                      Net profit
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-[#f9a800]">
                      {formatLkr(totalProfit)}
                    </p>
                  </div>
                  <p className="max-w-[130px] text-right text-[10px] leading-4 text-white/35">
                    Income after refunds and business expenses.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Snapshot tiles */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Files in period" value={selectedFileCount.toString()} />
          <MiniStat label="Transactions" value={transactionCount.toString()} />
          <MiniStat label="Outstanding files" value={outstandingCount.toString()} />
          <MiniStat label="Expense entries" value={expenseCount.toString()} />
        </div>

        {/* Outstanding */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 px-5 py-5 sm:px-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b77900]">
                Receivables
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Outstanding balances
              </h2>
              <p className="mt-1 text-xs text-black/40">
                Files with money still to be collected.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#fff8e8] px-3 py-2 text-right">
                <p className="text-[9px] uppercase tracking-wider text-[#a56e00]">
                  Outstanding
                </p>
                <p className="mt-0.5 text-sm font-bold text-[#8d6000]">
                  {formatLkr(totalDue)}
                </p>
              </div>
              <div className="rounded-xl bg-[#f6f6f4] px-3 py-2 text-right">
                <p className="text-[9px] uppercase tracking-wider text-black/35">
                  Files
                </p>
                <p className="mt-0.5 text-sm font-bold">{outstandingCount}</p>
              </div>
            </div>
          </div>

          {receivables.length === 0 ? (
            <EmptyState message="No outstanding balances for the selected range." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-[#fafaf8] text-left">
                    <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                      Client
                    </th>
                    <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                      File
                    </th>
                    <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                      Billed
                    </th>
                    <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                      Paid
                    </th>
                    <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                      Outstanding
                    </th>
                    <th className="px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/35">
                      Last payment
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.map((row) => (
                    <tr
                      key={row.fileId}
                      className="border-t border-black/5 transition hover:bg-[#fcfcfa]"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/clients/${row.clientId}`}
                          className="text-xs font-semibold hover:text-[#b77900]"
                        >
                          {row.clientName}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/files/${row.fileId}`}
                          className="text-xs font-semibold hover:text-[#b77900]"
                        >
                          {row.fileNumber}
                        </Link>
                        <p className="mt-0.5 max-w-[260px] truncate text-[10px] text-black/35">
                          {row.title}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium">
                        {formatLkr(row.billed)}
                      </td>
                      <td className="px-5 py-4 text-xs text-black/55">
                        {formatLkr(row.paid)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#fff4de] px-2.5 py-1 text-[10px] font-bold text-[#986600]">
                          {formatLkr(row.due)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-black/45">
                        {row.lastPaymentAt ? formatDateTime(new Date(row.lastPaymentAt)) : "No payment yet"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Expense manager */}
        <section className="mt-6 rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/10 px-5 py-5 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b77900]">
              Operating costs
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Expenses</h2>
            <p className="mt-1 text-xs text-black/40">
              Record and manage business expenses for the selected period.
            </p>
          </div>
          <div className="p-0">
            <ExpenseManager
              initialExpenses={periodExpenses.map((expense) => ({
                id: expense.id,
                expenseDate: expense.expenseDate.toISOString(),
                category: expense.category,
                description: expense.description,
                amount: Number(expense.amount),
                paymentMethod: expense.paymentMethod,
                referenceNo: expense.referenceNo,
                remarks: expense.remarks,
                createdByName: expense.createdBy.username,
              }))}
              totalExpenses={totalExpenses}
            />
          </div>
        </section>

        {/* Transactions */}
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
                      : "Cancelled"} payment activity in the selected period.
              </p>
            </div>
            <div className="rounded-xl bg-[#f6f6f4] px-3 py-2 text-right">
              <p className="text-[9px] uppercase tracking-wider text-black/35">
                Showing
              </p>
              <p className="mt-0.5 text-sm font-bold">
                {historyPayments.length} transaction{historyPayments.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {historyPayments.length === 0 ? (
            <EmptyState message="No payment activity found for the selected filters." />
          ) : (
            <div className="overflow-x-auto">
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
                  {historyPayments.map((payment) => (
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
                        {formatLkr(Number(payment.amount))}
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
          )}

          <div className="border-t border-black/5 px-5 py-3 sm:px-6">
            <p className="text-[10px] leading-5 text-black/35">
              Cleared payments are included in Received. Refunded payments are
              excluded from Received and remain visible here for reconciliation.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-black/35">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({
  eyebrow,
  title,
  value,
  subtitle,
  tone,
}: {
  eyebrow: string;
  title: string;
  value: string;
  subtitle: string;
  tone: "neutral" | "positive" | "warning" | "expense" | "accent";
}) {
  const accentClass = {
    neutral: "bg-[#f9a800] text-black",
    positive: "bg-[#edf7e7] text-[#456a29]",
    warning: "bg-[#fff5df] text-[#996600]",
    expense: "bg-[#f6f0eb] text-[#755945]",
    accent: "bg-black text-[#f9a800]",
  }[tone];

  return (
    <div className="group rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-black/30">
            {eyebrow}
          </p>
          <p className="mt-1 text-xs font-semibold text-black/70">{title}</p>
        </div>
        <span className={`h-8 min-w-8 rounded-lg px-2 py-2 text-center text-[9px] font-bold ${accentClass}`}>
          {tone === "positive" ? "IN" : tone === "warning" ? "DUE" : tone === "expense" ? "OUT" : tone === "accent" ? "NET" : "LKR"}
        </span>
      </div>
      <p className="mt-5 break-words text-[22px] font-semibold tracking-tight sm:text-2xl">
        {value}
      </p>
      <p className="mt-1.5 text-[10px] leading-4 text-black/35">{subtitle}</p>
    </div>
  );
}

function SnapshotLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-white/45">{label}</span>
      <span className={`text-sm ${strong ? "font-semibold text-white" : "font-medium text-white/75"}`}>
        {formatLkr(value)}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 shadow-sm">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-black/30">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{value}</p>
    </div>
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
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

/* --------------------------------------------------
   Monthly payment chart
-------------------------------------------------- */

function MonthlyPaymentChart({ points }: { points: MonthlyPoint[] }) {
  if (points.length === 0) {
    return (
      <EmptyState message="No cleared payments in the selected date range." />
    );
  }

  const width = Math.max(760, points.length * 88);
  const height = 300;
  const paddingLeft = 58;
  const paddingRight = 28;
  const paddingTop = 28;
  const paddingBottom = 46;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...points.map((point) => point.amount), 1);
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  const coords = points.map((point, index) => {
    const x =
      paddingLeft +
      (points.length === 1
        ? plotWidth / 2
        : (index / (points.length - 1)) * plotWidth);
    const y = paddingTop + plotHeight - (point.amount / maxValue) * plotHeight;
    return { ...point, x, y };
  });

  const polyline = coords.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-black/5 bg-[#fbfbf8]">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Monthly income chart"
        className="block min-w-full"
      >
        {gridSteps.map((fraction) => {
          const y = paddingTop + plotHeight - fraction * plotHeight;
          const label = formatCompactLkr(maxValue * fraction);

          return (
            <g key={fraction}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                stroke="rgba(0,0,0,0.08)"
                strokeWidth="1"
                strokeDasharray={fraction === 0 ? undefined : "4 4"}
              />
              <text
                x={paddingLeft - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="rgba(0,0,0,0.35)"
              >
                {label}
              </text>
            </g>
          );
        })}

        {coords.length > 1 ? (
          <polyline
            points={polyline}
            fill="none"
            stroke="#f9a800"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {coords.map((point) => (
          <g key={point.key}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4.5"
              fill="#171717"
              stroke="#f9a800"
              strokeWidth="2"
            />
            <text
              x={point.x}
              y={point.y - 12}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#171717"
            >
              {formatCompactLkr(point.amount)}
            </text>
            <text
              x={point.x}
              y={height - 16}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(0,0,0,0.45)"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* --------------------------------------------------
   Empty state
-------------------------------------------------- */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-black/10 bg-[#fafaf8] px-5 text-center">
      <p className="text-xs text-black/35">{message}</p>
    </div>
  );
}

/* --------------------------------------------------
   Data helpers
-------------------------------------------------- */

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeDateRange(from: string, to: string) {
  return from <= to
    ? { from, to }
    : { from: to, to: from };
}

function sriLankaStartOfDay(dateString: string) {
  return new Date(`${dateString}T00:00:00+05:30`);
}

function addDays(dateString: string, days: number) {
  const date = sriLankaStartOfDay(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

function toDateString(date: Date) {
  const parts = getColomboDateParts(date);
  return parts.date;
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
    year: values.year,
    month: values.month,
    date: `${values.year}-${values.month}-${values.day}`,
  };
}

function getLastDayOfMonth(year: number, month: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad2(month)}-${pad2(lastDay)}`;
}

function getPreviousMonth(year: number, month: number) {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }

  return { year, month: month - 1 };
}

function getMonthStartYearsAgo(yearsAgo: number) {
  const now = getColomboDateParts(new Date());
  const year = Number(now.year) - yearsAgo;
  const month = Number(now.month);
  return `${year}-${pad2(month)}-01`;
}

function buildMonthlySeries(
  payments: Array<{ amount: unknown; paidAt: Date }>,
  from: string,
  to: string
): MonthlyPoint[] {
  const totals = new Map<string, number>();
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cursor <= end) {
    const key = `${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}`;
    totals.set(key, 0);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  for (const payment of payments) {
    const parts = getColomboDateParts(payment.paidAt);
    const key = `${parts.year}-${parts.month}`;
    totals.set(
      key,
      roundMoney((totals.get(key) ?? 0) + Number(payment.amount))
    );
  }

  return Array.from(totals.entries()).map(([key, amount]) => ({
    key,
    label: formatMonthKey(key),
    amount,
  }));
}

function formatMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatDisplayRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Colombo",
  }).format(date);
}

function formatLkr(value: number) {
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatCompactLkr(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) {
    return `LKR ${(value / 1_000_000).toFixed(1)}M`;
  }

  if (absolute >= 1_000) {
    return `LKR ${(value / 1_000).toFixed(0)}K`;
  }

  return `LKR ${Math.round(value)}`;
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}
