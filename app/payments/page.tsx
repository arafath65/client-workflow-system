import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import Navigation from "../components/Navigation";
import LogoutButton from "../dashboard/LogoutButton";
import PaymentDashboardFilters from "./PaymentDashboardFilters";
import { prisma } from "@/lib/prisma";

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
  paid: number;
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
  const status = rawStatus === "CANCELLED" ? "CANCELLED" : "CLEARED";
  const search = getParam(rawParams.search).trim();

  // --------------------------------------------------
  // Selected-period files
  //
  // Billed = current value of workflows + file charges
  // on files opened in the selected date range.
  // Paid = all CLEARED payments against those files.
  // Due = current outstanding balance of those files.
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
          status: "CLEARED",
        },
        select: {
          amount: true,
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
  // Current-year cleared payments for the monthly chart
  // The chart always shows Jan-Dec of the current year,
  // independent of the dashboard date-range filter.
  // --------------------------------------------------
  const currentYear = Number(nowColombo.year);
  const currentYearStart = sriLankaStartOfDay(
    `${currentYear}-01-01`
  );
  const nextYearStart = sriLankaStartOfDay(
    `${currentYear + 1}-01-01`
  );

  const currentYearClearedPayments = await prisma.payment.findMany({
    where: {
      status: "CLEARED",
      paidAt: {
        gte: currentYearStart,
        lt: nextYearStart,
      },
    },
    select: {
      amount: true,
      paidAt: true,
    },
    orderBy: {
      paidAt: "asc",
    },
  });

  // --------------------------------------------------
  // Payment history in selected period
  // --------------------------------------------------
  const historyPayments = await prisma.payment.findMany({
    where: {
      status,
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
  let totalPaidForSelectedFiles = 0;

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
    const paid = roundMoney(
      file.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      )
    );
    const due = roundMoney(Math.max(billed - paid, 0));

    totalBilled += billed;
    totalDue += due;
    totalPaidForSelectedFiles += paid;

    const existing = clientSummaryMap.get(file.clientId);

    if (!existing) {
      clientSummaryMap.set(file.clientId, {
        clientId: file.client.id,
        clientName: file.client.name,
        fileCount: 1,
        billed,
        paid,
        due,
      });
    } else {
      existing.fileCount += 1;
      existing.billed = roundMoney(existing.billed + billed);
      existing.paid = roundMoney(existing.paid + paid);
      existing.due = roundMoney(existing.due + due);
    }
  }

  totalBilled = roundMoney(totalBilled);
  totalDue = roundMoney(totalDue);
  totalPaidForSelectedFiles = roundMoney(totalPaidForSelectedFiles);

  const totalPaidInRange = roundMoney(
    periodClearedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    )
  );

  const clientSummary = Array.from(clientSummaryMap.values()).sort(
    (a, b) => b.due - a.due || a.clientName.localeCompare(b.clientName)
  );

  const monthlyGrowth = buildCurrentYearMonthlySeries(
    currentYearClearedPayments,
    currentYear
  );

  const totalClients = clientSummary.length;
  const selectedRangeLabel = formatDisplayRange(
    normalizedRange.from,
    normalizedRange.to
  );


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

      <Navigation currentPage="payments" />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Heading */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
            Finance
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Payments
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/50">
            Financial dashboard for collections, outstanding balances and
            client acquisition sources.
          </p>
        </div>

        {/* Filters */}
        <PaymentDashboardFilters
          from={normalizedRange.from}
          to={normalizedRange.to}
          status={status}
          search={search}
          currentMonthStart={currentMonthStart}
          currentMonthEnd={currentMonthEnd}
          lastMonthStart={(() => {
            const previous = getPreviousMonth(
              Number(nowColombo.year),
              Number(nowColombo.month)
            );
            return `${previous.year}-${pad2(previous.month)}-01`;
          })()}
          lastMonthEnd={(() => {
            const previous = getPreviousMonth(
              Number(nowColombo.year),
              Number(nowColombo.month)
            );
            return getLastDayOfMonth(previous.year, previous.month);
          })()}
          lastTwelveMonthsStart={getMonthStartYearsAgo(1)}
          lastTwelveMonthsEnd={nowColombo.date}
          selectedRangeLabel={selectedRangeLabel}
        />

        {/* KPI Cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FinanceCard
            title="Total Billed"
            value={formatLkr(totalBilled)}
            description="Files opened in selected range"
          />

          <FinanceCard
            title="Total Paid"
            value={formatLkr(totalPaidInRange)}
            description="Cleared payments received in range"
          />

          <FinanceCard
            title="Total Due"
            value={formatLkr(totalDue)}
            description="Current outstanding on selected files"
          />

          <FinanceCard
            title="Total Clients"
            value={totalClients.toString()}
            description="Clients with files in selected range"
          />
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="rounded-xl border border-black/10 bg-white p-5 lg:col-span-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">
                  Monthly Payment Growth · {currentYear}
                </h2>
                <p className="mt-1 text-xs text-black/40">
                  Monthly total of CLEARED payments received during the current
                  year.
                </p>
              </div>

              <span className="rounded-full bg-[#fff7e6] px-3 py-1 text-[10px] font-semibold text-[#a56e00]">
                Paid Amount
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
                      Paid
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
                        {formatLkr(row.paid)}
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
            Paid in this table is the all-time CLEARED amount received against
            the selected files. The Total Paid card above is limited to the
            selected date range.
          </p>
        </div>

        {/* Payment history */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">Payment History</h2>
              <p className="mt-1 text-xs text-black/40">
                {status === "CLEARED" ? "Cleared" : "Cancelled"} payments in
                the selected date range.
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
                status === "CLEARED"
                  ? "No cleared payments found for the selected filters."
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
                              : "bg-[#fff0f0] text-[#9b4141]"
                          }`}
                        >
                          {payment.status === "CLEARED"
                            ? "Cleared"
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
            Financial totals use CLEARED payments only. Cancelled payments are
            preserved in history but are not counted as received money.
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
    return <EmptyState message="No monthly data available." />;
  }

  const width = 720;
  const height = 300;
  const paddingLeft = 76;
  const paddingRight = 18;
  const paddingTop = 24;
  const paddingBottom = 48;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const rawMax = Math.max(...points.map((point) => point.amount), 0);
  const chartMax = getNiceChartMax(rawMax);
  const gridCount = 4;

  const coords = points.map((point, index) => {
    const x =
      paddingLeft +
      (points.length === 1
        ? plotWidth / 2
        : (index / (points.length - 1)) * plotWidth);

    const y =
      paddingTop +
      plotHeight -
      (point.amount / chartMax) * plotHeight;

    return { ...point, x, y };
  });

  const polyline = coords
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const areaPath =
    coords.length > 0
      ? [
          `M ${coords[0].x} ${paddingTop + plotHeight}`,
          ...coords.map((point) => `L ${point.x} ${point.y}`),
          `L ${coords[coords.length - 1].x} ${paddingTop + plotHeight}`,
          "Z",
        ].join(" ")
      : "";

  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-black/5 bg-[#fcfcfb]">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Monthly cleared payment growth chart for the current year"
        className="block"
      >
        <defs>
          <linearGradient id="paymentArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f9a800" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#f9a800" stopOpacity="0" />
          </linearGradient>
        </defs>

        {Array.from({ length: gridCount + 1 }, (_, index) => {
          const fraction = index / gridCount;
          const y =
            paddingTop +
            plotHeight -
            fraction * plotHeight;
          const label = formatCompactLkr(chartMax * fraction);

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
                fill="rgba(0,0,0,0.38)"
              >
                {label}
              </text>
            </g>
          );
        })}

        {areaPath ? (
          <path
            d={areaPath}
            fill="url(#paymentArea)"
          />
        ) : null}

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
              fontSize="9"
              fontWeight="600"
              fill="#171717"
            >
              {formatCompactLkr(point.amount)}
            </text>
            <text
              x={point.x}
              y={height - 18}
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

function getNiceChartMax(value: number) {
  if (value <= 0) {
    return 1000;
  }

  const roughStep = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  const step =
    normalized <= 1
      ? 1 * magnitude
      : normalized <= 2
        ? 2 * magnitude
        : normalized <= 5
          ? 5 * magnitude
          : 10 * magnitude;

  return Math.max(step, Math.ceil(value / step) * step);
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
  let year = Number(now.year) - yearsAgo;
  const month = Number(now.month);
  return `${year}-${pad2(month)}-01`;
}

function buildCurrentYearMonthlySeries(
  payments: Array<{ amount: unknown; paidAt: Date }>,
  year: number
): MonthlyPoint[] {
  const totals = new Map<string, number>();

  // Always create all 12 months so the current-year axis is complete.
  for (let month = 1; month <= 12; month += 1) {
    totals.set(`${year}-${pad2(month)}`, 0);
  }

  for (const payment of payments) {
    const parts = getColomboDateParts(payment.paidAt);
    if (Number(parts.year) !== year) continue;

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
