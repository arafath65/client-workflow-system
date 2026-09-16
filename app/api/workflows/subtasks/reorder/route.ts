import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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