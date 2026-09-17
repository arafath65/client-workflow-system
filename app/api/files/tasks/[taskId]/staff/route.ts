
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { taskId } = await params;
    const id = Number(taskId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid workflow task.",
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

    const task = await prisma.workflowTask.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          message: "Workflow task not found.",
        },
        { status: 404 }
      );
    }

    if (
      assignedStaffId !== null &&
      assignedStaffId !== undefined
    ) {
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

    const updatedTask =
      await prisma.workflowTask.update({
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
      message: "Step staff assignment updated.",
      task: updatedTask,
    });
  } catch (error) {
    console.error(
      "Update step staff error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update step staff.",
      },
      { status: 500 }
    );
  }
}