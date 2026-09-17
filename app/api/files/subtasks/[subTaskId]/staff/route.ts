
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
          message: "Invalid subtask.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const assignedStaffId = body.assignedStaffId;

    if (
      assignedStaffId !== null &&
      assignedStaffId !== undefined &&
      (!Number.isInteger(assignedStaffId) ||
        assignedStaffId <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid staff selection.",
        },
        { status: 400 }
      );
    }

    const subTask =
      await prisma.fileWorkflowSubTask.findUnique({
        where: { id },
      });

    if (!subTask) {
      return NextResponse.json(
        {
          success: false,
          message: "Subtask not found.",
        },
        { status: 404 }
      );
    }

    if (assignedStaffId !== null && assignedStaffId !== undefined) {
      const staff = await prisma.staff.findUnique({
        where: {
          id: assignedStaffId,
        },
      });

      if (!staff) {
        return NextResponse.json(
          {
            success: false,
            message: "Selected staff member not found.",
          },
          { status: 404 }
        );
      }
    }

    const updatedSubTask =
      await prisma.fileWorkflowSubTask.update({
        where: { id },
        data: {
          assignedStaffId:
            assignedStaffId === undefined
              ? null
              : assignedStaffId,
        },
        include: {
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
      message: "Subtask staff assignment updated.",
      subTask: updatedSubTask,
    });
  } catch (error) {
    console.error(
      "Update subtask staff error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update subtask staff.",
      },
      { status: 500 }
    );
  }
}