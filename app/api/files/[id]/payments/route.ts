import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  PaymentMethod,
  PaymentStatus,
} from "@/generated/prisma/client";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "CHEQUE",
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  "PENDING",
  "CLEARED",
  "CANCELLED",
  "REFUNDED",
  "RETURNED",
  "BOUNCED",
];

// ==================================================
// Helpers
// ==================================================

function parseFileId(value: string): number | null {
  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseMoney(value: unknown): string | null {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    return null;
  }

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount.toFixed(2);
}

function parseDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return new Date();
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === "string" &&
    PAYMENT_METHODS.includes(value as PaymentMethod)
  );
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" &&
    PAYMENT_STATUSES.includes(value as PaymentStatus)
  );
}

function decimalToNumber(value: unknown): number {
  return Number(value ?? 0);
}

// ==================================================
// GET - Payment Summary
// ==================================================

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const clientFileId = parseFileId(id);

    if (clientFileId === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file ID.",
        },
        { status: 400 }
      );
    }

    const clientFile = await prisma.clientFile.findUnique({
      where: {
        id: clientFileId,
      },
      select: {
        id: true,
        fileNumber: true,
        status: true,
        fileWorkflows: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            baseAmount: true,
            discountAmount: true,
            finalAmount: true,
            status: true,
            workflowTemplate: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        charges: {
          orderBy: {
            createdAt: "asc",
          },
        },
        payments: {
          orderBy: {
            paidAt: "desc",
          },
          include: {
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
              orderBy: {
                createdAt: "asc",
              },
              select: {
                id: true,
                installmentId: true,
                amount: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!clientFile) {
      return NextResponse.json(
        {
          success: false,
          message: "Client file not found.",
        },
        { status: 404 }
      );
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

    const totalAmount = workflowFees + extraCharges;

    const clearedPayments = clientFile.payments.filter(
      (payment) => payment.status === "CLEARED"
    );

    const totalPaid = clearedPayments.reduce(
      (sum, payment) =>
        sum + decimalToNumber(payment.amount),
      0
    );

    const outstanding =
      clientFile.status === "CANCELLED"
        ? 0
        : Math.max(
            totalAmount - totalPaid,
            0
          );

    return NextResponse.json({
      success: true,
      fileNumber: clientFile.fileNumber,
      workflows: clientFile.fileWorkflows,
      charges: clientFile.charges,
      payments: clientFile.payments,
      summary: {
        workflowFees: workflowFees.toFixed(2),
        extraCharges: extraCharges.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        outstanding: outstanding.toFixed(2),
      },
    });
  } catch (error) {
    console.error("Load payment summary error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load payment summary.",
      },
      { status: 500 }
    );
  }
}

// ==================================================
// PATCH - Reverse Payment
// ==================================================

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const clientFileId = parseFileId(id);

    if (clientFileId === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file ID.",
        },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const paymentId =
      typeof body === "object" &&
      body !== null &&
      "paymentId" in body
        ? Number((body as { paymentId?: unknown }).paymentId)
        : NaN;

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment ID.",
        },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      select: {
        id: true,
        clientFileId: true,
        amount: true,
        status: true,
        clientFile: {
          select: { fileNumber: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment not found.",
        },
        { status: 404 }
      );
    }

    if (payment.clientFileId !== clientFileId) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment does not belong to this client file.",
        },
        { status: 400 }
      );
    }

    if (payment.status !== "CLEARED") {
      return NextResponse.json(
        {
          success: false,
          message: "Only a cleared payment can be reversed.",
        },
        { status: 400 }
      );
    }

    const updatedPayment = await prisma.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        status: "CANCELLED",
      },
    });

    await writeAuditLog({
      module: "PAYMENTS",
      action: "REVERSE",
      entity: "PAYMENT",
      entityId: updatedPayment.id,
      description: `Payment #${updatedPayment.id} reversed for client file ${payment.clientFile.fileNumber}.`,
      metadata: {
        paymentId: updatedPayment.id,
        clientFileId,
        fileNumber: payment.clientFile.fileNumber,
        amount: Number(payment.amount),
        previousStatus: payment.status,
        newStatus: updatedPayment.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Payment reversed successfully.",
      payment: updatedPayment,
    });
  } catch (error) {
    console.error("Reverse payment error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to reverse payment.",
      },
      { status: 500 }
    );
  }
}

// ==================================================
// POST - Record Payment Receipt
// ==================================================

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const clientFileId = parseFileId(id);

    if (clientFileId === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file ID.",
        },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const amount = parseMoney(body.amount);
    const paymentMethod = body.paymentMethod;
    const status =
      body.status === undefined ||
      body.status === null ||
      body.status === ""
        ? "CLEARED"
        : body.status;

    const referenceNo =
      typeof body.referenceNo === "string"
        ? body.referenceNo.trim() || null
        : null;

    const remarks =
      typeof body.remarks === "string"
        ? body.remarks.trim() || null
        : null;

    const paidAt = parseDate(body.paidAt);

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
          message:
            "Payment amount must be a valid positive amount with up to 2 decimal places.",
        },
        { status: 400 }
      );
    }

    if (!isPaymentMethod(paymentMethod)) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid payment method is required.",
        },
        { status: 400 }
      );
    }

    if (!isPaymentStatus(status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment status.",
        },
        { status: 400 }
      );
    }

    if (paidAt === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment date.",
        },
        { status: 400 }
      );
    }

    if (rawFileWorkflowId !== null) {
      if (
        !Number.isInteger(rawFileWorkflowId) ||
        rawFileWorkflowId <= 0
      ) {
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
      where: {
        id: clientFileId,
      },
      select: {
        id: true,
        fileNumber: true,
      },
    });

    if (!clientFile) {
      return NextResponse.json(
        {
          success: false,
          message: "Client file not found.",
        },
        { status: 404 }
      );
    }

    if (rawFileWorkflowId !== null) {
      const workflow =
        await prisma.fileWorkflow.findFirst({
          where: {
            id: rawFileWorkflowId,
            clientFileId,
          },
          select: {
            id: true,
          },
        });

      if (!workflow) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Selected workflow does not belong to this client file.",
          },
          { status: 400 }
        );
      }
    }

    const payment = await prisma.payment.create({
      data: {
        clientFileId,
        amount,
        paymentMethod,
        status,
        referenceNo,
        remarks,
        paidAt,
        fileWorkflowId: rawFileWorkflowId,
      },
      include: {
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
      },
    });

    await writeAuditLog({
      module: "PAYMENTS",
      action: "CREATE",
      entity: "PAYMENT",
      entityId: payment.id,
      description: `Payment #${payment.id} of ${amount} recorded for client file ${clientFile.fileNumber}.`,
      metadata: {
        paymentId: payment.id,
        clientFileId,
        fileNumber: clientFile.fileNumber,
        fileWorkflowId: rawFileWorkflowId,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        referenceNo: payment.referenceNo,
        paidAt: payment.paidAt.toISOString(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Payment recorded successfully.",
        payment,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create payment error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to record payment.",
      },
      { status: 500 }
    );
  }
}
