import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FileCancellationSettlement,
  FileStatus,
  TaskStatus,
  CalendarEventStatus,
} from "@/generated/prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const SETTLEMENTS = [
  "NO_PAYMENT",
  "REFUND_PAID",
  "NON_REFUNDABLE",
  "TRANSFER_CREDIT",
] as const;

type Settlement = (typeof SETTLEMENTS)[number];

function parseFileId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isSettlement(value: unknown): value is Settlement {
  return (
    typeof value === "string" &&
    SETTLEMENTS.includes(value as Settlement)
  );
}

function decimalToNumber(value: unknown) {
  return Number(value ?? 0);
}

async function getCancellationDetails(fileId: number) {
  const clientFile = await prisma.clientFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      fileNumber: true,
      title: true,
      status: true,
      client: {
        select: { name: true },
      },
      fileWorkflows: {
        select: { finalAmount: true },
      },
      charges: {
        select: { totalAmount: true },
      },
      payments: {
        where: { status: "CLEARED" },
        select: { amount: true },
      },
    },
  });

  if (!clientFile) {
    return null;
  }

  const workflowFees = clientFile.fileWorkflows.reduce(
    (sum, workflow) =>
      sum + decimalToNumber(workflow.finalAmount),
    0
  );

  const extraCharges = clientFile.charges.reduce(
    (sum, charge) =>
      sum + decimalToNumber(charge.totalAmount),
    0
  );

  const totalPaid = clientFile.payments.reduce(
    (sum, payment) =>
      sum + decimalToNumber(payment.amount),
    0
  );

  const totalAmount = workflowFees + extraCharges;
  const outstanding = Math.max(totalAmount - totalPaid, 0);

  const targetFiles = await prisma.clientFile.findMany({
    where: {
      id: { not: fileId },
      status: {
        in: [FileStatus.OPEN, FileStatus.IN_PROGRESS, FileStatus.ON_HOLD],
      },
    },
    select: {
      id: true,
      fileNumber: true,
      title: true,
      client: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  return {
    id: clientFile.id,
    fileNumber: clientFile.fileNumber,
    title: clientFile.title,
    clientName: clientFile.client.name,
    status: clientFile.status,
    totalAmount,
    totalPaid,
    outstanding,
    targetFiles: targetFiles.map((file) => ({
      id: file.id,
      fileNumber: file.fileNumber,
      title: file.title,
      clientName: file.client.name,
    })),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const fileId = parseFileId(id);

    if (fileId === null) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID." },
        { status: 400 }
      );
    }

    const details = await getCancellationDetails(fileId);

    if (!details) {
      return NextResponse.json(
        { success: false, message: "Client file not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...details,
    });
  } catch (error) {
    console.error("Load cancellation details error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Unable to load cancellation details.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const fileId = parseFileId(id);

    if (fileId === null) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";
    const settlementValue = body.settlement;
    const settlement = isSettlement(settlementValue)
      ? settlementValue
      : null;

    const rawTarget = body.transferTargetClientFileId;
    const transferTargetClientFileId =
      rawTarget === null ||
      rawTarget === undefined ||
      rawTarget === ""
        ? null
        : Number(rawTarget);

    if (!reason) {
      return NextResponse.json(
        {
          success: false,
          message: "Cancellation reason is required.",
        },
        { status: 400 }
      );
    }

    if (reason.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          message: "Cancellation reason is too long.",
        },
        { status: 400 }
      );
    }

    if (!settlement) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid payment settlement is required.",
        },
        { status: 400 }
      );
    }

    const details = await getCancellationDetails(fileId);

    if (!details) {
      return NextResponse.json(
        { success: false, message: "Client file not found." },
        { status: 404 }
      );
    }

    if (details.status === FileStatus.CANCELLED) {
      return NextResponse.json(
        {
          success: false,
          message: "This file is already cancelled.",
        },
        { status: 400 }
      );
    }

    if (details.status === FileStatus.COMPLETED) {
      return NextResponse.json(
        {
          success: false,
          message: "Completed files cannot be cancelled.",
        },
        { status: 400 }
      );
    }

    if (details.totalPaid <= 0 && settlement !== "NO_PAYMENT") {
      return NextResponse.json(
        {
          success: false,
          message: "No payment exists. Select No payment received.",
        },
        { status: 400 }
      );
    }

    if (details.totalPaid > 0 && settlement === "NO_PAYMENT") {
      return NextResponse.json(
        {
          success: false,
          message: "A paid file requires a payment settlement choice.",
        },
        { status: 400 }
      );
    }

    let transferTargetId: number | null = null;

    if (settlement === "TRANSFER_CREDIT") {
      const parsedTransferTargetId =
        Number(transferTargetClientFileId);

      transferTargetId =
        Number.isInteger(parsedTransferTargetId) &&
        parsedTransferTargetId > 0
          ? parsedTransferTargetId
          : null;

      if (transferTargetId === null) {
        return NextResponse.json(
          {
            success: false,
            message: "A target client file is required for credit transfer.",
          },
          { status: 400 }
        );
      }

      if (transferTargetId === fileId) {
        return NextResponse.json(
          {
            success: false,
            message: "The cancelled file cannot be its own credit target.",
          },
          { status: 400 }
        );
      }

      const target = await prisma.clientFile.findFirst({
        where: {
          id: transferTargetId,
          status: {
            in: [
              FileStatus.OPEN,
              FileStatus.IN_PROGRESS,
              FileStatus.ON_HOLD,
            ],
          },
        },
        select: { id: true },
      });

      if (!target) {
        return NextResponse.json(
          {
            success: false,
            message: "Selected target file was not found or is not active.",
          },
          { status: 400 }
        );
      }
    }

    const existingCancellation = await prisma.clientFile.findUnique({
      where: { id: fileId },
      select: { status: true },
    });

    if (!existingCancellation || existingCancellation.status === FileStatus.CANCELLED) {
      return NextResponse.json(
        {
          success: false,
          message: "This file can no longer be cancelled.",
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const activeTasks = await tx.workflowTask.findMany({
        where: {
          fileWorkflow: {
            clientFileId: fileId,
          },
          status: {
            in: [
              TaskStatus.PENDING,
              TaskStatus.ACTIVE,
              TaskStatus.ON_HOLD,
            ],
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (activeTasks.length > 0) {
        await tx.taskHistory.createMany({
          data: activeTasks.map((task) => ({
            workflowTaskId: task.id,
            oldStatus: task.status,
            newStatus: TaskStatus.CANCELLED,
            remarks: "Task cancelled because client file was cancelled.",
          })),
        });

        await tx.workflowTask.updateMany({
          where: {
            id: {
              in: activeTasks.map((task) => task.id),
            },
          },
          data: {
            status: TaskStatus.CANCELLED,
          },
        });

        await tx.fileWorkflowSubTask.updateMany({
          where: {
            workflowTaskId: {
              in: activeTasks.map((task) => task.id),
            },
            status: {
              in: [
                TaskStatus.PENDING,
                TaskStatus.ACTIVE,
                TaskStatus.ON_HOLD,
              ],
            },
          },
          data: {
            status: TaskStatus.CANCELLED,
          },
        });
      }

      // ----------------------------------------------
      // Settlement handling
      // ----------------------------------------------
      // REFUND_PAID means the money was returned to the
      // client. Keep the original payment row for history,
      // but mark it REFUNDED so it no longer contributes
      // to current received totals.
      if (settlement === "REFUND_PAID") {
        await tx.payment.updateMany({
          where: {
            clientFileId: fileId,
            status: "CLEARED",
          },
          data: {
            status: "REFUNDED",
          },
        });
      }

      // A cancelled file has no future installment due.
      // Preserve the installment records, but mark any
      // active/paid installment as CANCELLED for history.
      await tx.paymentInstallment.updateMany({
        where: {
          clientFileId: fileId,
          status: {
            in: [
              "PENDING",
              "PARTIALLY_PAID",
              "PAID",
            ],
          },
        },
        data: {
          status: "CANCELLED",
        },
      });

      await tx.fileWorkflow.updateMany({
        where: {
          clientFileId: fileId,
          status: {
            not: "CANCELLED",
          },
        },
        data: {
          status: "CANCELLED",
          completedAt: null,
        },
      });

      await tx.calendarEvent.updateMany({
        where: {
          clientFileId: fileId,
          status: CalendarEventStatus.SCHEDULED,
        },
        data: {
          status: CalendarEventStatus.CANCELLED,
        },
      });

      await tx.clientFile.update({
        where: { id: fileId },
        data: {
          status: FileStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
          cancellationSettlement:
            settlement as FileCancellationSettlement,
          cancellationSettlementAmount: details.totalPaid,
          cancellationTransferTargetFileId:
            transferTargetId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Client file cancelled successfully.",
    });
  } catch (error) {
    console.error("Cancel file error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Unable to cancel client file.",
      },
      { status: 500 }
    );
  }
}
