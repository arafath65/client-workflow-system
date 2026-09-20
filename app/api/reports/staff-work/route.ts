import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { FileStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 42;
const RIGHT = 42;
const TOP = 48;
const BOTTOM = 55;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;

const COLORS = {
  black: "#171717",
  muted: "#6B6B6B",
  border: "#D9D9D5",
  accent: "#F9A800",
  green: "#3E7D37",
  red: "#C62828",
  orange: "#A66F00",
};

type Status =
  | "PENDING"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

type StepView = {
  number: number;
  title: string;
  status: Status;
  assignedStaffName: string | null;
  subtasks: {
    number: number;
    title: string;
    status: Status;
    assignedStaffName: string | null;
  }[];
};

type WorkflowView = {
  id: number;
  name: string;
  status: string;
  steps: StepView[];
};

type FileView = {
  id: number;
  fileNumber: string;
  title: string;
  clientName: string;
  status: FileStatus;
  workflows: WorkflowView[];
};

type StaffGroup = {
  id: number;
  name: string;
  position: string | null;
  active: boolean;
  files: FileView[];
};

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

function parseFileStatus(value: string | null): FileStatus {
  switch (value) {
    case "COMPLETED":
      return FileStatus.COMPLETED;

    case "CANCELLED":
      return FileStatus.CANCELLED;

    default:
      return FileStatus.IN_PROGRESS;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "DONE";

    case "ACTIVE":
      return "ACTIVE";

    case "ON_HOLD":
      return "ON HOLD";

    case "CANCELLED":
      return "CANCELLED";

    default:
      return "PENDING";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "COMPLETED":
      return COLORS.green;

    case "CANCELLED":
      return COLORS.red;

    case "ACTIVE":
    case "ON_HOLD":
      return COLORS.orange;

    default:
      return COLORS.muted;
  }
}

function fileStatusLabel(status: FileStatus): string {
  switch (status) {
    case FileStatus.COMPLETED:
      return "Completed";

    case FileStatus.CANCELLED:
      return "Cancelled";

    default:
      return "In Progress";
  }
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function safeText(
  value: string | null | undefined
): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * PDFKit does not expose pageNumber in its TypeScript type.
 * Keep our own page counter instead.
 */
const pageNumbers = new WeakMap<
  PDFKit.PDFDocument,
  { current: number }
>();

function addPage(doc: PDFKit.PDFDocument) {
  doc.addPage();

  const state = pageNumbers.get(doc);

  if (state) {
    state.current += 1;
  }

  doc.y = TOP;
}

function ensureSpace(
  doc: PDFKit.PDFDocument,
  needed: number
) {
  if (
    doc.y + needed <=
    PAGE_HEIGHT - BOTTOM
  ) {
    return;
  }

  addPage(doc);
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string
) {
  doc
    .rect(
      0,
      0,
      PAGE_WIDTH,
      78
    )
    .fill(COLORS.black);

  doc
    .fillColor(COLORS.accent)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(
      "A&I",
      LEFT,
      16
    );

  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(
      title,
      LEFT,
      31
    );

  doc
    .fillColor("#D4D4D4")
    .font("Helvetica")
    .fontSize(8.5)
    .text(
      subtitle,
      LEFT,
      55
    );

  doc.y = 96;
}

function drawFooter(
  doc: PDFKit.PDFDocument
) {
  const y = PAGE_HEIGHT - 31;

  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(LEFT, y - 6)
    .lineTo(
      PAGE_WIDTH - RIGHT,
      y - 6
    )
    .stroke();

  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(7)
    .text(
      "A&I Global Client Workflow System",
      LEFT,
      y,
      {
        width: 250,
      }
    );

  const pageNumber =
    pageNumbers.get(doc)?.current ?? 1;

  doc.text(
    `Page ${pageNumber}`,
    PAGE_WIDTH - RIGHT - 75,
    y,
    {
      width: 75,
      align: "right",
    }
  );
}

function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  text: string
) {
  ensureSpace(doc, 28);

  doc
    .fillColor(COLORS.black)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(
      text,
      LEFT,
      doc.y
    );

  doc
    .strokeColor(COLORS.accent)
    .lineWidth(2)
    .moveTo(
      LEFT,
      doc.y + 15
    )
    .lineTo(
      LEFT + 34,
      doc.y + 15
    )
    .stroke();

  doc.y += 23;
}

function drawSummary(
  doc: PDFKit.PDFDocument,
  group: StaffGroup
) {
  const files = group.files;

  const workflows =
    files.flatMap(
      (file) => file.workflows
    );

  const steps =
    workflows.flatMap(
      (workflow) => workflow.steps
    );

  const subtasks =
    steps.flatMap(
      (step) => step.subtasks
    );

  const doneSteps =
    steps.filter(
      (step) =>
        step.status ===
        "COMPLETED"
    ).length;

  const pendingSteps =
    steps.filter(
      (step) =>
        [
          "PENDING",
          "ACTIVE",
          "ON_HOLD",
        ].includes(step.status)
    ).length;

  const doneSubtasks =
    subtasks.filter(
      (task) =>
        task.status ===
        "COMPLETED"
    ).length;

  const pendingSubtasks =
    subtasks.filter(
      (task) =>
        [
          "PENDING",
          "ACTIVE",
          "ON_HOLD",
        ].includes(
          task.status
        )
    ).length;

  const cards = [
    ["FILES", files.length],
    ["DONE STEPS", doneSteps],
    ["PENDING STEPS", pendingSteps],
    ["DONE SUBTASKS", doneSubtasks],
    ["PENDING SUBTASKS", pendingSubtasks],
  ] as const;

  const gap = 6;

  const width =
    (CONTENT_WIDTH -
      gap * (cards.length - 1)) /
    cards.length;

  const top = doc.y;

  cards.forEach(
    ([label, value], index) => {
      const x =
        LEFT +
        index * (width + gap);

      doc
        .roundedRect(
          x,
          top,
          width,
          47,
          8
        )
        .lineWidth(0.5)
        .strokeColor(
          COLORS.border
        )
        .fillAndStroke(
          "#FFFFFF",
          COLORS.border
        );

      doc
        .fillColor(
          COLORS.muted
        )
        .font("Helvetica")
        .fontSize(6.8)
        .text(
          label,
          x + 7,
          top + 8,
          {
            width:
              width - 14,
          }
        );

      doc
        .fillColor(
          COLORS.black
        )
        .font("Helvetica-Bold")
        .fontSize(14)
        .text(
          String(value),
          x + 7,
          top + 22,
          {
            width:
              width - 14,
          }
        );
    }
  );

  doc.y = top + 60;
}

function drawStaffHeading(
  doc: PDFKit.PDFDocument,
  group: StaffGroup
) {
  ensureSpace(doc, 48);

  doc
    .fillColor(
      COLORS.black
    )
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(
      group.name,
      LEFT,
      doc.y
    );

  if (group.position) {
    doc
      .fillColor(
        COLORS.muted
      )
      .font("Helvetica")
      .fontSize(8)
      .text(
        group.position,
        LEFT,
        doc.y + 17
      );
  }

  doc.y +=
    group.position
      ? 35
      : 22;

  drawSummary(
    doc,
    group
  );
}

function drawFile(
  doc: PDFKit.PDFDocument,
  file: FileView
) {
  ensureSpace(doc, 72);

  const y = doc.y;

  doc
    .roundedRect(
      LEFT,
      y,
      CONTENT_WIDTH,
      52,
      8
    )
    .lineWidth(0.6)
    .strokeColor(
      COLORS.border
    )
    .fillAndStroke(
      "#FFFFFF",
      COLORS.border
    );

  doc
    .fillColor(
      COLORS.black
    )
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .text(
      `${file.fileNumber}  ·  ${file.clientName}`,
      LEFT + 10,
      y + 9,
      {
        width:
          CONTENT_WIDTH - 160,
      }
    );

  doc
    .fillColor(
      COLORS.muted
    )
    .font("Helvetica")
    .fontSize(7.5)
    .text(
      file.title,
      LEFT + 10,
      y + 25,
      {
        width:
          CONTENT_WIDTH - 160,
      }
    );

  doc
    .fillColor(
      statusColor(
        file.status
      )
    )
    .font("Helvetica-Bold")
    .fontSize(7)
    .text(
      fileStatusLabel(
        file.status
      ).toUpperCase(),
      PAGE_WIDTH -
        RIGHT -
        105,
      y + 17,
      {
        width: 95,
        align: "right",
      }
    );

  doc.y = y + 64;
}

function drawStatusMarker(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  status: string
) {
  const radius = 8;

  // Background circle
  if (status === "COMPLETED") {
    doc
      .circle(x, y, radius)
      .fill("#EDF7E8");

    // Draw check mark using lines
    doc
      .strokeColor(COLORS.green)
      .lineWidth(1.4)
      .moveTo(x - 4, y)
      .lineTo(x - 1, y + 3)
      .lineTo(x + 4, y - 4)
      .stroke();

    return;
  }

  if (status === "CANCELLED") {
    doc
      .circle(x, y, radius)
      .fill("#FCE8E8");

    // Draw X using lines
    doc
      .strokeColor(COLORS.red)
      .lineWidth(1.3)
      .moveTo(x - 3, y - 3)
      .lineTo(x + 3, y + 3)
      .moveTo(x + 3, y - 3)
      .lineTo(x - 3, y + 3)
      .stroke();

    return;
  }

  // Pending / Active / On Hold
  doc
    .circle(x, y, radius)
    .fill("#F2F2EF");

  // Small center dot
  doc
    .circle(x, y, 2)
    .fill(COLORS.muted);
}


function drawStep(
  doc: PDFKit.PDFDocument,
  step: StepView
) {
  const baseHeight =
    37 +
    step.subtasks.length * 22;

  ensureSpace(
    doc,
    Math.max(50, baseHeight)
  );

  const y = doc.y;

  // --------------------------------------------
  // Step status marker
  // --------------------------------------------

  drawStatusMarker(
    doc,
    LEFT + 8,
    y + 10,
    step.status
  );

  // --------------------------------------------
  // Step title
  // --------------------------------------------

  doc
    .fillColor(COLORS.black)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(
      `Step ${step.number}: ${safeText(
        step.title
      )}`,
      LEFT + 22,
      y + 3,
      {
        width:
          CONTENT_WIDTH - 150,
      }
    );

  // --------------------------------------------
  // Step status text
  // --------------------------------------------

  doc
    .fillColor(
      statusColor(step.status)
    )
    .font("Helvetica-Bold")
    .fontSize(6.8)
    .text(
      statusLabel(step.status),
      PAGE_WIDTH - RIGHT - 115,
      y + 4,
      {
        width: 105,
        align: "right",
      }
    );

  // --------------------------------------------
  // Assigned staff
  // --------------------------------------------

  if (step.assignedStaffName) {
    doc
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(7)
      .text(
        `Assigned to: ${safeText(
          step.assignedStaffName
        )}`,
        LEFT + 22,
        y + 17,
        {
          width:
            CONTENT_WIDTH - 30,
        }
      );
  }

  let currentY = y + 32;

  // --------------------------------------------
  // Subtasks
  // --------------------------------------------

  for (const subtask of step.subtasks) {
    const subColor =
      subtask.status === "COMPLETED"
        ? COLORS.green
        : subtask.status === "CANCELLED"
          ? COLORS.red
          : COLORS.muted;

    drawStatusMarker(
      doc,
      LEFT + 30,
      currentY + 4,
      subtask.status
    );

    const prefix =
      subtask.assignedStaffName
        ? `${safeText(
            subtask.assignedStaffName
          )} · `
        : "";

    doc
      .fillColor(COLORS.black)
      .font("Helvetica")
      .fontSize(7.2)
      .text(
        `${prefix}${subtask.number}. ${safeText(
          subtask.title
        )}`,
        LEFT + 44,
        currentY,
        {
          width:
            CONTENT_WIDTH - 145,
        }
      );

    doc
      .fillColor(subColor)
      .font("Helvetica")
      .fontSize(6.6)
      .text(
        statusLabel(
          subtask.status
        ),
        PAGE_WIDTH - RIGHT - 95,
        currentY,
        {
          width: 85,
          align: "right",
        }
      );

    currentY += 20;
  }

  doc.y = currentY + 4;
}

async function loadData(
  staffId: number | null,
  status: FileStatus
): Promise<StaffGroup[] | null> {
  const staff =
    await prisma.staff.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        position: true,
        status: true,
      },
    });

  if (
    staffId !== null &&
    !staff.some(
      (member) =>
        member.id === staffId
    )
  ) {
    return null;
  }

  const files =
    await prisma.clientFile.findMany({
      where: {
        status,

        fileWorkflows: {
          some: {
            assignedStaffId:
              staffId === null
                ? { not: null }
                : staffId,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
        fileNumber: true,
        title: true,
        status: true,

        client: {
          select: {
            name: true,
          },
        },

        fileWorkflows: {
          orderBy: {
            createdAt: "asc",
          },

          select: {
            id: true,
            status: true,
            assignedStaffId: true,

            assignedStaff: {
              select: {
                id: true,
                name: true,
              },
            },

            workflowTemplate: {
              select: {
                name: true,
              },
            },

            tasks: {
              orderBy: {
                workflowStep: {
                  stepNumber: "asc",
                },
              },

              select: {
                id: true,
                status: true,

                assignedStaff: {
                  select: {
                    id: true,
                    name: true,
                  },
                },

                workflowStep: {
                  select: {
                    stepNumber: true,
                    title: true,
                  },
                },

                subTasks: {
                  orderBy: {
                    workflowSubTask: {
                      subTaskNumber: "asc",
                    },
                  },

                  select: {
                    id: true,
                    status: true,

                    assignedStaff: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },

                    workflowSubTask: {
                      select: {
                        subTaskNumber: true,
                        title: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

  const groups =
    new Map<
      number,
      StaffGroup
    >();

  for (const file of files) {
    const mainWorkflows =
      file.fileWorkflows.filter(
        (workflow) =>
          workflow.assignedStaffId !== null &&
          (
            staffId === null ||
            workflow.assignedStaffId ===
              staffId
          )
      );

    for (const workflow of mainWorkflows) {
      if (
        workflow.assignedStaffId ===
          null ||
        !workflow.assignedStaff
      ) {
        continue;
      }

      let group =
        groups.get(
          workflow.assignedStaffId
        );

      if (!group) {
        const member =
          staff.find(
            (person) =>
              person.id ===
              workflow.assignedStaffId
          );

        if (!member) {
          continue;
        }

        group = {
          id: member.id,
          name: member.name,
          position:
            member.position,
          active:
            member.status,
          files: [],
        };

        groups.set(
          member.id,
          group
        );
      }

      let fileView =
        group.files.find(
          (item) =>
            item.id === file.id
        );

      if (!fileView) {
        fileView = {
          id: file.id,
          fileNumber:
            file.fileNumber,
          title: file.title,
          clientName:
            file.client.name,
          status: file.status,
          workflows: [],
        };

        group.files.push(
          fileView
        );
      }

      fileView.workflows.push({
        id: workflow.id,
        name:
          workflow.workflowTemplate
            .name,
        status:
          workflow.status,

        steps:
          workflow.tasks.map(
            (task) => ({
              number:
                task.workflowStep
                  .stepNumber,

              title:
                task.workflowStep
                  .title,

              status:
                task.status,

              assignedStaffName:
                task.assignedStaff
                  ?.name ??
                null,

              subtasks:
                task.subTasks.map(
                  (subtask) => ({
                    number:
                      subtask
                        .workflowSubTask
                        .subTaskNumber,

                    title:
                      subtask
                        .workflowSubTask
                        .title,

                    status:
                      subtask.status,

                    assignedStaffName:
                      subtask
                        .assignedStaff
                        ?.name ??
                      null,
                  })
                ),
            })
          ),
      });
    }
  }

  return Array.from(
    groups.values()
  ).sort((a, b) =>
    a.name.localeCompare(
      b.name
    )
  );
}

function createPdf(
  groups: StaffGroup[],
  title: string,
  filterLabel: string
): Promise<Buffer> {
  return new Promise(
    (resolve, reject) => {
      const doc =
        new PDFDocument({
          size: "A4",
          margin: 0,

          info: {
            Title: title,
            Author:
              "A&I Global Client Workflow System",
          },
        });

      pageNumbers.set(
        doc,
        { current: 1 }
      );

      const chunks: Buffer[] =
        [];

      doc.on(
        "data",
        (chunk) =>
          chunks.push(
            Buffer.from(chunk)
          )
      );

      doc.on(
        "end",
        () =>
          resolve(
            Buffer.concat(
              chunks
            )
          )
      );

      doc.on(
        "error",
        reject
      );

      drawHeader(
        doc,
        title,
        filterLabel
      );

      doc
        .fillColor(
          COLORS.muted
        )
        .font("Helvetica")
        .fontSize(7.5)
        .text(
          `Generated: ${formatDate(
            new Date()
          )}`,
          LEFT,
          doc.y
        );

      doc.y += 14;

      if (groups.length === 0) {
        doc
          .fillColor(
            COLORS.muted
          )
          .font("Helvetica")
          .fontSize(9)
          .text(
            "No staff work found for this report.",
            LEFT,
            doc.y
          );

        drawFooter(doc);

        doc.end();

        return;
      }

      groups.forEach(
        (group, groupIndex) => {
          if (groupIndex > 0) {
            addPage(doc);
          }

          drawStaffHeading(
            doc,
            group
          );

          for (const file of group.files) {
            drawFile(
              doc,
              file
            );

            for (const workflow of file.workflows) {
              ensureSpace(
                doc,
                30
              );

              doc
                .fillColor(
                  COLORS.black
                )
                .font(
                  "Helvetica-Bold"
                )
                .fontSize(9)
                .text(
                  workflow.name,
                  LEFT + 8,
                  doc.y
                );

              doc
                .fillColor(
                  COLORS.muted
                )
                .font(
                  "Helvetica"
                )
                .fontSize(7)
                .text(
                  `Workflow: ${statusLabel(
                    workflow.status
                  )}`,
                  PAGE_WIDTH -
                    RIGHT -
                    100,
                  doc.y + 1,
                  {
                    width: 92,
                    align:
                      "right",
                  }
                );

              doc.y += 18;

              for (const step of workflow.steps) {
                drawStep(
                  doc,
                  step
                );
              }

              doc.y += 3;
            }
          }
        }
      );

      drawFooter(doc);

      doc.end();
    }
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    const sessionUser =
      (
        await cookies()
      ).get(
        "session_user"
      );

    if (
      !sessionUser?.value
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const userId =
      Number(
        sessionUser.value
      );

    if (
      !Number.isInteger(
        userId
      ) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const { searchParams } =
      new URL(
        request.url
      );

    const all =
      searchParams.get(
        "all"
      ) === "true";

    const staffId =
      parsePositiveInt(
        searchParams.get(
          "staffId"
        )
      );

    const status =
      parseFileStatus(
        searchParams.get(
          "status"
        )
      );

    if (
      !all &&
      staffId === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Select a staff member or choose All Staff.",
        },
        { status: 400 }
      );
    }

    const groups =
      await loadData(
        all
          ? null
          : staffId,
        status
      );

    if (
      groups === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Staff member not found.",
        },
        { status: 404 }
      );
    }

    const title =
      all
        ? "Staff Work Report - All Staff"
        : "Staff Work Report";

    const filterLabel =
      `${fileStatusLabel(
        status
      )} · ${
        all
          ? "All staff members"
          : groups[0]?.name ??
            "Selected staff member"
      }`;

    const pdf =
      await createPdf(
        groups,
        title,
        filterLabel
      );

    const filename =
      all
        ? "staff-work-report-all.pdf"
        : `staff-work-report-${staffId}.pdf`;

    return new NextResponse(
      new Uint8Array(pdf),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `inline; filename="${filename}"`,

          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Generate staff work report error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to generate staff work report.",
      },
      { status: 500 }
    );
  }
}