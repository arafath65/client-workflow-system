import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const workflowId = Number(id);

    // ---------------------------------------------
    // Validate workflow ID
    // ---------------------------------------------
    if (
      !Number.isInteger(workflowId) ||
      workflowId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid workflow ID.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------
    // Check workflow exists
    // ---------------------------------------------
    const workflow =
      await prisma.workflowTemplate.findUnique({
        where: {
          id: workflowId,
        },
      });

    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          message: "Workflow not found.",
        },
        { status: 404 }
      );
    }

    // ---------------------------------------------
    // Read request body
    // ---------------------------------------------
    const body = await request.json();

    const title = String(
      body.title ?? ""
    ).trim();

    const defaultStaffId =
      body.defaultStaffId === null ||
      body.defaultStaffId === undefined ||
      body.defaultStaffId === ""
        ? null
        : Number(body.defaultStaffId);

    // ---------------------------------------------
    // Validate step title
    // ---------------------------------------------
    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "Step name is required.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------
    // Validate staff if supplied
    // ---------------------------------------------
    if (
      defaultStaffId !== null &&
      (!Number.isInteger(defaultStaffId) ||
        defaultStaffId <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid staff member.",
        },
        { status: 400 }
      );
    }

    if (defaultStaffId !== null) {
      const staff = await prisma.staff.findFirst({
        where: {
          id: defaultStaffId,
          status: true,
        },
      });

      if (!staff) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Selected staff member is not active or does not exist.",
          },
          { status: 400 }
        );
      }
    }

    // ---------------------------------------------
    // Calculate next step number
    // ---------------------------------------------
    const lastStep =
      await prisma.workflowStep.findFirst({
        where: {
          workflowTemplateId: workflowId,
        },
        orderBy: {
          stepNumber: "desc",
        },
        select: {
          stepNumber: true,
        },
      });

    const nextStepNumber =
      (lastStep?.stepNumber ?? 0) + 1;

    // ---------------------------------------------
    // Create step
    // ---------------------------------------------
    const step = await prisma.workflowStep.create({
      data: {
        workflowTemplateId: workflowId,
        stepNumber: nextStepNumber,
        title,
        defaultStaffId,
      },
      include: {
        defaultStaff: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Workflow step created successfully.",
        step,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Create workflow step error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create workflow step.",
      },
      { status: 500 }
    );
  }
}