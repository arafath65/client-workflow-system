import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

// ==================================================
// GET - Load Staff
// ==================================================

export async function GET() {
  try {
    const staff = await prisma.staff.findMany({
      where: {
        status: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        position: true,
        status: true,
      },
    });

    return NextResponse.json({
      success: true,
      staff,
    });
  } catch (error) {
    console.error("Load staff error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load staff members.",
      },
      { status: 500 }
    );
  }
}

// ==================================================
// POST - Create Staff
// ==================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim();
    const position = String(body.position ?? "").trim();

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Staff name is required.",
        },
        { status: 400 }
      );
    }

    const staff = await prisma.staff.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        position: position || null,
      },
    });

    // Audit log: staff created
    await writeAuditLog({
      module: "STAFF",
      action: "CREATE",
      entity: "STAFF",
      entityId: staff.id,
      description: `Created staff member: ${staff.name}`,
      metadata: {
        staffId: staff.id,
        name: staff.name,
        position: staff.position,
        phone: staff.phone,
        email: staff.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Staff member created successfully.",
      staff,
    });
  } catch (error) {
    console.error("Create staff error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create staff member.",
      },
      { status: 500 }
    );
  }
}