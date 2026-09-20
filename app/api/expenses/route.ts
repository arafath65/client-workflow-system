import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { cookies } from "next/headers";

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

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const search = (searchParams.get("search") || "").trim();

    const where: Prisma.ExpenseWhereInput = {};

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(from) &&
      /^\d{4}-\d{2}-\d{2}$/.test(to)
    ) {
      const start = new Date(`${from}T00:00:00+05:30`);
      const end = new Date(`${to}T00:00:00+05:30`);
      end.setUTCDate(end.getUTCDate() + 1);

      where.expenseDate = { gte: start, lt: end };
    }

    if (search) {
      where.OR = [
        { category: { contains: search } },
        { description: { contains: search } },
        { referenceNo: { contains: search } },
        { remarks: { contains: search } },
      ];
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { expenseDate: "desc" },
      take: 250,
      select: {
        id: true,
        expenseDate: true,
        category: true,
        description: true,
        amount: true,
        paymentMethod: true,
        referenceNo: true,
        remarks: true,
        createdBy: { select: { username: true } },
      },
    });

    return NextResponse.json({
      success: true,
      expenses: expenses.map((expense) => ({
        ...expense,
        amount: Number(expense.amount),
        createdByName: expense.createdBy.username,
      })),
    });
  } catch (error) {
    console.error("Load expenses error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load expenses.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
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

    const expense = await prisma.expense.create({
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
        createdByUserId: userId,
      },
    });

    // --------------------------------------------------
    // Audit Log: Expense created
    // --------------------------------------------------

    await writeAuditLog({
      userId,
      module: "EXPENSES",
      action: "CREATE",
      entity: "EXPENSE",
      entityId: expense.id,
      description: `Created expense "${description}" for ${amount.toFixed(2)}.`,
      metadata: {
        expenseId: expense.id,
        expenseDate: expense.expenseDate.toISOString(),
        category,
        description,
        amount: amount.toFixed(2),
        paymentMethod,
        referenceNo: referenceNo || null,
        remarks: remarks || null,
      },
    });

    return NextResponse.json(
      { success: true, expense },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create expense error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create expense.",
      },
      { status: 500 }
    );
  }
}