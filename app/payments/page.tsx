import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import Navigation from "../components/Navigation";
import LogoutButton from "../dashboard/LogoutButton";
import { prisma } from "@/lib/prisma";
import ExpenseManager from "./ExpenseManager";

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

type MonthlyPoint = {
  key: string;
  label: string;
  amount: number;
};

type SourcePoint = {
  label: string;
  clientCount: number;
  sourceId: number | null;
};

type ClientSummaryRow = {
  clientId: number;
  clientName: string;
  fileCount: number;
  billed: number;
  received: number;
  refunded: number;
  due: number;
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
  // All-time source data
  // Direct is always first. Then third parties in the
  // order they were created.
  // A client is counted once per source. If a client has
  // different files tied to different sources, that client
  // can therefore appear in more than one source.
  // --------------------------------------------------
  const [thirdParties, allSourceFiles] = await Promise.all([
    prisma.thirdParty.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),

    prisma.clientFile.findMany({
      select: {
        clientId: true,
        thirdPartyId: true,
      },
    }),
  ]);

  const directClients = new Set<number>();
  const thirdPartyClients = new Map<number, Set<number>>();

  for (const file of allSourceFiles) {
    if (file.thirdPartyId == null) {
      directClients.add(file.clientId);
      continue;
    }

    let set = thirdPartyClients.get(file.thirdPartyId);

    if (!set) {
      set = new Set<number>();
      thirdPartyClients.set(file.thirdPartyId, set);
    }

    set.add(file.clientId);
  }

  const sourcePoints: SourcePoint[] = [
    {
      label: "Direct",
      clientCount: directClients.size,
      sourceId: null,
    },
    ...thirdParties.map((thirdParty) => ({
      label: thirdParty.name,
      clientCount: thirdPartyClients.get(thirdParty.id)?.size ?? 0,
      sourceId: thirdParty.id,
    })),
  ];

  // --------------------------------------------------
  // Financial totals
  // --------------------------------------------------
  let totalBilled = 0;
  let totalDue = 0;

  const clientSummaryMap = new Map<number, ClientSummaryRow>();

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
    const refunded = roundMoney(
      file.payments
        .filter((payment) => payment.status === "REFUNDED")
        .reduce((sum, payment) => sum + Number(payment.amount), 0)
    );
    const due =
      file.status === "CANCELLED"
        ? 0
        : roundMoney(Math.max(billed - received, 0));

    totalBilled += billed;
    totalDue += due;
    const existing = clientSummaryMap.get(file.clientId);

    if (!existing) {
      clientSummaryMap.set(file.clientId, {
        clientId: file.client.id,
        clientName: file.client.name,
        fileCount: 1,
        billed,
        received,
        refunded,
        due,
      });
    } else {
      existing.fileCount += 1;
      existing.billed = roundMoney(existing.billed + billed);
      existing.received = roundMoney(existing.received + received);
      existing.refunded = roundMoney(existing.refunded + refunded);
      existing.due = roundMoney(existing.due + due);
    }
  }

  totalBilled = roundMoney(totalBilled);
  totalDue = roundMoney(totalDue);

  // Gross income = all payments that were actually received.
  // A refunded payment was received first, so it remains part of
  // gross income and is deducted separately below.
  const totalIncome = roundMoney(
    periodClearedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    ) +
      periodRefundedPayments.reduce(
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

  const netIncome = roundMoney(
    totalIncome - totalRefunded
  );

  const totalProfit = roundMoney(
    netIncome - totalExpenses
  );

  const clientSummary = Array.from(clientSummaryMap.values()).sort(
    (a, b) => b.due - a.due || a.clientName.localeCompare(b.clientName)
  );

  const monthlyGrowth = buildMonthlySeries(
    [...periodClearedPayments, ...periodRefundedPayments],
    normalizedRange.from,
    normalizedRange.to
  );

  const selectedRangeLabel = formatDisplayRange(
    normalizedRange.from,
    normalizedRange.to
  );

  // --------------------------------------------------
  // Preset links
  // --------------------------------------------------
  const thisMonthQuery = buildQuery({
    from: currentMonthStart,
    to: currentMonthEnd,
    status,
    search,
  });

  const lastMonth = getPreviousMonth(Number(nowColombo.year), Number(nowColombo.month));
  const lastMonthStart = `${lastMonth.year}-${pad2(lastMonth.month)}-01`;
  const lastMonthEnd = getLastDayOfMonth(lastMonth.year, lastMonth.month);

  const lastMonthQuery = buildQuery({
    from: lastMonthStart,
    to: lastMonthEnd,
    status,
    search,
  });

  const lastTwelveMonthsStart = getMonthStartYearsAgo(1);
  const lastTwelveMonthsQuery = buildQuery({
    from: lastTwelveMonthsStart,
    to: nowColombo.date,
    status,
    search,
  });

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-[#171717]">
      {/* Header */}
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black">
              <span className="text-xs font-bold text-[#f9a800]">A&I</span>
            </div>

            <div>
              <p className="text-sm font-semibold">A&I Global</p>
              <p className="text-[10px] text-black/40">
                Client Workflow System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-black/40">Logged in as</p>
              <p className="text-sm font-medium">{user.username}</p>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      <Navigation currentPage="finance" />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Heading */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
            Finance
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Finance
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/50">
            Track income, refunds, expenses, outstanding balances and profit
            from one financial workspace.
          </p>
        </div>

        {/* Filters */}
        <form
          method="get"
          className="mt-8 rounded-xl border border-black/10 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label
                htmlFor="from"
                className="mb-1.5 block text-xs font-medium text-black/50"
              >
                From
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={normalizedRange.from}
                className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              />
            </div>

            <div>
              <label
                htmlFor="to"
                className="mb-1.5 block text-xs font-medium text-black/50"
              >
                To
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={normalizedRange.to}
                className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              />
            </div>

            <div className="min-w-44">
              <label
                htmlFor="status"
                className="mb-1.5 block text-xs font-medium text-black/50"
              >
                Payment History
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              >
                <option value="ALL">All</option>
                <option value="CLEARED">Cleared</option>
                <option value="REFUNDED">Refunded</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="min-w-56 flex-1">
              <label
                htmlFor="search"
                className="mb-1.5 block text-xs font-medium text-black/50"
              >
                Search
              </label>
              <input
                id="search"
                name="search"
                type="text"
                defaultValue={search}
                placeholder="Client, file number, service or reference..."
                className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              />
            </div>

            <button
              type="submit"
              className="h-10 rounded-lg bg-black px-5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black"
            >
              Apply
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-black/30">
              Presets
            </span>

            <Link
              href={`?${thisMonthQuery}`}
              className="rounded-full border border-black/10 px-3 py-1.5 text-[10px] font-medium text-black/55 transition hover:border-[#f9a800]/40 hover:bg-[#fffaf0] hover:text-black"
            >
              This Month
            </Link>

            <Link
              href={`?${lastMonthQuery}`}
              className="rounded-full border border-black/10 px-3 py-1.5 text-[10px] font-medium text-black/55 transition hover:border-[#f9a800]/40 hover:bg-[#fffaf0] hover:text-black"
            >
              Last Month
            </Link>

            <Link
              href={`?${lastTwelveMonthsQuery}`}
              className="rounded-full border border-black/10 px-3 py-1.5 text-[10px] font-medium text-black/55 transition hover:border-[#f9a800]/40 hover:bg-[#fffaf0] hover:text-black"
            >
              Last 12 Months
            </Link>

            <span className="ml-auto text-[10px] text-black/35">
              Showing {selectedRangeLabel}
            </span>
          </div>
        </form>

        {/* KPI Cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <FinanceCard
            title="Total Income"
            value={formatLkr(totalIncome)}
            description="Cleared payments received in range"
          />

          <FinanceCard
            title="Total Refunded"
            value={formatLkr(totalRefunded)}
            description="Payments returned to clients"
          />

          <FinanceCard
            title="Total Expenses"
            value={formatLkr(totalExpenses)}
            description="Business expenses in selected range"
          />

          <FinanceCard
            title="Net Profit"
            value={formatLkr(totalProfit)}
            description="Income − refunds − expenses"
          />

          <FinanceCard
            title="Total Due"
            value={formatLkr(totalDue)}
            description="Current outstanding on selected files"
          />
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="rounded-xl border border-black/10 bg-white p-5 lg:col-span-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">
                  Monthly Income
                </h2>
                <p className="mt-1 text-xs text-black/40">
                  Monthly gross payments received in the selected period.
                  Refunded payments are included in gross income and deducted separately.
                </p>
              </div>

              <span className="rounded-full bg-[#fff7e6] px-3 py-1 text-[10px] font-semibold text-[#a56e00]">
                Income
              </span>
            </div>

            <MonthlyPaymentChart points={monthlyGrowth} />
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5 lg:col-span-2">
            <div>
              <h2 className="text-sm font-semibold">
                Clients by Source
              </h2>
              <p className="mt-1 text-xs text-black/40">
                All-time client count by acquisition source. Direct is always
                first.
              </p>
            </div>

            <SourceChart points={sourcePoints} />

            <p className="mt-4 text-[10px] leading-5 text-black/30">
              Source is stored on each client file. A client can appear under
              more than one source when different files use different sources.
            </p>
          </div>
        </div>

        {/* Client financial summary */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">
                Client Financial Summary
              </h2>
              <p className="mt-1 text-xs text-black/40">
                Current financial position for clients whose files were opened
                in the selected range.
              </p>
            </div>

            <span className="text-[10px] font-medium text-black/30">
              {clientSummary.length} client
              {clientSummary.length === 1 ? "" : "s"}
            </span>
          </div>

          {clientSummary.length === 0 ? (
            <EmptyState message="No client financial data for this date range." />
          ) : (
            <div className="mt-5 overflow-x-auto rounded-lg border border-black/10">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-black/10 bg-[#fafaf9]">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Client
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Files
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Billed
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Received
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Refunded
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Due
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {clientSummary.map((row) => (
                    <tr
                      key={row.clientId}
                      className="border-b border-black/5 last:border-b-0 hover:bg-[#fafaf9]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/clients/${row.clientId}`}
                          className="text-xs font-medium hover:text-[#b77900]"
                        >
                          {row.clientName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-black/55">
                        {row.fileCount}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium">
                        {formatLkr(row.billed)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-black/60">
                        {formatLkr(row.received)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-black/60">
                        {formatLkr(row.refunded)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold">
                        {formatLkr(row.due)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-[10px] text-black/30">
            Received is the all-time CLEARED amount retained against the
            selected files. Refunded is the amount returned to clients.
            Cancelled files have no current amount due.
          </p>
        </div>

        {/* Expenses */}
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

        {/* Profit reconciliation */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <FinanceCard
            title="Net Income"
            value={formatLkr(netIncome)}
            description="Income after refunds"
          />

          <FinanceCard
            title="Total Profit"
            value={formatLkr(totalProfit)}
            description="Net income after expenses"
          />

          <FinanceCard
            title="Total Billed"
            value={formatLkr(totalBilled)}
            description="Original billed value in selected range"
          />
        </div>

        {/* Payment history */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">Payment History</h2>
              <p className="mt-1 text-xs text-black/40">
                {status === "ALL"
                  ? "All"
                  : status === "CLEARED"
                    ? "Cleared"
                    : status === "REFUNDED"
                      ? "Refunded"
                      : "Cancelled"} payment activity in the selected date range.
                {historyPayments.length >= 250 ? " Showing the latest 250." : ""}
              </p>
            </div>

            <span className="text-[10px] font-medium text-black/30">
              {historyPayments.length} payment
              {historyPayments.length === 1 ? "" : "s"}
            </span>
          </div>

          {historyPayments.length === 0 ? (
            <EmptyState
              message={
                status === "ALL"
                  ? "No payment activity found for the selected filters."
                  : status === "CLEARED"
                    ? "No cleared payments found for the selected filters."
                    : status === "REFUNDED"
                      ? "No refunded payments found for the selected filters."
                      : "No cancelled payments found for the selected filters."
              }
            />
          ) : (
            <div className="mt-5 overflow-x-auto rounded-lg border border-black/10">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-black/10 bg-[#fafaf9]">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      File
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
                  </tr>
                </thead>

                <tbody>
                  {historyPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-black/5 last:border-b-0 hover:bg-[#fafaf9]"
                    >
                      <td className="px-4 py-3 text-xs text-black/60">
                        {formatDateTime(payment.paidAt)}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">
                        {payment.clientFile.client.name}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/files/${payment.clientFile.id}`}
                          className="text-xs font-medium hover:text-[#b77900]"
                        >
                          {payment.clientFile.fileNumber}
                        </Link>
                        <p className="mt-0.5 max-w-64 truncate text-[10px] text-black/35">
                          {payment.clientFile.title}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-black/60">
                        {formatPaymentMethod(payment.paymentMethod)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold">
                        {formatLkr(Number(payment.amount))}
                      </td>
                      <td className="px-4 py-3 text-xs text-black/50">
                        {payment.referenceNo || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                            payment.status === "CLEARED"
                              ? "bg-[#f1f8ea] text-[#4f702d]"
                              : payment.status === "REFUNDED"
                                ? "bg-[#fff7e6] text-[#a56e00]"
                                : "bg-[#fff0f0] text-[#9b4141]"
                          }`}
                        >
                          {payment.status === "CLEARED"
                            ? "Cleared"
                            : payment.status === "REFUNDED"
                              ? "Refunded"
                              : "Cancelled"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Small reconciliation note */}
        <div className="mt-4 rounded-lg border border-black/5 bg-white/60 px-4 py-3">
          <p className="text-[10px] leading-5 text-black/35">
            Financial totals use CLEARED payments as Received. Refunded payments
            are excluded from Received and remain visible in payment history.
          </p>
        </div>
      </section>
    </main>
  );
}

/* --------------------------------------------------
   Finance Card
-------------------------------------------------- */

function FinanceCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-black/15 hover:shadow">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-black/45">{title}</p>
        <div className="h-2 w-2 rounded-full bg-[#f9a800]" />
      </div>

      <p className="mt-4 break-words text-2xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-1 text-xs text-black/35">{description}</p>
    </div>
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

  const width = Math.max(760, points.length * 82);
  const height = 320;
  const paddingLeft = 76;
  const paddingRight = 76;
  const plotInsetLeft = 58;
  const plotInsetRight = 28;
  const paddingTop = 36;
  const paddingBottom = 52;
  const plotLeft = paddingLeft + plotInsetLeft;
  const plotRight = width - paddingRight - plotInsetRight;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = height - paddingTop - paddingBottom;

  // Leave some headroom so the highest point and its label never touch the top.
  const highestAmount = Math.max(
    ...points.map((point) => point.amount),
    1
  );
  const maxValue = Math.max(highestAmount * 1.2, 1);
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? plotLeft + plotWidth / 2
        : plotLeft +
          (index / (points.length - 1)) * plotWidth;

    const y =
      paddingTop +
      plotHeight -
      (point.amount / maxValue) * plotHeight;

    return { ...point, x, y };
  });

  const polyline = coords
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-black/5 bg-[#fcfcfb]">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Monthly gross income chart"
        className="block min-w-full"
      >
        {gridSteps.map((fraction) => {
          const y =
            paddingTop +
            plotHeight -
            fraction * plotHeight;
          const label = formatCompactLkr(maxValue * fraction);

          return (
            <g key={fraction}>
              <line
                x1={plotLeft}
                x2={plotRight}
                y1={y}
                y2={y}
                stroke="rgba(0,0,0,0.08)"
                strokeWidth="1"
                strokeDasharray={
                  fraction === 0 ? undefined : "4 4"
                }
              />

              <text
                x={paddingLeft - 12}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="rgba(0,0,0,0.38)"
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
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {coords.map((point) => (
          <g key={point.key}>
            <circle
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#171717"
              stroke="#f9a800"
              strokeWidth="2.5"
            />

            <text
              x={point.x}
              y={Math.max(point.y - 16, 18)}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#171717"
            >
              {formatCompactLkr(point.amount)}
            </text>

            <text
              x={point.x}
              y={height - 20}
              textAnchor="middle"
              fontSize="10"
              fontWeight="500"
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
   Source horizontal chart
-------------------------------------------------- */

function SourceChart({ points }: { points: SourcePoint[] }) {
  if (points.length === 0) {
    return <EmptyState message="No source data available yet." />;
  }

  const maxCount = Math.max(...points.map((point) => point.clientCount), 1);

  return (
    <div className="mt-6 max-h-[390px] space-y-4 overflow-y-auto pr-1">
      {points.map((point, index) => {
        const width =
          point.clientCount === 0
            ? 0
            : Math.max((point.clientCount / maxCount) * 100, 2.5);

        return (
          <div key={point.sourceId ?? "direct"}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="truncate text-xs font-medium">
                  {point.label}
                </span>
              </div>

              <span className="shrink-0 text-xs font-semibold">
                {point.clientCount}
              </span>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-[#f9a800]"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------
   Empty state
-------------------------------------------------- */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-5 flex min-h-36 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9] px-5 text-center">
      <p className="text-sm text-black/40">{message}</p>
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

function buildQuery({
  from,
  to,
  status,
  search,
}: {
  from: string;
  to: string;
  status: string;
  search: string;
}) {
  const params = new URLSearchParams();
  params.set("from", from);
  params.set("to", to);
  params.set("status", status);

  if (search) {
    params.set("search", search);
  }

  return params.toString();
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
