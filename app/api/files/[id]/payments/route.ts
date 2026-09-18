import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

function parseDate(
  value: unknown
): Date | null {
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

function isPaymentMethod(
  value: unknown
): value is PaymentMethod {
  return (
    typeof value === "string" &&
    PAYMENT_METHODS.includes(value as PaymentMethod)
  );
}

function isPaymentStatus(
  value: unknown
): value is PaymentStatus {
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

    const outstanding = Math.max(
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

    const body = await request.json();

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

// ==================================================
// PATCH - Reverse / Cancel Payment
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

    const body = await request.json();

    const paymentId = Number(body.paymentId);

    if (
      !Number.isInteger(paymentId) ||
      paymentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment ID.",
        },
        { status: 400 }
      );
    }

    const payment =
      await prisma.payment.findFirst({
        where: {
          id: paymentId,
          clientFileId,
        },
        select: {
          id: true,
          amount: true,
          status: true,
          allocations: {
            select: {
              installmentId: true,
            },
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

    if (payment.status !== "CLEARED") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only cleared payments can be reversed.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Cancel payment
    // --------------------------------------------------

    const affectedInstallmentIds =
      payment.allocations.map(
        (allocation) =>
          allocation.installmentId
      );

    await prisma.$transaction(
      async (tx) => {
        await tx.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            status: "CANCELLED",
          },
        });

        // ------------------------------------------------
        // Recalculate affected installment statuses
        // ------------------------------------------------

        for (const installmentId of affectedInstallmentIds) {
          const installment =
            await tx.paymentInstallment.findUnique({
              where: {
                id: installmentId,
              },
              select: {
                amount: true,
              },
            });

          if (!installment) continue;

          const allocations =
            await tx.paymentAllocation.findMany({
              where: {
                installmentId,
                payment: {
                  status: "CLEARED",
                },
              },
              select: {
                amount: true,
              },
            });

          const allocatedAmount =
            allocations.reduce(
              (total, allocation) =>
                total +
                Number(allocation.amount),
              0
            );

          const installmentAmount =
            Number(installment.amount);

          let nextStatus:
            | "PENDING"
            | "PARTIALLY_PAID"
            | "PAID";

          if (
            allocatedAmount >=
            installmentAmount
          ) {
            nextStatus = "PAID";
          } else if (
            allocatedAmount > 0
          ) {
            nextStatus = "PARTIALLY_PAID";
          } else {
            nextStatus = "PENDING";
          }

          await tx.paymentInstallment.update({
            where: {
              id: installmentId,
            },
            data: {
              status: nextStatus,
            },
          });
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: "Payment reversed successfully.",
    });
  } catch (error) {
    console.error(
      "Reverse payment error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to reverse payment.",
      },
      { status: 500 }
    );
  }
}
