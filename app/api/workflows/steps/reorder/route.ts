import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ReorderItem = {
  id: number;
  stepNumber: number;
};

export async function PATCH(
  request: NextRequest
) {
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

    return NextResponse.json({
      success: true,
      message:
        "Workflow step order updated successfully.",
    });
  } catch (error) {
    console.error(
      "Reorder workflow steps error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update workflow step order.",
      },
      { status: 500 }
    );
  }
}