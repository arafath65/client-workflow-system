import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

function parseSriLankaDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const raw = value.trim();

  // Accept a datetime-local value: 2026-09-18T14:30
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    const date = new Date(`${raw}:00+05:30`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isStatus(
  value: unknown
): value is (typeof STATUSES)[number] {
  return (
    typeof value === "string" &&
    STATUSES.includes(value as (typeof STATUSES)[number])
  );
}

async function validateRelations(
  clientFileId: number | null,
  staffId: number | null
) {
  if (clientFileId !== null) {
    const clientFile = await prisma.clientFile.findUnique({
      where: { id: clientFileId },
      select: { id: true },
    });

    if (!clientFile) {
      return "Selected client file was not found.";
    }
  }

  if (staffId !== null) {
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true },
    });

    if (!staff) {
      return "Selected staff member was not found.";
    }
  }

  return null;
}

// ==================================================
// GET - Calendar Events
// ==================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");

    const from = parseSriLankaDate(fromRaw);
    const to = parseSriLankaDate(toRaw);

    const events = await prisma.calendarEvent.findMany({
      where:
        from && to
          ? {
              startAt: {
                gte: from,
                lt: to,
              },
            }
          : undefined,
      orderBy: [{ startAt: "asc" }, { id: "asc" }],
      include: {
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
        staff: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("Load calendar events error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load calendar events.",
      },
      { status: 500 }
    );
  }
}

// ==================================================
// POST - Create Calendar Event
// ==================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();

    const date = String(body.date ?? "").trim();

    const startAt =
      body.startAt === null ||
      body.startAt === undefined ||
      body.startAt === ""
        ? parseSriLankaDate(`${date}T00:00`)
        : parseSriLankaDate(body.startAt);

    const endAt =
      body.endAt === null ||
      body.endAt === undefined ||
      body.endAt === ""
        ? null
        : parseSriLankaDate(body.endAt);

    const clientFileId =
      body.clientFileId === null ||
      body.clientFileId === undefined ||
      body.clientFileId === ""
        ? null
        : Number(body.clientFileId);

    const staffId =
      body.staffId === null ||
      body.staffId === undefined ||
      body.staffId === ""
        ? null
        : Number(body.staffId);

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "Event title is required.",
        },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid event date is required.",
        },
        { status: 400 }
      );
    }

    if (!startAt) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid event date is required.",
        },
        { status: 400 }
      );
    }

    if (body.endAt && !body.startAt) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Start time is required when an end time is entered.",
        },
        { status: 400 }
      );
    }

    if (body.endAt && !endAt) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid end date and time.",
        },
        { status: 400 }
      );
    }

    if (endAt && endAt <= startAt) {
      return NextResponse.json(
        {
          success: false,
          message: "End time must be after start time.",
        },
        { status: 400 }
      );
    }

    const normalizedClientFileId =
      typeof clientFileId === "number" &&
      Number.isInteger(clientFileId) &&
      clientFileId > 0
        ? clientFileId
        : null;

    const normalizedStaffId =
      typeof staffId === "number" &&
      Number.isInteger(staffId) &&
      staffId > 0
        ? staffId
        : null;

    const relationError = await validateRelations(
      normalizedClientFileId,
      normalizedStaffId
    );

    if (relationError) {
      return NextResponse.json(
        {
          success: false,
          message: relationError,
        },
        { status: 400 }
      );
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description: description || null,
        startAt,
        endAt,
        clientFileId: normalizedClientFileId,
        staffId: normalizedStaffId,
        status: "SCHEDULED",
      },
      include: {
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
        staff: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // --------------------------------------------------
    // Audit log
    // --------------------------------------------------

    await writeAuditLog({
      module: "CALENDAR",
      action: "CREATE_EVENT",
      entity: "CalendarEvent",
      entityId: event.id,
      description: `Created calendar event: ${event.title}`,
      metadata: {
        eventId: event.id,
        title: event.title,
        description: event.description,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt?.toISOString() ?? null,
        clientFileId: event.clientFileId,
        clientFileNumber: event.clientFile?.fileNumber ?? null,
        staffId: event.staffId,
        staffName: event.staff?.name ?? null,
        status: event.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Calendar event created successfully.",
      event,
    });
  } catch (error) {
    console.error("Create calendar event error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create calendar event.",
      },
      { status: 500 }
    );
  }
}