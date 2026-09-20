import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{
    stepId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { stepId } = await context.params;
    const workflowStepId = Number(stepId);

    if (
      !Number.isInteger(workflowStepId) ||
      workflowStepId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid workflow step ID.",
        },
        { status: 400 }
      );
    }

    const step = await prisma.workflowStep.findUnique({
      where: {
        id: workflowStepId,
      },
    });

    if (!step) {
      return NextResponse.json(
        {
          success: false,
          message: "Workflow step not found.",
        },
        { status: 404 }
      );
    }

    if (!step.status) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cannot add a sub task to an inactive step.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const title = String(body.title ?? "").trim();

    const description =
      body.description === null ||
      body.description === undefined
        ? null
        : String(body.description).trim() || null;

    const defaultStaffId =
      body.defaultStaffId === null ||
      body.defaultStaffId === undefined ||
      body.defaultStaffId === ""
        ? null
        : Number(body.defaultStaffId);

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "Sub task name is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Validate default staff when selected
    // --------------------------------------------------

    let defaultStaffName: string | null = null;

    if (defaultStaffId !== null) {
      if (
        !Number.isInteger(defaultStaffId) ||
        defaultStaffId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid default staff.",
          },
          { status: 400 }
        );
      }

      const staff = await prisma.staff.findUnique({
        where: {
          id: defaultStaffId,
        },
      });

      if (!staff) {
        return NextResponse.json(
          {
            success: false,
            message: "Selected staff member was not found.",
          },
          { status: 404 }
        );
      }

      if (!staff.status) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Cannot assign an inactive staff member.",
          },
          { status: 400 }
        );
      }

      defaultStaffName = staff.name;
    }

    // --------------------------------------------------
    // Generate next subtask number
    // --------------------------------------------------

    const lastSubTask =
      await prisma.workflowSubTask.findFirst({
        where: {
          workflowStepId,
        },
        orderBy: {
          subTaskNumber: "desc",
        },
        select: {
          subTaskNumber: true,
        },
      });

    const nextSubTaskNumber =
      (lastSubTask?.subTaskNumber ?? 0) + 1;

    // --------------------------------------------------
    // Create subtask
    // --------------------------------------------------

    const subTask =
      await prisma.workflowSubTask.create({
        data: {
          workflowStepId,
          subTaskNumber: nextSubTaskNumber,
          title,
          description,
          defaultStaffId,
          status: true,
        },
      });

    // --------------------------------------------------
    // Audit log
    // --------------------------------------------------

    await writeAuditLog({
      module: "WORKFLOW",
      action: "CREATE_SUBTASK",
      entity: "WorkflowSubTask",
      entityId: subTask.id,
      description: `Created subtask "${title}" under workflow step "${step.title}"`,
      metadata: {
        subTaskId: subTask.id,
        subTaskNumber: nextSubTaskNumber,
        title,
        description,
        workflowStepId,
        workflowStepTitle: step.title,
        defaultStaffId,
        defaultStaffName,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Sub task created successfully.",
        subTask,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Create workflow sub task error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create sub task.",
      },
      { status: 500 }
    );
  }
}