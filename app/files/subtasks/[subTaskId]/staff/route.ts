import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    subTaskId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { subTaskId } = await params;

    const id = Number(subTaskId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid subtask ID.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const rawStaffId = body.assignedStaffId;

    // Empty / null means remove the subtask-specific override.
    const assignedStaffId =
      rawStaffId === null ||
      rawStaffId === undefined ||
      rawStaffId === ""
        ? null
        : Number(rawStaffId);

    if (
      assignedStaffId !== null &&
      (!Number.isInteger(assignedStaffId) ||
        assignedStaffId <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid staff ID.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Find File Subtask
    // --------------------------------------------------

    const fileSubTask =
      await prisma.fileWorkflowSubTask.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          workflowTaskId: true,
          assignedStaffId: true,
        },
      });

    if (!fileSubTask) {
      return NextResponse.json(
        {
          success: false,
          message: "File subtask not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // Validate Staff
    // --------------------------------------------------

    if (assignedStaffId !== null) {
      const staff =
        await prisma.staff.findUnique({
          where: {
            id: assignedStaffId,
          },

          select: {
            id: true,
            name: true,
            status: true,
          },
        });

      if (!staff) {
        return NextResponse.json(
          {
            success: false,
            message: "Staff member not found.",
          },
          { status: 404 }
        );
      }

      if (!staff.status) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Inactive staff cannot be assigned.",
          },
          { status: 400 }
        );
      }
    }

    // --------------------------------------------------
    // Update Subtask-Specific Assignment
    // --------------------------------------------------

    const updatedSubTask =
      await prisma.fileWorkflowSubTask.update({
        where: {
          id,
        },

        data: {
          assignedStaffId,
        },

        select: {
          id: true,
          assignedStaffId: true,

          assignedStaff: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    return NextResponse.json({
      success: true,

      message:
        assignedStaffId === null
          ? "Subtask staff override removed successfully."
          : "Subtask staff assigned successfully.",

      subTask: updatedSubTask,
    });
  } catch (error) {
    console.error(
      "Update file subtask staff error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update subtask staff.",
      },
      { status: 500 }
    );
  }
}