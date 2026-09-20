import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type ReorderItem = {
  id: number;
  subTaskNumber: number;
};

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const steps = body.steps as ReorderItem[];

    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sub task order.",
        },
        { status: 400 }
      );
    }

    for (const step of steps) {
      if (
        !Number.isInteger(step.id) ||
        !Number.isInteger(step.subTaskNumber) ||
        step.subTaskNumber <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid sub task data.",
          },
          { status: 400 }
        );
      }
    }

    const subTaskIds = steps.map((step) => step.id);

    const existingSubTasks =
      await prisma.workflowSubTask.findMany({
        where: {
          id: {
            in: subTaskIds,
          },
        },
        select: {
          id: true,
          workflowStepId: true,
          subTaskNumber: true,
          title: true,
        },
      });

    if (existingSubTasks.length !== steps.length) {
      return NextResponse.json(
        {
          success: false,
          message: "One or more sub tasks were not found.",
        },
        { status: 404 }
      );
    }

    const workflowStepIds = new Set(
      existingSubTasks.map(
        (subTask) => subTask.workflowStepId
      )
    );

    if (workflowStepIds.size !== 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Sub tasks must belong to the same workflow step.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Prepare audit information
    // --------------------------------------------------

    const existingSubTasksMap = new Map(
      existingSubTasks.map((subTask) => [
        subTask.id,
        subTask,
      ])
    );

    const previousOrder = steps.map((step) => {
      const existingSubTask =
        existingSubTasksMap.get(step.id)!;

      return {
        id: existingSubTask.id,
        title: existingSubTask.title,
        subTaskNumber: existingSubTask.subTaskNumber,
      };
    });

    const newOrder = steps.map((step) => {
      const existingSubTask =
        existingSubTasksMap.get(step.id)!;

      return {
        id: step.id,
        title: existingSubTask.title,
        subTaskNumber: step.subTaskNumber,
      };
    });

    const workflowStepId =
      existingSubTasks[0].workflowStepId;

    // --------------------------------------------------
    // Reorder subtasks
    // --------------------------------------------------

    await prisma.$transaction(async (tx) => {
      /*
       * First move the numbers to temporary negative values.
       * This prevents the unique constraint
       * (workflowStepId, subTaskNumber) from causing conflicts.
       */

      for (const subTask of steps) {
        await tx.workflowSubTask.update({
          where: {
            id: subTask.id,
          },
          data: {
            subTaskNumber: -subTask.subTaskNumber,
          },
        });
      }

      /*
       * Now assign the final numbers.
       */

      for (const subTask of steps) {
        await tx.workflowSubTask.update({
          where: {
            id: subTask.id,
          },
          data: {
            subTaskNumber: subTask.subTaskNumber,
          },
        });
      }
    });

    // --------------------------------------------------
    // Audit log
    // --------------------------------------------------

    await writeAuditLog({
      module: "WORKFLOW",
      action: "REORDER_SUBTASKS",
      entity: "WorkflowSubTask",
      description: `Reordered ${steps.length} subtask(s) in workflow step ID ${workflowStepId}.`,
      metadata: {
        workflowStepId,
        subTaskCount: steps.length,
        previousOrder,
        newOrder,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Sub task order updated successfully.",
    });
  } catch (error) {
    console.error(
      "Reorder workflow sub tasks error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update sub task order.",
      },
      { status: 500 }
    );
  }
}