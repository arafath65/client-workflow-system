import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "Sub task name is required.",
        },
        { status: 400 }
      );
    }

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

    const subTask =
      await prisma.workflowSubTask.create({
        data: {
          workflowStepId,
          subTaskNumber: nextSubTaskNumber,
          title,
          description,
          status: true,
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