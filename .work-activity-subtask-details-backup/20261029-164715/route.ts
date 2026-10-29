import { join } from "node:path";
import { existsSync } from "node:fs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "Asia/Colombo";
const REPORT_LOGO_PATH = join(process.cwd(), "public", "ai-global-logo.png");
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 42;
const RIGHT = 42;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const COLORS = {
  black: "#171717",
  muted: "#666666",
  light: "#F5F5F2",
  border: "#D9D9D5",
  accent: "#F9A800",
  green: "#2E7D32",
  amber: "#9A6700",
  gray: "#6B7280",
};

function colomboDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDateString(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function colomboMidnight(value: string) {
  return new Date(`${value}T00:00:00+05:30`);
}

function addOneDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function safeText(value: string | null | undefined) {
  return String(value ?? "—").replace(/\s+/g, " ").trim();
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(value);
}

function parsePositiveInt(value: string | null) {
  if (!value || value === "all") return null;
  const result = Number(value);
  return Number.isInteger(result) && result > 0 ? result : null;
}

function actionLabel(action: string) {
  if (action === "COMPLETED") return "COMPLETED";
  if (action === "REOPENED") return "REOPENED";
  if (action === "RESET") return "RESET TO PENDING";
  return action;
}

function drawHeader(doc: PDFKit.PDFDocument, from: string, to: string, staffLabel: string) {
  doc.rect(0, 0, PAGE_WIDTH, 82).fill(COLORS.black);

  const hasLogo = existsSync(REPORT_LOGO_PATH);
  const textX = hasLogo ? LEFT + 60 : LEFT;

  // Place the company mark in a clean white tile at the top-left.
  if (hasLogo) {
    doc.roundedRect(LEFT, 14, 48, 48, 5).fill("white");
    doc.image(REPORT_LOGO_PATH, LEFT + 4, 18, {
      fit: [40, 40],
      align: "center",
      valign: "center",
    });
  }

  // Company name and report details sit beside the logo.
  doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(10).text("A&I GLOBAL", textX, 16);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(17).text("Staff Work Activity Report", textX, 31);
  doc.fillColor("#D4D4D4").font("Helvetica").fontSize(8.2).text(
    `Period: ${from} to ${to}  â€¢  ${staffLabel}`,
    textX,
    58,
    { width: PAGE_WIDTH - RIGHT - textX }
  );

  doc.y = 100;
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const y = PAGE_HEIGHT - 30;
  doc.moveTo(LEFT, y - 8).lineTo(PAGE_WIDTH - RIGHT, y - 8).strokeColor(COLORS.border).lineWidth(0.5).stroke();
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7).text("Confidential • A&I Global Client Workflow System", LEFT, y, { width: CONTENT_WIDTH / 2 });
  doc.text(`Generated ${formatDateTime(new Date())}`, PAGE_WIDTH / 2, y, { width: CONTENT_WIDTH / 2, align: "right" });
}

function ensureSpace(doc: PDFKit.PDFDocument, required: number, header: { from: string; to: string; staffLabel: string }) {
  if (doc.y + required <= PAGE_HEIGHT - 48) return;
  doc.addPage({ size: "A4", margin: 0 });
  drawHeader(doc, header.from, header.to, header.staffLabel);
}

type PdfActivityRecord = {
  id: number;
  workflowTaskId: number | null;
  createdAt: Date;
  activityType: string;
  action: string;
  fileNumber: string;
  clientName: string;
  workflowName: string;
  stepNumber: number;
  stepTitle: string;
  subTaskNumber: number | null;
  subTaskTitle: string | null;
  staffName: string | null;
  actorUsername: string | null;
  remarks: string | null;
};

function drawActivityGroupHeading(
  doc: PDFKit.PDFDocument,
  record: PdfActivityRecord,
  continued = false
) {
  const fileLine = `${safeText(record.fileNumber)}  â€¢  ${safeText(record.clientName)}`;
  const stepLine = `${safeText(record.workflowName)}  â€¢  Step ${record.stepNumber}: ${safeText(record.stepTitle)}${continued ? " (continued)" : ""}`;
  const textWidth = CONTENT_WIDTH - 20;

  doc.font("Helvetica-Bold").fontSize(8.5);
  const fileHeight = doc.heightOfString(fileLine, { width: textWidth });
  doc.font("Helvetica").fontSize(7.6);
  const stepHeight = doc.heightOfString(stepLine, { width: textWidth });
  const boxHeight = 10 + fileHeight + 3 + stepHeight + 8;
  const y = doc.y;

  doc.roundedRect(LEFT, y, CONTENT_WIDTH, boxHeight, 4).fill(COLORS.light);
  doc.fillColor(COLORS.black).font("Helvetica-Bold").fontSize(8.5)
    .text(fileLine, LEFT + 10, y + 5, { width: textWidth });
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7.6)
    .text(stepLine, LEFT + 10, y + 5 + fileHeight + 3, { width: textWidth });
  doc.y = y + boxHeight + 3;
}

