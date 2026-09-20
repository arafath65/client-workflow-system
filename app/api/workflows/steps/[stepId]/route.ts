import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{
    stepId: string;
  }>;
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

    const existingStep = await prisma.workflowStep.findUnique({
      where: {
        id,
      },
    });

    if (!existingStep) {
      return NextResponse.json(
        {
          success: false,
          message: "Workflow step not found.",
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    // --------------------------------------------------
    // Status update
    // --------------------------------------------------

    if (typeof body.status === "boolean") {
      const updatedStep = await prisma.workflowStep.update({
        where: {
          id,
        },
        data: {
          status: body.status,
        },
      });

      await writeAuditLog({
        module: "WORKFLOW",
        action: body.status ? "ACTIVATE_STEP" : "DEACTIVATE_STEP",
        entity: "WorkflowStep",
        entityId: id,
        description: body.status
          ? `Activated workflow step: ${existingStep.title}`
          : `Deactivated workflow step: ${existingStep.title}`,
        metadata: {
          workflowStepId: id,
          title: existingStep.title,
          previousStatus: existingStep.status,
          newStatus: body.status,
        },
      });

      return NextResponse.json({
        success: true,
        message: body.status
          ? "Workflow step activated successfully."
          : "Workflow step deactivated successfully.",
        step: updatedStep,
      });
    }

    // --------------------------------------------------
    // Step details update
    // --------------------------------------------------

    const title = String(body.title ?? "").trim();

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "Step name is required.",
        },
        { status: 400 }
      );
    }

    let defaultStaffId: number | null = null;

    if (
      body.defaultStaffId !== null &&
      body.defaultStaffId !== undefined &&
      body.defaultStaffId !== ""
    ) {
      defaultStaffId = Number(body.defaultStaffId);

      if (
        !Number.isInteger(defaultStaffId) ||
        defaultStaffId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid staff member.",
          },
          { status: 400 }
        );
      }

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
      where: {
        id,
      },
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

    await writeAuditLog({
      module: "WORKFLOW",
      action: "UPDATE_STEP",
      entity: "WorkflowStep",
      entityId: id,
      description: `Updated workflow step: ${title}`,
      metadata: {
        workflowStepId: id,
        previous: {
          title: existingStep.title,
          defaultStaffId: existingStep.defaultStaffId,
        },
        updated: {
          title: updatedStep.title,
          defaultStaffId: updatedStep.defaultStaffId,
          defaultStaffName: updatedStep.defaultStaff?.name ?? null,
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