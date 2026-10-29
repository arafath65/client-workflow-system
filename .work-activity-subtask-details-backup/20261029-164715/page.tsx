import Link from "next/link";
import { Fragment } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navigation from "../../components/Navigation";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const TZ = "Asia/Colombo";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  staffId?: string;
  action?: string;
  activityType?: string;
  page?: string;
}>;

function colomboDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDateString(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Asia/Colombo is UTC+05:30; convert a local calendar date to UTC boundaries.
function colomboMidnight(value: string) {
  return new Date(`${value}T00:00:00+05:30`);
}

function addOneDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatAction(action: string) {
  if (action === "COMPLETED") return "Completed";
  if (action === "REOPENED") return "Reopened";
  if (action === "RESET") return "Reset to pending";
  return action.replaceAll("_", " ");
}

function actionClass(action: string) {
  if (action === "COMPLETED") return "bg-green-100 text-green-700";
  if (action === "REOPENED") return "bg-amber-100 text-amber-800";
  return "bg-black/5 text-black/60";
}

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

type GroupableActivityRecord = {
  id: number;
  workflowTaskId: number | null;
  activityType: string;
  createdAt: Date;
  stepNumber: number;
  subTaskNumber: number | null;
};

function groupActivityRecords<T extends GroupableActivityRecord>(records: T[]) {
  const map = new Map<string, T[]>();

  for (const record of records) {
    const key = record.workflowTaskId !== null
      ? `task-${record.workflowTaskId}`
      : `record-${record.id}`;
    const group = map.get(key) ?? [];
    group.push(record);
    map.set(key, group);
  }

  return Array.from(map.entries())
    .map(([key, groupRecords]) => ({
      key,
      records: groupRecords.sort((a, b) => {
        const aRank = a.activityType === "WORKFLOW_STEP" ? 0 : 1;
        const bRank = b.activityType === "WORKFLOW_STEP" ? 0 : 1;
        if (aRank !== bRank) return aRank - bRank;

        if (a.activityType === "SUBTASK" && b.activityType === "SUBTASK") {
          const numberDifference = (a.subTaskNumber ?? 9999) - (b.subTaskNumber ?? 9999);
          if (numberDifference !== 0) return numberDifference;
        }

        return b.createdAt.getTime() - a.createdAt.getTime();
      }),
    }))
    .sort((a, b) => {
      const aLatest = Math.max(...a.records.map((record) => record.createdAt.getTime()));
      const bLatest = Math.max(...b.records.map((record) => record.createdAt.getTime()));
      return bLatest - aLatest;
    });
}
export default async function WorkActivityReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const cookieStore = await cookies();
  const rawUserId = cookieStore.get("session_user")?.value;
  const userId = Number(rawUserId);
  if (!rawUserId || !Number.isInteger(userId) || userId <= 0) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (!user) redirect("/login");

  const params = await searchParams;
  const today = colomboDateString();
  const from = isValidDateString(params.from) ? params.from! : today;
  const toCandidate = isValidDateString(params.to) ? params.to! : today;
  const to = toCandidate < from ? from : toCandidate;
  const staffIdCandidate = Number(params.staffId);
  const staffId = params.staffId && params.staffId !== "all" && Number.isInteger(staffIdCandidate) && staffIdCandidate > 0
    ? staffIdCandidate
    : null;
  const requestedAction = params.action ?? "COMPLETED";
  const actionFilter = ["ALL", "COMPLETED", "REOPENED", "RESET"].includes(requestedAction) ? requestedAction : "COMPLETED";
  const activityTypeCandidate = params.activityType ?? "ALL";
  const activityTypeFilter = ["WORKFLOW_STEP", "SUBTASK"].includes(activityTypeCandidate) ? activityTypeCandidate : "ALL";
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const safePage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const dateRange = { gte: colomboMidnight(from), lt: colomboMidnight(addOneDay(to)) };
  const baseWhere = {
    createdAt: dateRange,
    ...(staffId ? { staffId } : {}),
  };
  const where = {
    ...baseWhere,
    ...(actionFilter !== "ALL" ? { action: actionFilter } : {}),
    ...(activityTypeFilter !== "ALL" ? { activityType: activityTypeFilter } : {}),
  };

  const [totalRecords, activityRecords, staffOptions, totalActivity, completedSteps, completedSubtasks, reopenedOrReset, staffTotals] = await Promise.all([
    prisma.workflowActivityLog.count({ where }),
    prisma.workflowActivityLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.staff.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
    prisma.workflowActivityLog.count({ where: baseWhere }),
    prisma.workflowActivityLog.count({ where: { ...baseWhere, activityType: "WORKFLOW_STEP", action: "COMPLETED" } }),
    prisma.workflowActivityLog.count({ where: { ...baseWhere, activityType: "SUBTASK", action: "COMPLETED" } }),
    prisma.workflowActivityLog.count({ where: { ...baseWhere, action: { in: ["REOPENED", "RESET"] } } }),
    prisma.workflowActivityLog.groupBy({
      by: ["staffId", "staffName"],
      where: baseWhere,
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const currentPage = Math.min(safePage, totalPages);
  const pdfQuery = queryString({ from, to, staffId: staffId ?? "all", action: actionFilter, activityType: activityTypeFilter });
  const navLinks = {
    first: queryString({ from, to, staffId: staffId ?? "all", action: actionFilter, activityType: activityTypeFilter, page: 1 }),
    previous: queryString({ from, to, staffId: staffId ?? "all", action: actionFilter, activityType: activityTypeFilter, page: Math.max(1, currentPage - 1) }),
    next: queryString({ from, to, staffId: staffId ?? "all", action: actionFilter, activityType: activityTypeFilter, page: Math.min(totalPages, currentPage + 1) }),
    last: queryString({ from, to, staffId: staffId ?? "all", action: actionFilter, activityType: activityTypeFilter, page: totalPages }),
  };

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-[#171717]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black"><span className="text-xs font-bold text-[#f9a800]">A&I</span></div>
            <div><p className="text-sm font-semibold">A&I Global</p><p className="text-[10px] text-black/40">Client Workflow System</p></div>
          </div>
          <div className="text-right"><p className="text-[10px] text-black/40">Logged in as</p><p className="text-sm font-medium">{user.username}</p></div>
        </div>
      </header>
      <Navigation currentPage="work-activity" />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">Operations & Reporting</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Staff Work Activity</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-black/50">An audit-backed report of workflow steps and subtasks completed, reopened, or reset during a selected period.</p>
          </div>
          <a href={`/api/reports/work-activity?${pdfQuery}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black">Export PDF</a>
        </div>

        <form method="get" className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block"><span className="text-xs font-medium text-black/60">From date</span><input type="date" name="from" defaultValue={from} max={to} required className="mt-2 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs outline-none focus:border-[#f9a800]" /></label>
            <label className="block"><span className="text-xs font-medium text-black/60">To date</span><input type="date" name="to" defaultValue={to} min={from} required className="mt-2 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs outline-none focus:border-[#f9a800]" /></label>
            <label className="block"><span className="text-xs font-medium text-black/60">Staff</span><select name="staffId" defaultValue={staffId ? String(staffId) : "all"} className="mt-2 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs outline-none focus:border-[#f9a800]"><option value="all">All staff</option>{staffOptions.map((member) => <option key={member.id} value={member.id}>{member.name}{member.status ? "" : " (Inactive)"}</option>)}</select></label>
            <label className="block"><span className="text-xs font-medium text-black/60">Activity</span><select name="activityType" defaultValue={activityTypeFilter} className="mt-2 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs outline-none focus:border-[#f9a800]"><option value="ALL">All types</option><option value="WORKFLOW_STEP">Workflow steps</option><option value="SUBTASK">Subtasks</option></select></label>
            <label className="block"><span className="text-xs font-medium text-black/60">Action</span><select name="action" defaultValue={actionFilter} className="mt-2 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs outline-none focus:border-[#f9a800]"><option value="ALL">All activity</option><option value="COMPLETED">Completed</option><option value="REOPENED">Reopened</option><option value="RESET">Reset to pending</option></select></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2"><button type="submit" className="h-10 rounded-lg bg-black px-5 text-xs font-semibold text-white hover:bg-[#f9a800] hover:text-black">Apply filters</button><Link href="/reports/work-activity" className="inline-flex h-10 items-center rounded-lg border border-black/10 px-4 text-xs font-medium hover:bg-black/[0.03]">Reset</Link><p className="text-[10px] text-black/40">Dates use Sri Lanka time (Asia/Colombo).</p></div>
        </form>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Completed workflow steps" value={completedSteps} description="Within selected dates and staff" />
          <SummaryCard title="Completed subtasks" value={completedSubtasks} description="Within selected dates and staff" />
          <SummaryCard title="Reopened or reset" value={reopenedOrReset} description="Recorded follow-up changes" />
          <SummaryCard title="Total activity records" value={totalActivity} description="All recorded actions in range" />
        </div>

        <section className="mt-6 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-sm font-semibold">Activity details</h2><p className="mt-1 text-xs text-black/40">Showing {activityRecords.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, totalRecords)} of {totalRecords} matching records.</p></div><p className="text-[10px] text-black/40">Summary cards are based on the date/staff filters; table rows also use Activity and Action.</p></div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-black/10">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="bg-[#fafaf9]"><tr>{["Date & time", "File / client", "Workflow step", "Subtask", "Assigned staff", "Recorded by", "Action"].map((heading) => <th key={heading} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-black/40">{heading}</th>)}</tr></thead>
              <tbody>
                {groupActivityRecords(activityRecords).map(({ key, records }) => {
                  const stepRecords = records.filter((record) => record.activityType === "WORKFLOW_STEP");
                  const subtaskRecords = records.filter((record) => record.activityType === "SUBTASK");
                  const contextRecord = records[0];

                  return (
                    <Fragment key={key}>
                      {stepRecords.map((record) => (
                        <tr key={record.id} className="border-b border-black/5 last:border-b-0 hover:bg-[#fafaf9]">
                          <td className="whitespace-nowrap px-4 py-4 text-xs">{formatDateTime(record.createdAt)}</td>
                          <td className="px-4 py-4">
                            <p className="text-xs font-semibold">{record.fileNumber}</p>
                            <p className="mt-1 text-xs text-black/50">{record.clientName}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-xs font-medium">{record.workflowName}</p>
                            <p className="mt-1 text-xs text-black/50">Step {record.stepNumber}: {record.stepTitle}</p>
                          </td>
                          <td className="px-4 py-4 text-xs text-black/40">â€”</td>
                          <td className="px-4 py-4 text-xs text-black/60">{record.staffName ?? "Unassigned"}</td>
                          <td className="px-4 py-4 text-xs text-black/60">{record.actorUsername ?? "â€”"}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${actionClass(record.action)}`}>{formatAction(record.action)}</span>
                            {record.remarks ? <p className="mt-1 max-w-56 text-[10px] text-black/40">{record.remarks}</p> : null}
                          </td>
                        </tr>
                      ))}

                      {stepRecords.length === 0 && subtaskRecords.length > 0 ? (
                        <tr key={`${key}-context`} className="border-b border-black/5 bg-[#fafaf9]">
                          <td className="whitespace-nowrap px-4 py-4 text-[10px] font-semibold uppercase tracking-wide text-black/35">Step context</td>
                          <td className="px-4 py-4">
                            <p className="text-xs font-semibold">{contextRecord.fileNumber}</p>
                            <p className="mt-1 text-xs text-black/50">{contextRecord.clientName}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-xs font-medium">{contextRecord.workflowName}</p>
                            <p className="mt-1 text-xs text-black/50">Step {contextRecord.stepNumber}: {contextRecord.stepTitle}</p>
                          </td>
                          <td colSpan={4} className="px-4 py-4 text-xs text-black/40">Subtask activity for this workflow step</td>
                        </tr>
                      ) : null}

                      {subtaskRecords.map((record) => (
                        <tr key={record.id} className="border-b border-black/5 bg-white hover:bg-[#fffdf7]">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-black/65">{formatDateTime(record.createdAt)}</td>
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3">
                            <div className="ml-1 border-l-2 border-[#f9a800]/50 pl-3">
                              <p className="text-xs font-medium text-black/80">Subtask {record.subTaskNumber ? `${record.subTaskNumber}: ` : ""}{record.subTaskTitle ?? "Subtask"}</p>
                              {record.remarks ? <p className="mt-1 max-w-56 text-[10px] text-black/40">{record.remarks}</p> : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-black/60">{record.staffName ?? "Unassigned"}</td>
                          <td className="px-4 py-3 text-xs text-black/60">{record.actorUsername ?? "â€”"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${actionClass(record.action)}`}>{formatAction(record.action)}</span>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
                {activityRecords.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center"><p className="text-sm font-medium text-black/50">No activity recorded for these filters</p><p className="mt-1 text-xs text-black/35">Activity tracking starts when this feature is installed. Older changes cannot be reconstructed reliably.</p></td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-black/10 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-black/40">Page {currentPage} of {totalPages}</p><div className="flex items-center gap-2">{currentPage > 1 ? <Link href={`/reports/work-activity?${navLinks.previous}`} className="rounded-lg border border-black/10 px-3 py-2 text-xs hover:bg-black/[0.03]">Previous</Link> : <span className="rounded-lg border border-black/5 px-3 py-2 text-xs text-black/25">Previous</span>}{currentPage < totalPages ? <Link href={`/reports/work-activity?${navLinks.next}`} className="rounded-lg border border-black/10 px-3 py-2 text-xs hover:bg-black/[0.03]">Next</Link> : <span className="rounded-lg border border-black/5 px-3 py-2 text-xs text-black/25">Next</span>}</div></div>
        </section>

        <p className="mt-4 text-[11px] leading-5 text-black/45">Staff filtering is based on the staff assigned to the step or subtask. “Recorded by” identifies the logged-in user account that changed it. These are separate because the current system does not link User accounts directly to Staff records.</p>

        {staffTotals.length > 0 ? <section className="mt-6 rounded-xl border border-black/10 bg-white p-5"><h2 className="text-sm font-semibold">Staff activity totals</h2><p className="mt-1 text-xs text-black/40">All activity in the selected date range, before table action/type filters.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{staffTotals.map((group, index) => <div key={`${group.staffId ?? "unassigned"}-${group.staffName ?? index}`} className="rounded-lg border border-black/10 p-4"><p className="text-xs font-medium">{group.staffName ?? "Unassigned"}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{group._count._all}</p><p className="mt-1 text-[10px] text-black/40">activity records</p></div>)}</div></section> : null}
      </section>
    </main>
  );
}

function SummaryCard({ title, value, description }: { title: string; value: number; description: string }) {
  return <div className="rounded-xl border border-black/10 bg-white p-5"><p className="text-xs font-medium text-black/45">{title}</p><p className="mt-3 text-2xl font-semibold tabular-nums">{value.toLocaleString("en-LK")}</p><p className="mt-1 text-xs text-black/35">{description}</p></div>;
}
