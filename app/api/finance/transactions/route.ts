import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma, PaymentStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const sessionUser = (await cookies()).get("session_user");

  if (!sessionUser?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(sessionUser.value);

  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const rawStatus = searchParams.get("status") ?? "ALL";
  const search = (searchParams.get("search") ?? "").trim();

  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1
  );

  const requestedPageSize = Number.parseInt(
    searchParams.get("pageSize") ?? String(PAGE_SIZE),
    10
  );

  const pageSize =
    Number.isInteger(requestedPageSize) && requestedPageSize > 0
      ? Math.min(requestedPageSize, 50)
      : PAGE_SIZE;

  if (!isDateString(from) || !isDateString(to)) {
    return NextResponse.json(
      { error: "Invalid date range." },
      { status: 400 }
    );
  }

  const status: PaymentStatus | "ALL" =
    rawStatus === "CLEARED"
      ? PaymentStatus.CLEARED
      : rawStatus === "REFUNDED"
        ? PaymentStatus.REFUNDED
        : rawStatus === "CANCELLED"
          ? PaymentStatus.CANCELLED
          : "ALL";

  const normalizedFrom = from <= to ? from : to;
  const normalizedTo = from <= to ? to : from;

  const rangeStart = new Date(
    `${normalizedFrom}T00:00:00+05:30`
  );

  const rangeEndExclusive = new Date(
    `${normalizedTo}T00:00:00+05:30`
  );
  rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);

  const where: Prisma.PaymentWhereInput = {
    ...(status === "ALL"
      ? {
          status: {
            in: [
              PaymentStatus.CLEARED,
              PaymentStatus.REFUNDED,
              PaymentStatus.CANCELLED,
            ],
          },
        }
      : {
          status,
        }),
    paidAt: {
      gte: rangeStart,
      lt: rangeEndExclusive,
    },
    ...(search
      ? {
          OR: [
            {
              clientFile: {
                fileNumber: {
                  contains: search,
                },
              },
            },
            {
              clientFile: {
                title: {
                  contains: search,
                },
              },
            },
            {
              clientFile: {
                client: {
                  name: {
                    contains: search,
                  },
                },
              },
            },
            {
              referenceNo: {
                contains: search,
              },
            },
          ],
        }
      : {}),
  };

  const total = await prisma.payment.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  const payments = await prisma.payment.findMany({
    where,
    select: {
      id: true,
      amount: true,
      paymentMethod: true,
      status: true,
      referenceNo: true,
      paidAt: true,
      clientFile: {
        select: {
          id: true,
          fileNumber: true,
          title: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { paidAt: "desc" },
      { id: "desc" },
    ],
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  return NextResponse.json({
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      referenceNo: payment.referenceNo,
      paidAt: payment.paidAt.toISOString(),
      clientFile: {
        id: payment.clientFile.id,
        fileNumber: payment.clientFile.fileNumber,
        title: payment.clientFile.title,
        client: {
          id: payment.clientFile.client.id,
          name: payment.clientFile.client.name,
        },
      },
    })),
    total,
    page: currentPage,
    pageSize,
    totalPages,
  });
}

function isDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
