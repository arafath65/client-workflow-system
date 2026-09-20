import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

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

    // --------------------------------------------------
    // Find workflow task and current staff assignment
    // --------------------------------------------------

    const task = await prisma.workflowTask.findUnique({
      where: { id },
      include: {
        assignedStaff: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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

    // --------------------------------------------------
    // Validate selected staff member
    // --------------------------------------------------

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

    // --------------------------------------------------
    // Update staff assignment
    // --------------------------------------------------

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

    // --------------------------------------------------
    // Audit Log: Staff assignment change
    // --------------------------------------------------

    const previousStaff = task.assignedStaff;
    const newStaff = updatedTask.assignedStaff;

    const isUnassignment = newStaff === null;

    await writeAuditLog({
      module: "WORKFLOW",
      action: isUnassignment
        ? "UNASSIGN_STAFF"
        : "ASSIGN_STAFF",
      entity: "WORKFLOW_TASK",
      entityId: task.id,
      description: isUnassignment
        ? `Removed staff assignment from workflow task #${task.id}.`
        : `Assigned ${newStaff.name} to workflow task #${task.id}.`,
      metadata: {
        taskId: task.id,
        previousStaffId:
          previousStaff?.id ?? null,
        previousStaffName:
          previousStaff?.name ?? null,
        newStaffId: newStaff?.id ?? null,
        newStaffName: newStaff?.name ?? null,
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