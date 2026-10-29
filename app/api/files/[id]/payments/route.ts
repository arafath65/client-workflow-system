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

type RefundAmountRow = {
  amount: unknown;
};

type RefundAwarePayment = {
  amount: unknown;
  status: string;
  refunds?: RefundAmountRow[];
};

function refundedAmount(payment: RefundAwarePayment): number {
  return (payment.refunds ?? []).reduce(
    (sum, refund) => sum + decimalToNumber(refund.amount),
    0
  );
}

/**
 * Returns the amount that still counts as money received for a payment.
 * Legacy REFUNDED rows without refund records are treated as fully refunded.
 */
function netPaidAmount(payment: RefundAwarePayment): number {
  const originalAmount = decimalToNumber(payment.amount);
  const refunds = refundedAmount(payment);

  if (payment.status === "CLEARED") {
    return Math.max(originalAmount - refunds, 0);
  }

  if (payment.status === "REFUNDED") {
    // Older versions marked a full refund by status only, without a refund row.
    if ((payment.refunds ?? []).length === 0) {
      return 0;
    }

    return Math.max(originalAmount - refunds, 0);
  }

  return 0;
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
            refunds: {
              orderBy: {
                refundedAt: "desc",
              },
              select: {
                id: true,
                amount: true,
                reason: true,
                refundedAt: true,
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

    // --------------------------------------------------
    // Billing Summary
    // --------------------------------------------------

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

    const totalAmount =
      workflowFees + extraCharges;

    const totalPaid = clientFile.payments.reduce(
      (sum, payment) => sum + netPaidAmount(payment),
      0
    );

    const paymentsWithRefundSummary = clientFile.payments.map((payment) => {
      const recordedRefunds = refundedAmount(payment);
      const totalRefundedForPayment =
        payment.status === "REFUNDED" && payment.refunds.length === 0
          ? decimalToNumber(payment.amount)
          : recordedRefunds;
      const remainingRefundable = Math.max(
        decimalToNumber(payment.amount) - totalRefundedForPayment,
        0
      );

      return {
        ...payment,
        refundedAmount: totalRefundedForPayment.toFixed(2),
        remainingRefundable: remainingRefundable.toFixed(2),
        displayStatus:
          payment.status === "CLEARED" && totalRefundedForPayment > 0
            ? "PARTIALLY_REFUNDED"
            : payment.status,
      };
    });

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
      payments: paymentsWithRefundSummary,
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
// PATCH - Reverse or Refund Payment
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

    const action =
      typeof body === "object" &&
      body !== null &&
      "action" in body &&
      typeof (body as { action?: unknown }).action === "string"
        ? (body as { action: string }).action.toUpperCase()
        : "REVERSE";

    if (action !== "REVERSE" && action !== "REFUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment action.",
        },
        { status: 400 }
      );
    }

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
      include: {
        refunds: {
          select: {
            amount: true,
            reason: true,
            refundedAt: true,
          },
        },
        clientFile: {
          select: {
            fileNumber: true,
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
          message: `Only a cleared payment can be ${action === "REFUND" ? "refunded" : "reversed"}.`,
        },
        { status: 400 }
      );
    }

    const alreadyRefunded = payment.refunds.reduce(
      (sum, refund) => sum + decimalToNumber(refund.amount),
      0
    );

    if (action === "REVERSE") {
      if (alreadyRefunded > 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This payment already has a refund. Refund the remaining amount instead of reversing it.",
          },
          { status: 400 }
        );
      }

      const reverseResult = await prisma.payment.updateMany({
        where: {
          id: paymentId,
          status: "CLEARED",
          updatedAt: payment.updatedAt,
        },
        data: {
          status: "CANCELLED",
          updatedAt: new Date(Math.max(Date.now(), payment.updatedAt.getTime() + 1)),
        },
      });

      if (reverseResult.count !== 1) {
        return NextResponse.json(
          {
            success: false,
            message: "This payment changed while you were processing it. Reload and try again.",
          },
          { status: 409 }
        );
      }

      const updatedPayment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });

      await writeAuditLog({
        module: "PAYMENTS",
        action: "REVERSE",
        entity: "PAYMENT",
        entityId: paymentId,
        description: `Payment ${paymentId} of LKR ${payment.amount.toFixed(2)} reversed for file ${payment.clientFile.fileNumber}.`,
        metadata: {
          paymentId,
          clientFileId,
          fileNumber: payment.clientFile.fileNumber,
          amount: payment.amount.toString(),
          oldStatus: "CLEARED",
          newStatus: "CANCELLED",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Payment reversed successfully.",
        payment: updatedPayment,
      });
    }

    const bodyObject = body as Record<string, unknown>;
    const refundAmount = parseMoney(bodyObject.amount ?? bodyObject.refundAmount);
    const reason =
      typeof bodyObject.reason === "string"
        ? bodyObject.reason.trim()
        : "";

    if (refundAmount === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid refund amount greater than zero.",
        },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        {
          success: false,
          message: "A reason is required for the refund.",
        },
        { status: 400 }
      );
    }

    const requestedRefund = Number(refundAmount);
    const remainingRefundable = Math.max(
      decimalToNumber(payment.amount) - alreadyRefunded,
      0
    );

    if (requestedRefund > remainingRefundable + 0.0001) {
      return NextResponse.json(
        {
          success: false,
          message: `Refund cannot exceed the remaining refundable amount of LKR ${remainingRefundable.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    // The compare-and-set update prevents two concurrent refund requests from
    // both refunding the same remaining balance.
    const refundResult = await prisma.$transaction(async (tx) => {
      const currentPayment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          refunds: {
            select: { amount: true },
          },
        },
      });

      if (!currentPayment || currentPayment.status !== "CLEARED") {
        throw new Error("PAYMENT_NOT_REFUNDABLE");
      }

      const currentRefunded = currentPayment.refunds.reduce(
        (sum, refund) => sum + decimalToNumber(refund.amount),
        0
      );
      const currentRemaining = Math.max(
        decimalToNumber(currentPayment.amount) - currentRefunded,
        0
      );

      if (requestedRefund > currentRemaining + 0.0001) {
        throw new Error("REFUND_EXCEEDS_REMAINING");
      }

      const lockResult = await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: "CLEARED",
          updatedAt: currentPayment.updatedAt,
        },
        data: {
          updatedAt: new Date(
            Math.max(Date.now(), currentPayment.updatedAt.getTime() + 1)
          ),
        },
      });

      if (lockResult.count !== 1) {
        throw new Error("PAYMENT_CHANGED_RETRY");
      }

      await tx.paymentRefund.create({
        data: {
          paymentId,
          amount: refundAmount,
          reason,
        },
      });

      const refundedAfter = currentRefunded + requestedRefund;
      const isFullyRefunded =
        refundedAfter >= decimalToNumber(currentPayment.amount) - 0.0001;

      const updatedPayment = isFullyRefunded
        ? await tx.payment.update({
            where: { id: paymentId },
            data: { status: "REFUNDED" },
            include: {
              refunds: {
                orderBy: { refundedAt: "desc" },
                select: {
                  id: true,
                  amount: true,
                  reason: true,
                  refundedAt: true,
                  createdAt: true,
                },
              },
            },
          })
        : await tx.payment.findUnique({
            where: { id: paymentId },
            include: {
              refunds: {
                orderBy: { refundedAt: "desc" },
                select: {
                  id: true,
                  amount: true,
                  reason: true,
                  refundedAt: true,
                  createdAt: true,
                },
              },
            },
          });

      if (!updatedPayment) {
        throw new Error("PAYMENT_NOT_FOUND_AFTER_REFUND");
      }

      return {
        payment: updatedPayment,
        totalRefunded: refundedAfter,
        isFullyRefunded,
      };
    });

    await writeAuditLog({
      module: "PAYMENTS",
      action: "REFUND",
      entity: "PAYMENT",
      entityId: paymentId,
      description: `Refunded LKR ${requestedRefund.toFixed(2)} from payment ${paymentId} for file ${payment.clientFile.fileNumber}. Reason: ${reason}`,
      metadata: {
        paymentId,
        clientFileId,
        fileNumber: payment.clientFile.fileNumber,
        originalAmount: payment.amount.toString(),
        refundAmount: refundAmount,
        totalRefunded: refundResult.totalRefunded.toFixed(2),
        remainingRefundable: Math.max(
          decimalToNumber(payment.amount) - refundResult.totalRefunded,
          0
        ).toFixed(2),
        reason,
        newStatus: refundResult.isFullyRefunded ? "REFUNDED" : "CLEARED",
      },
    });

    return NextResponse.json({
      success: true,
      message: refundResult.isFullyRefunded
        ? "Full refund recorded successfully."
        : "Partial refund recorded successfully.",
      payment: refundResult.payment,
      refundAmount: refundAmount,
      totalRefunded: refundResult.totalRefunded.toFixed(2),
      remainingRefundable: Math.max(
        decimalToNumber(payment.amount) - refundResult.totalRefunded,
        0
      ).toFixed(2),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYMENT_NOT_REFUNDABLE") {
        return NextResponse.json(
          { success: false, message: "This payment is no longer refundable." },
          { status: 400 }
        );
      }

      if (error.message === "REFUND_EXCEEDS_REMAINING") {
        return NextResponse.json(
          { success: false, message: "The requested refund exceeds the remaining refundable balance. Reload the payment and try again." },
          { status: 400 }
        );
      }

      if (error.message === "PAYMENT_CHANGED_RETRY") {
        return NextResponse.json(
          { success: false, message: "This payment was changed by another request. Reload and try again." },
          { status: 409 }
        );
      }
    }

    console.error("Payment action error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to process payment action.",
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
        status: true,
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
            refunds: {
              select: {
                amount: true,
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

    // --------------------------------------------------
    // Prevent overpayment
    //
    // Example:
    // Outstanding = 8,000
    // Payment     = 9,000
    // Result      = REJECTED
    // --------------------------------------------------

    const currentWorkflowFees =
      clientFile.fileWorkflows.reduce(
        (sum, workflow) =>
          sum +
          decimalToNumber(
            workflow.finalAmount
          ),
        0
      );

    const currentExtraCharges =
      clientFile.charges.reduce(
        (sum, charge) =>
          sum +
          decimalToNumber(
            charge.totalAmount
          ),
        0
      );

    const currentTotalAmount =
      currentWorkflowFees +
      currentExtraCharges;

    const currentTotalPaid = clientFile.payments.reduce(
      (sum, payment) => sum + netPaidAmount(payment),
      0
    );

    const currentOutstanding =
      clientFile.status === "CANCELLED"
        ? 0
        : Math.max(
            currentTotalAmount -
              currentTotalPaid,
            0
          );

    const requestedPayment =
      decimalToNumber(amount);

    if (
      status === "CLEARED" &&
      requestedPayment >
        currentOutstanding
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Payment amount cannot exceed the current outstanding balance of LKR ${currentOutstanding.toFixed(2)}.`,
        },
        { status: 400 }
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
      description: `Payment of ${amount} recorded for file ${clientFile.fileNumber}.`,
      metadata: {
        paymentId: payment.id,
        clientFileId,
        fileNumber: clientFile.fileNumber,
        amount,
        paymentMethod,
        status,
        referenceNo,
        paidAt: paidAt.toISOString(),
        fileWorkflowId: rawFileWorkflowId,
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
