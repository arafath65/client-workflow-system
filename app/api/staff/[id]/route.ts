import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const staffId = Number(id);

    if (!Number.isInteger(staffId) || staffId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid staff ID.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const existingStaff = await prisma.staff.findUnique({
      where: {
        id: staffId,
      },
    });

    if (!existingStaff) {
      return NextResponse.json(
        {
          success: false,
          message: "Staff member not found.",
        },
        { status: 404 }
      );
    }

    // ==============================================
    // Status-only update
    // ==============================================

    if (typeof body.status === "boolean") {
      const staff = await prisma.staff.update({
        where: {
          id: staffId,
        },
        data: {
          status: body.status,
        },
      });

      // Audit log: staff activated/deactivated
      await writeAuditLog({
        module: "STAFF",
        action: body.status ? "ACTIVATE" : "DEACTIVATE",
        entity: "STAFF",
        entityId: staff.id,
        description: body.status
          ? `Activated staff member: ${staff.name}`
          : `Deactivated staff member: ${staff.name}`,
        metadata: {
          staffId: staff.id,
          name: staff.name,
          previousStatus: existingStaff.status,
          newStatus: staff.status,
        },
      });

      return NextResponse.json({
        success: true,
        message: body.status
          ? "Staff member activated successfully."
          : "Staff member deactivated successfully.",
        staff,
      });
    }

    // ==============================================
    // Staff details update
    // ==============================================

    const name = String(body.name ?? "").trim();
    const position = String(body.position ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim();

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Staff name is required.",
        },
        { status: 400 }
      );
    }

    if (!position) {
      return NextResponse.json(
        {
          success: false,
          message: "Position is required.",
        },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          message: "Mobile number is required.",
        },
        { status: 400 }
      );
    }

    const staff = await prisma.staff.update({
      where: {
        id: staffId,
      },
      data: {
        name,
        position,
        phone,
        email: email || null,
      },
    });

    // Audit log: staff details updated
    await writeAuditLog({
      module: "STAFF",
      action: "UPDATE",
      entity: "STAFF",
      entityId: staff.id,
      description: `Updated staff details: ${staff.name}`,
      metadata: {
        staffId: staff.id,
        previousValues: {
          name: existingStaff.name,
          position: existingStaff.position,
          phone: existingStaff.phone,
          email: existingStaff.email,
        },
        newValues: {
          name: staff.name,
          position: staff.position,
          phone: staff.phone,
          email: staff.email,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Staff member updated successfully.",
      staff,
    });
  } catch (error) {
    console.error("Update staff error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update staff member.",
      },
      { status: 500 }
    );
  }
}