import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getColomboDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

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
  const getParam = (name: string) => searchParams.get(name) ?? "";

  const today = getColomboDate(new Date());
  const thirtyDaysAgo = addDays(today, -29);

  const fromParam = getParam("from");
  const toParam = getParam("to");
  const from = isDateString(fromParam) ? fromParam : thirtyDaysAgo;
  const to = isDateString(toParam) ? toParam : today;

  const moduleFilter = getParam("module");
  const action = getParam("action");
  const search = getParam("search").trim();

  const requestedPage = Number.parseInt(getParam("page"), 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const requestedPageSize = Number.parseInt(getParam("pageSize"), 10);
  const pageSize = Number.isInteger(requestedPageSize)
    ? Math.min(Math.max(requestedPageSize, 1), 100)
    : 20;

  const normalizedFrom = from <= to ? from : to;
  const normalizedTo = from <= to ? to : from;

  const rangeStart = new Date(`${normalizedFrom}T00:00:00+05:30`);
  const rangeEnd = new Date(`${normalizedTo}T00:00:00+05:30`);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  const where: Prisma.AuditLogWhereInput = {
    createdAt: {
      gte: rangeStart,
      lt: rangeEnd,
    },
    ...(moduleFilter ? { module: moduleFilter } : {}),
    ...(action ? { action } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search } },
            { entity: { contains: search } },
            { user: { username: { contains: search } } },
          ],
        }
      : {}),
  };

  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      createdAt: true,
      module: true,
      action: true,
      entity: true,
      entityId: true,
      description: true,
      user: {
        select: { username: true },
      },
    },
  });

  return NextResponse.json({
    logs,
    total,
    page: currentPage,
    pageSize,
    totalPages,
  });
}
