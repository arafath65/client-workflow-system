import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const allowedMethods = new Set([
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "CHEQUE",
]);

async function getSessionUserId() {
  const sessionUser = (await cookies()).get("session_user");
  if (!sessionUser?.value) return null;

  const userId = Number(sessionUser.value);
  if (!Number.isInteger(userId) || userId <= 0) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  return user?.id ?? null;
}

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: Context
) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const id = Number((await params).id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid expense ID." },
        { status: 400 }
      );
    }

    const existing = await prisma.expense.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Expense not found." },
        { status: 404 }
      );
    }

    const body = await request.json();

    const expenseDate = String(body.expenseDate ?? "").trim();
    const category = String(body.category ?? "").trim();
    const description = String(body.description ?? "").trim();
    const paymentMethod = String(body.paymentMethod ?? "CASH");
    const referenceNo = String(body.referenceNo ?? "").trim();
    const remarks = String(body.remarks ?? "").trim();
    const amount = Number(body.amount);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid expense date is required.",
        },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense category is required.",
        },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense description is required.",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense amount must be greater than zero.",
        },
        { status: 400 }
      );
    }

    if (!allowedMethods.has(paymentMethod)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment method.",
        },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        expenseDate: new Date(
          `${expenseDate}T00:00:00+05:30`
        ),
        category,
        description,
        amount: amount.toFixed(2),
        paymentMethod:
          paymentMethod as
            | "CASH"
            | "CARD"
            | "BANK_TRANSFER"
            | "CHEQUE",
        referenceNo: referenceNo || null,
        remarks: remarks || null,
      },
    });

    // --------------------------------------------------
    // Audit Log: Expense updated
    // --------------------------------------------------

    await writeAuditLog({
      userId,
      module: "EXPENSES",
      action: "UPDATE",
      entity: "EXPENSE",
      entityId: expense.id,
      description: `Updated expense "${description}" (ID: ${expense.id}).`,
      metadata: {
        expenseId: expense.id,

        previousValues: {
          expenseDate: existing.expenseDate.toISOString(),
          category: existing.category,
          description: existing.description,
          amount: String(existing.amount),
          paymentMethod: existing.paymentMethod,
          referenceNo: existing.referenceNo,
          remarks: existing.remarks,
        },

        newValues: {
          expenseDate: expense.expenseDate.toISOString(),
          category: expense.category,
          description: expense.description,
          amount: String(expense.amount),
          paymentMethod: expense.paymentMethod,
          referenceNo: expense.referenceNo,
          remarks: expense.remarks,
        },
      },
    });

    return NextResponse.json({
      success: true,
      expense,
    });
  } catch (error) {
    console.error("Update expense error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update expense.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: Context
) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const id = Number((await params).id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid expense ID." },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Get expense details before deletion
    // --------------------------------------------------

    const existing = await prisma.expense.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Expense not found." },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // Delete expense
    // --------------------------------------------------

    await prisma.expense.delete({
      where: { id },
    });

    // --------------------------------------------------
    // Audit Log: Expense deleted
    // --------------------------------------------------

    await writeAuditLog({
      userId,
      module: "EXPENSES",
      action: "DELETE",
      entity: "EXPENSE",
      entityId: existing.id,
      description: `Deleted expense "${existing.description}" (ID: ${existing.id}).`,
      metadata: {
        expenseId: existing.id,
        expenseDate: existing.expenseDate.toISOString(),
        category: existing.category,
        description: existing.description,
        amount: String(existing.amount),
        paymentMethod: existing.paymentMethod,
        referenceNo: existing.referenceNo,
        remarks: existing.remarks,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Expense deleted successfully.",
    });
  } catch (error) {
    console.error("Delete expense error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete expense.",
      },
      { status: 500 }
    );
  }
}