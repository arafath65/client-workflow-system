import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ stepId: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { stepId } = await context.params;
    const id = Number(stepId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid workflow step ID.",
        },
        { status: 400 }
      );
    }

    const step = await prisma.workflowStep.findUnique({
      where: { id },
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

    const body = await request.json();

    const title = String(body.title ?? "").trim();

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
          message: "Step name is required.",
        },
        { status: 400 }
      );
    }

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

    const updatedStep = await prisma.workflowStep.update({
      where: { id },
      data: {
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

    return NextResponse.json({
      success: true,
      message: "Workflow step updated successfully.",
      step: updatedStep,
    });
  } catch (error) {
    console.error("Update workflow step error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update workflow step.",
      },
      { status: 500 }
    );
  }
}