function orderActivityRecords(records: PdfActivityRecord[]) {
  return [...records].sort((a, b) => {
    const aRank = a.activityType === "WORKFLOW_STEP" ? 0 : 1;
    const bRank = b.activityType === "WORKFLOW_STEP" ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;

    if (a.activityType === "SUBTASK" && b.activityType === "SUBTASK") {
      const numberDifference = (a.subTaskNumber ?? 9999) - (b.subTaskNumber ?? 9999);
      if (numberDifference !== 0) return numberDifference;
    }

    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}
function createPdf(
  records: PdfActivityRecord[],
  header: { from: string; to: string; staffLabel: string },
  summary: { total: number; steps: number; subtasks: number; changed: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4", margin: 0,
      info: { Title: "Staff Work Activity Report", Author: "A&I Global Client Workflow System" },
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, header.from, header.to, header.staffLabel);
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8).text("ACTIVITY SUMMARY", LEFT, doc.y);
    doc.y += 15;

    const summaryItems = [
      ["Workflow steps completed", String(summary.steps)],
      ["Subtasks completed", String(summary.subtasks)],
      ["Reopened / reset", String(summary.changed)],
      ["Matching records", String(summary.total)],
    ];
    const cardGap = 8;
    const cardWidth = (CONTENT_WIDTH - cardGap * 3) / 4;
    const cardY = doc.y;
    summaryItems.forEach(([label, value], index) => {
      const x = LEFT + index * (cardWidth + cardGap);
      doc.roundedRect(x, cardY, cardWidth, 51, 5).fill(COLORS.light);
      doc.fillColor(COLORS.black).font("Helvetica-Bold").fontSize(16).text(value, x + 8, cardY + 8, { width: cardWidth - 16 });
      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(6.5).text(label, x + 8, cardY + 31, { width: cardWidth - 16, height: 16 });
    });
    doc.y = cardY + 65;

    if (records.length === 0) {
      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(10).text("No activity records matched the selected filters.", LEFT, doc.y + 8, { width: CONTENT_WIDTH, align: "center" });
    }

    const grouped = new Map<string, PdfActivityRecord[]>();
    for (const record of records) {
      const key = record.workflowTaskId !== null
        ? `task-${record.workflowTaskId}`
        : `record-${record.id}`;
      const group = grouped.get(key) ?? [];
      group.push(record);
      grouped.set(key, group);
    }

    const groups = Array.from(grouped.entries())
      .map(([key, groupRecords]) => ({ key, records: orderActivityRecords(groupRecords) }))
      .sort((a, b) => {
        const aLatest = Math.max(...a.records.map((record) => record.createdAt.getTime()));
        const bLatest = Math.max(...b.records.map((record) => record.createdAt.getTime()));
        return aLatest - bLatest;
      });

    for (const group of groups) {
      const contextRecord = group.records[0];
      ensureSpace(doc, 60, header);
      drawActivityGroupHeading(doc, contextRecord);

      for (const record of group.records) {
        const isSubtask = record.activityType === "SUBTASK";
        const indent = isSubtask ? 27 : 12;
        const actionText = actionLabel(record.action);
        const dateText = formatDateTime(record.createdAt);
        const staffText = safeText(record.staffName);
        const actorText = safeText(record.actorUsername);
        const eventLine = isSubtask
          ? `> Subtask ${record.subTaskNumber ? `${record.subTaskNumber}: ` : ""}${safeText(record.subTaskTitle)}  |  ${actionText}  |  ${dateText}  |  Staff: ${staffText}  |  By: ${actorText}`
          : `Workflow step activity  |  ${actionText}  |  ${dateText}  |  Staff: ${staffText}  |  By: ${actorText}`;
        const textWidth = CONTENT_WIDTH - indent - 3;

        doc.font("Helvetica-Bold").fontSize(7.4);
        const eventHeight = doc.heightOfString(eventLine, { width: textWidth });
        let remarkHeight = 0;
        if (record.remarks) {
          doc.font("Helvetica").fontSize(6.8);
          remarkHeight = doc.heightOfString(safeText(record.remarks), { width: textWidth });
        }
        const rowHeight = 6 + eventHeight + (remarkHeight > 0 ? 2 + remarkHeight : 0) + 5;

        if (doc.y + rowHeight > PAGE_HEIGHT - 48) {
          doc.addPage({ size: "A4", margin: 0 });
          drawHeader(doc, header.from, header.to, header.staffLabel);
          drawActivityGroupHeading(doc, contextRecord, true);
        }

        const y = doc.y;
        if (isSubtask) {
          doc.moveTo(LEFT + 17, y + 2)
            .lineTo(LEFT + 17, y + rowHeight - 2)
            .strokeColor(COLORS.border).lineWidth(1).stroke();
        }

        const eventColor = record.action === "COMPLETED"
          ? COLORS.green
          : record.action === "REOPENED"
            ? COLORS.amber
            : COLORS.gray;
        doc.fillColor(eventColor).font("Helvetica-Bold").fontSize(7.4)
          .text(eventLine, LEFT + indent, y + 3, { width: textWidth });

        let currentY = y + 3 + eventHeight + 2;
        if (record.remarks) {
          doc.fillColor(COLORS.muted).font("Helvetica").fontSize(6.8)
            .text(safeText(record.remarks), LEFT + indent, currentY, { width: textWidth });
          currentY += remarkHeight;
        }

        doc.moveTo(LEFT + indent, y + rowHeight)
          .lineTo(PAGE_WIDTH - RIGHT, y + rowHeight)
          .strokeColor(COLORS.border).lineWidth(0.35).stroke();
        doc.y = y + rowHeight + 2;
      }

      doc.y += 7;
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      drawFooter(doc);
    }
    doc.end();
  });
}

