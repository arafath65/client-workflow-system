import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type ReorderItem = {
  id: number;
  stepNumber: number;
};

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const steps = body.steps as ReorderItem[];

    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid step order.",
        },
        { status: 400 }
      );
    }

    for (const step of steps) {
      if (
        !Number.isInteger(step.id) ||
        !Number.isInteger(step.stepNumber) ||
        step.stepNumber <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid step data.",
          },
          { status: 400 }
        );
      }
    }

    // --------------------------------------------------
    // Get existing step order for audit logging
    // --------------------------------------------------

    const stepIds = steps.map((step) => step.id);

    const existingSteps = await prisma.workflowStep.findMany({
      where: {
        id: {
          in: stepIds,
        },
      },
      select: {
        id: true,
        title: true,
        stepNumber: true,
      },
    });

    if (existingSteps.length !== stepIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "One or more workflow steps were not found.",
        },
        { status: 404 }
      );
    }

    const existingStepsMap = new Map(
      existingSteps.map((step) => [step.id, step])
    );

    const previousOrder = steps.map((step) => {
      const existingStep = existingStepsMap.get(step.id)!;

      return {
        id: existingStep.id,
        title: existingStep.title,
        stepNumber: existingStep.stepNumber,
      };
    });

    const newOrder = steps.map((step) => {
      const existingStep = existingStepsMap.get(step.id)!;

      return {
        id: step.id,
        title: existingStep.title,
        stepNumber: step.stepNumber,
      };
    });

    /*
     * Use temporary negative numbers first.
     *
     * This avoids unique constraint conflicts when
     * swapping positions such as:
     *
     * 1 -> 2
     * 2 -> 1
     */

    await prisma.$transaction(async (tx) => {
      for (const step of steps) {
        await tx.workflowStep.update({
          where: {
            id: step.id,
          },
          data: {
            stepNumber: -step.stepNumber,
          },
        });
      }

      for (const step of steps) {
        await tx.workflowStep.update({
          where: {
            id: step.id,
          },
          data: {
            stepNumber: step.stepNumber,
          },
        });
      }
    });

    // --------------------------------------------------
    // Audit log
    // --------------------------------------------------

    await writeAuditLog({
      module: "WORKFLOW",
      action: "REORDER_STEPS",
      entity: "WorkflowStep",
      description: `Reordered ${steps.length} workflow step(s).`,
      metadata: {
        stepCount: steps.length,
        previousOrder,
        newOrder,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Workflow step order updated successfully.",
    });
  } catch (error) {
    console.error(
      "Reorder workflow steps error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update workflow step order.",
      },
      { status: 500 }
    );
  }
}