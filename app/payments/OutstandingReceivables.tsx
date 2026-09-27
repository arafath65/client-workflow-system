import Link from "next/link";

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

export default function OutstandingReceivables({
  rows,
}: {
  rows: ReceivableRow[];
}) {
  const totalOutstanding = rows.reduce((sum, row) => sum + row.due, 0);
  const clientCount = new Set(rows.map((row) => row.clientId)).size;

  return (
    <section className="mt-6 rounded-xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f9a800]">
            Receivables
          </p>
          <h2 className="mt-1 text-sm font-semibold">
            Outstanding Balances
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-black/40">
            Files opened in the selected date range that still have an
            outstanding balance. Clients can settle the balance through one or
            more partial payments without a fixed payment schedule.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SummaryPill label="Files" value={rows.length.toString()} />
          <SummaryPill label="Clients" value={clientCount.toString()} />
          <SummaryPill label="Outstanding" value={formatLkr(totalOutstanding)} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 flex min-h-32 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9] px-5 text-center">
          <div>
            <p className="text-sm font-medium text-black/55">
              No outstanding balances
            </p>
            <p className="mt-1 text-xs text-black/35">
              All files in the selected range are fully settled, or there are
              no qualifying files.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-black/10 bg-[#fafaf9]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  File
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Total
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Paid
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Outstanding
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Last Payment
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.fileId}
                  className="border-b border-black/5 last:border-b-0 hover:bg-[#fafaf9]"
                >
                  <td className="px-4 py-3 text-xs font-medium">
                    {row.clientName}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/files/${row.fileId}`}
                      className="text-xs font-medium hover:text-[#b77900]"
                    >
                      {row.fileNumber}
                    </Link>
                    <p className="mt-0.5 max-w-64 truncate text-[10px] text-black/35">
                      {row.title}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-black/60">
                    {formatLkr(row.billed)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-black/60">
                    {formatLkr(row.paid)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold">
                    {formatLkr(row.due)}
                  </td>
                  <td className="px-4 py-3 text-xs text-black/50">
                    {row.lastPaymentAt
                      ? formatDate(row.lastPaymentAt)
                      : "No payment yet"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[10px] leading-5 text-black/30">
        Outstanding = current file total minus CLEARED payments. There is no
        assumed installment count, due date, or fixed payment schedule.
      </p>
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-[#fafaf9] px-3 py-2">
      <p className="text-[9px] font-medium uppercase tracking-wider text-black/30">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-semibold">{value}</p>
    </div>
  );
}

function formatLkr(value: number) {
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).format(new Date(value));
}