export async function GET(request: NextRequest) {
  try {
    const rawUserId = (await cookies()).get("session_user")?.value;
    const userId = Number(rawUserId);
    if (!rawUserId || !Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const today = colomboDateString();
    const from = isValidDateString(searchParams.get("from")) ? searchParams.get("from")! : today;
    const toCandidate = isValidDateString(searchParams.get("to")) ? searchParams.get("to")! : today;
    const to = toCandidate < from ? from : toCandidate;
    const staffId = parsePositiveInt(searchParams.get("staffId"));
    const requestedAction = searchParams.get("action") ?? "COMPLETED";
    const actionFilter = ["ALL", "COMPLETED", "REOPENED", "RESET"].includes(requestedAction) ? requestedAction : "COMPLETED";
    const requestedType = searchParams.get("activityType") ?? "ALL";
    const typeFilter = ["ALL", "WORKFLOW_STEP", "SUBTASK"].includes(requestedType) ? requestedType : "ALL";
    const baseWhere = {
      createdAt: { gte: colomboMidnight(from), lt: colomboMidnight(addOneDay(to)) },
      ...(staffId ? { staffId } : {}),
    };
    const where = {
      ...baseWhere,
      ...(actionFilter !== "ALL" ? { action: actionFilter } : {}),
      ...(typeFilter !== "ALL" ? { activityType: typeFilter } : {}),
    };

    const [records, totalActivity, stepsCompleted, subtasksCompleted, changed, selectedStaff] = await Promise.all([
      prisma.workflowActivityLog.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 20000 }),
      prisma.workflowActivityLog.count({ where: baseWhere }),
      prisma.workflowActivityLog.count({ where: { ...baseWhere, activityType: "WORKFLOW_STEP", action: "COMPLETED" } }),
      prisma.workflowActivityLog.count({ where: { ...baseWhere, activityType: "SUBTASK", action: "COMPLETED" } }),
      prisma.workflowActivityLog.count({ where: { ...baseWhere, action: { in: ["REOPENED", "RESET"] } } }),
      staffId ? prisma.staff.findUnique({ where: { id: staffId }, select: { name: true } }) : Promise.resolve(null),
    ]);

    if (staffId && !selectedStaff) return NextResponse.json({ success: false, message: "Staff member not found." }, { status: 404 });
    const staffLabel = selectedStaff?.name ?? "All staff";
    const summary = {
      total: records.length,
      steps: stepsCompleted,
      subtasks: subtasksCompleted,
      changed,
    };
    const pdf = await createPdf(records, { from, to, staffLabel }, summary);
    const filename = `staff-work-activity-${from}-to-${to}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Generate work activity report error:", error);
    return NextResponse.json({ success: false, message: "Unable to generate work activity report." }, { status: 500 });
  }
}
