import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseFileId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseAmount(value: unknown): number | null {
  const raw = String(value ?? "").trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    return null;
  }

  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function decimalToNumber(value: unknown): number {
  return Number(value ?? 0);
}

async function buildInstallmentSummary(clientFileId: number) {
  const installments = await prisma.paymentInstallment.findMany({
    where: {
      clientFileId,
    },
    orderBy: [
      { dueDate: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      clientFileId: true,
      fileWorkflowId: true,
      dueDate: true,
      amount: true,
      status: true,
      remarks: true,
      createdAt: true,
      updatedAt: true,
      fileWorkflow: {
        select: {
          id: true,
          workflowTemplate: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      allocations: {
        select: {
          id: true,
          amount: true,
          paymentId: true,
          createdAt: true,
          payment: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  return installments.map((installment) => {
    const paidAmount = installment.allocations
      .filter((allocation) => allocation.payment.status === "CLEARED")
      .reduce(
        (sum, allocation) =>
          sum + decimalToNumber(allocation.amount),
        0
      );

    const amount = decimalToNumber(installment.amount);
    const remainingAmount = Math.max(amount - paidAmount, 0);

    return {
      id: installment.id,
      clientFileId: installment.clientFileId,
      fileWorkflowId: installment.fileWorkflowId,
      dueDate: installment.dueDate,
      amount: amount.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      remainingAmount: remainingAmount.toFixed(2),
      status: installment.status,
      remarks: installment.remarks,
      createdAt: installment.createdAt,
      updatedAt: installment.updatedAt,
      fileWorkflow: installment.fileWorkflow,
      allocations: installment.allocations.map((allocation) => ({
        id: allocation.id,
        paymentId: allocation.paymentId,
        amount: decimalToNumber(allocation.amount).toFixed(2),
        paymentStatus: allocation.payment.status,
        createdAt: allocation.createdAt,
      })),
    };
  });
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const clientFileId = parseFileId(id);

    if (clientFileId === null) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID." },
        { status: 400 }
      );
    }

    const clientFile = await prisma.clientFile.findUnique({
      where: { id: clientFileId },
      select: { id: true },
    });

    if (!clientFile) {
      return NextResponse.json(
        { success: false, message: "Client file not found." },
        { status: 404 }
      );
    }

    const installments = await buildInstallmentSummary(clientFileId);

    return NextResponse.json({
      success: true,
      installments,
    });
  } catch (error) {
    console.error("Load installments error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load installments.",
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
    const clientFileId = parseFileId(id);

    if (clientFileId === null) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID." },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const amount = parseAmount(body.amount);
    const dueDate = parseDate(body.dueDate);
    const remarks =
      typeof body.remarks === "string"
        ? body.remarks.trim() || null
        : null;

    const rawFileWorkflowId =
      body.fileWorkflowId === null ||
      body.fileWorkflowId === undefined ||
      body.fileWorkflowId === ""
        ? null
        : Number(body.fileWorkflowId);

    if (amount === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Installment amount must be a valid positive amount.",
        },
        { status: 400 }
      );
    }

    if (body.dueDate !== undefined && body.dueDate !== "" && dueDate === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid installment due date.",
        },
        { status: 400 }
      );
    }

    if (rawFileWorkflowId !== null) {
      if (!Number.isInteger(rawFileWorkflowId) || rawFileWorkflowId <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid workflow selection.",
          },
          { status: 400 }
        );
      }
    }

    const clientFile = await prisma.clientFile.findUnique({
      where: { id: clientFileId },
      select: {
        id: true,
        fileNumber: true,
        fileWorkflows: {
          select: {
            id: true,
            finalAmount: true,
          },
        },
        charges: {
          select: {
            totalAmount: true,
          },
        },
      },
    });

    if (!clientFile) {
      return NextResponse.json(
        { success: false, message: "Client file not found." },
        { status: 404 }
      );
    }

    if (rawFileWorkflowId !== null) {
      const workflowBelongsToFile = clientFile.fileWorkflows.some(
        (workflow) => workflow.id === rawFileWorkflowId
      );

      if (!workflowBelongsToFile) {
        return NextResponse.json(
          {
            success: false,
            message: "Selected workflow does not belong to this client file.",
          },
          { status: 400 }
        );
      }
    }

    const totalAmount =
      clientFile.fileWorkflows.reduce(
        (sum, workflow) => sum + decimalToNumber(workflow.finalAmount),
        0
      ) +
      clientFile.charges.reduce(
        (sum, charge) => sum + decimalToNumber(charge.totalAmount),
        0
      );

    const existingActiveInstallments =
      await prisma.paymentInstallment.findMany({
        where: {
          clientFileId,
          status: {
            not: "CANCELLED",
          },
        },
        select: {
          amount: true,
        },
      });

    const scheduledAmount = existingActiveInstallments.reduce(
      (sum, installment) =>
        sum + decimalToNumber(installment.amount),
      0
    );

    if (scheduledAmount + amount > totalAmount + 0.000001) {
      return NextResponse.json(
        {
          success: false,
          message: `Installment schedule cannot exceed the current total amount of ${totalAmount.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    const installment = await prisma.paymentInstallment.create({
      data: {
        clientFileId,
        fileWorkflowId: rawFileWorkflowId,
        dueDate,
        amount: amount.toFixed(2),
        status: "PENDING",
        remarks,
      },
      select: {
        id: true,
        clientFileId: true,
        fileWorkflowId: true,
        dueDate: true,
        amount: true,
        status: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeAuditLog({
      module: "PAYMENTS",
      action: "CREATE",
      entity: "PAYMENT_INSTALLMENT",
      entityId: installment.id,
      description: `Installment #${installment.id} of ${amount.toFixed(2)} created for client file ${clientFile.fileNumber}.`,
      metadata: {
        installmentId: installment.id,
        clientFileId,
        fileNumber: clientFile.fileNumber,
        fileWorkflowId: rawFileWorkflowId,
        amount: amount.toFixed(2),
        dueDate: dueDate?.toISOString() ?? null,
        remarks,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Installment created successfully.",
        installment: {
          ...installment,
          amount: decimalToNumber(installment.amount).toFixed(2),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create installment error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create installment.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const clientFileId = parseFileId(id);

    if (clientFileId === null) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID." },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const installmentId = Number(body.installmentId);

    if (!Number.isInteger(installmentId) || installmentId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid installment ID." },
        { status: 400 }
      );
    }

    const installment = await prisma.paymentInstallment.findFirst({
      where: {
        id: installmentId,
        clientFileId,
      },
      select: {
        id: true,
        amount: true,
        status: true,
        dueDate: true,
        remarks: true,
        fileWorkflowId: true,
        allocations: {
          select: {
            amount: true,
            payment: {
              select: {
                status: true,
              },
            },
          },
        },
        clientFile: {
          select: {
            fileNumber: true,
          },
        },
      },
    });

    if (!installment) {
      return NextResponse.json(
        { success: false, message: "Installment not found." },
        { status: 404 }
      );
    }

    const paidAmount = installment.allocations
      .filter((allocation) => allocation.payment.status === "CLEARED")
      .reduce(
        (sum, allocation) =>
          sum + decimalToNumber(allocation.amount),
        0
      );

    const requestedStatus =
      typeof body.status === "string" ? body.status : null;

    if (requestedStatus === "CANCELLED") {
      if (paidAmount > 0.000001) {
        return NextResponse.json(
          {
            success: false,
            message: "A partially paid or paid installment cannot be cancelled.",
          },
          { status: 400 }
        );
      }

      const updated = await prisma.paymentInstallment.update({
        where: { id: installmentId },
        data: {
          status: "CANCELLED",
        },
      });

      await writeAuditLog({
        module: "PAYMENTS",
        action: "CANCEL",
        entity: "PAYMENT_INSTALLMENT",
        entityId: updated.id,
        description: `Installment #${updated.id} cancelled for client file ${installment.clientFile.fileNumber}.`,
        metadata: {
          installmentId: updated.id,
          clientFileId,
          fileNumber: installment.clientFile.fileNumber,
          previousStatus: installment.status,
          newStatus: "CANCELLED",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Installment cancelled successfully.",
        installment: updated,
      });
    }

    const hasEditableFields =
      Object.prototype.hasOwnProperty.call(body, "amount") ||
      Object.prototype.hasOwnProperty.call(body, "dueDate") ||
      Object.prototype.hasOwnProperty.call(body, "remarks");

    if (!hasEditableFields) {
      return NextResponse.json(
        {
          success: false,
          message: "No installment changes were provided.",
        },
        { status: 400 }
      );
    }

    const nextAmount =
      body.amount === undefined
        ? decimalToNumber(installment.amount)
        : parseAmount(body.amount);

    if (nextAmount === null || nextAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Installment amount must be a valid positive amount.",
        },
        { status: 400 }
      );
    }

    if (nextAmount + 0.000001 < paidAmount) {
      return NextResponse.json(
        {
          success: false,
          message: `Installment amount cannot be less than the amount already paid (${paidAmount.toFixed(2)}).`,
        },
        { status: 400 }
      );
    }

    const nextDueDate =
      body.dueDate === undefined
        ? installment.dueDate
        : parseDate(body.dueDate);

    if (
      body.dueDate !== undefined &&
      body.dueDate !== "" &&
      nextDueDate === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid installment due date.",
        },
        { status: 400 }
      );
    }

    const nextRemarks =
      body.remarks === undefined
        ? installment.remarks
        : typeof body.remarks === "string"
          ? body.remarks.trim() || null
          : null;

    const updated = await prisma.paymentInstallment.update({
      where: { id: installmentId },
      data: {
        amount: nextAmount.toFixed(2),
        dueDate: nextDueDate,
        remarks: nextRemarks,
        status:
          paidAmount >= nextAmount
            ? "PAID"
            : paidAmount > 0
              ? "PARTIALLY_PAID"
              : "PENDING",
      },
    });

    await writeAuditLog({
      module: "PAYMENTS",
      action: "UPDATE",
      entity: "PAYMENT_INSTALLMENT",
      entityId: updated.id,
      description: `Installment #${updated.id} updated for client file ${installment.clientFile.fileNumber}.`,
      metadata: {
        installmentId: updated.id,
        clientFileId,
        fileNumber: installment.clientFile.fileNumber,
        previousAmount: decimalToNumber(installment.amount).toFixed(2),
        newAmount: nextAmount.toFixed(2),
        previousDueDate: installment.dueDate?.toISOString() ?? null,
        newDueDate: nextDueDate?.toISOString() ?? null,
        previousStatus: installment.status,
        newStatus: updated.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Installment updated successfully.",
      installment: {
        ...updated,
        amount: decimalToNumber(updated.amount).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Update installment error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update installment.",
      },
      { status: 500 }
    );
  }
}
