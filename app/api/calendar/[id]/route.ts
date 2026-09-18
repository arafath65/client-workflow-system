import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

function parseSriLankaDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();

  if (/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$/.test(raw)) {
    const date = new Date(`${raw}:00+05:30`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isStatus(value: unknown): value is (typeof STATUSES)[number] {
  return typeof value === "string" && STATUSES.includes(value as (typeof STATUSES)[number]);
}

async function validateRelations(clientFileId: number | null, staffId: number | null) {
  if (clientFileId !== null) {
    const clientFile = await prisma.clientFile.findUnique({
      where: { id: clientFileId },
      select: { id: true },
    });
    if (!clientFile) return "Selected client file was not found.";
  }

  if (staffId !== null) {
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true },
    });
    if (!staff) return "Selected staff member was not found.";
  }

  return null;
}

// ==================================================
// PATCH - Update Calendar Event
// ==================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const eventId = Number(id);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid calendar event ID." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const existing = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        clientFileId: true,
        staffId: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Calendar event not found." },
        { status: 404 }
      );
    }

    const data: {
      title?: string;
      description?: string | null;
      startAt?: Date;
      endAt?: Date | null;
      clientFileId?: number | null;
      staffId?: number | null;
      status?: (typeof STATUSES)[number];
    } = {};

    if (body.title !== undefined) {
      const title = String(body.title ?? "").trim();
      if (!title) {
        return NextResponse.json(
          { success: false, message: "Event title cannot be empty." },
          { status: 400 }
        );
      }
      data.title = title;
    }

    if (body.description !== undefined) {
      const description = String(body.description ?? "").trim();
      data.description = description || null;
    }

    const newStart = body.startAt === undefined
      ? existing.startAt
      : parseSriLankaDate(body.startAt);

    const newEnd =
      body.endAt === undefined
        ? existing.endAt
        : body.endAt === null || body.endAt === ""
          ? null
          : parseSriLankaDate(body.endAt);

    if (body.startAt !== undefined && !newStart) {
      return NextResponse.json(
        { success: false, message: "Invalid start date and time." },
        { status: 400 }
      );
    }

    if (body.endAt !== undefined && body.endAt && !newEnd) {
      return NextResponse.json(
        { success: false, message: "Invalid end date and time." },
        { status: 400 }
      );
    }

    if (newEnd && newStart && newEnd <= newStart) {
      return NextResponse.json(
        { success: false, message: "End time must be after start time." },
        { status: 400 }
      );
    }

    if (body.startAt !== undefined) data.startAt = newStart as Date;
    if (body.endAt !== undefined) data.endAt = newEnd;

    if (body.clientFileId !== undefined) {
      const value =
        body.clientFileId === null || body.clientFileId === ""
          ? null
          : Number(body.clientFileId);

      data.clientFileId =
        typeof value === "number" &&
        Number.isInteger(value) &&
        value > 0
          ? value
          : null;
    }

    if (body.staffId !== undefined) {
      const value =
        body.staffId === null || body.staffId === ""
          ? null
          : Number(body.staffId);

      data.staffId =
        typeof value === "number" &&
        Number.isInteger(value) &&
        value > 0
          ? value
          : null;
    }

    if (body.status !== undefined) {
      if (!isStatus(body.status)) {
        return NextResponse.json(
          { success: false, message: "Invalid calendar event status." },
          { status: 400 }
        );
      }
      data.status = body.status;
    }

    const relationError = await validateRelations(
      data.clientFileId === undefined ? existing.clientFileId : data.clientFileId,
      data.staffId === undefined ? existing.staffId : data.staffId
    );

    if (relationError) {
      return NextResponse.json(
        { success: false, message: relationError },
        { status: 400 }
      );
    }

    const event = await prisma.calendarEvent.update({
      where: { id: eventId },
      data,
      include: {
        clientFile: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
            client: { select: { id: true, name: true } },
          },
        },
        staff: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Calendar event updated successfully.",
      event,
    });
  } catch (error) {
    console.error("Update calendar event error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update calendar event." },
      { status: 500 }
    );
  }
}
