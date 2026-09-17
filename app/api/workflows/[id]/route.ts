
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const workflowId = Number(id);

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

    const body = await request.json();

    const existingWorkflow =
      await prisma.workflowTemplate.findUnique({
        where: {
          id: workflowId,
        },
      });

    if (!existingWorkflow) {
      return NextResponse.json(
        {
          success: false,
          message: "Workflow not found.",
        },
        { status: 404 }
      );
    }

    // Preserve workflow activate/deactivate functionality.
    if (typeof body.status === "boolean") {
      const workflow =
        await prisma.workflowTemplate.update({
          where: {
            id: workflowId,
          },
          data: {
            status: body.status,
          },
        });

      return NextResponse.json({
        success: true,
        message: body.status
          ? "Workflow activated successfully."
          : "Workflow deactivated successfully.",
        workflow,
      });
    }

    const name = String(body.name ?? "").trim();

    const description = String(
      body.description ?? ""
    ).trim();

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Workflow name is required.",
        },
        { status: 400 }
      );
    }

    const duplicateWorkflow =
      await prisma.workflowTemplate.findFirst({
        where: {
          name: {
            equals: name,
          },
          NOT: {
            id: workflowId,
          },
        },
      });

    if (duplicateWorkflow) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A workflow with this name already exists.",
        },
        { status: 409 }
      );
    }

    // Validate the optional default main staff.
    const rawDefaultStaffId = body.defaultStaffId;

    const defaultStaffId =
      rawDefaultStaffId === null ||
      rawDefaultStaffId === undefined ||
      rawDefaultStaffId === ""
        ? null
        : Number(rawDefaultStaffId);

    if (
      defaultStaffId !== null &&
      (!Number.isInteger(defaultStaffId) ||
        defaultStaffId <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid default staff.",
        },
        { status: 400 }
      );
    }

    if (defaultStaffId !== null) {
      const staff = await prisma.staff.findUnique({
        where: {
          id: defaultStaffId,
        },
        select: {
          id: true,
          name: true,
          status: true,
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
            message: "Inactive staff cannot be assigned.",
          },
          { status: 400 }
        );
      }
    }

    const workflow =
      await prisma.workflowTemplate.update({
        where: {
          id: workflowId,
        },
        data: {
          name,
          description: description || null,
          defaultStaffId,
        },
        include: {
          defaultStaff: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

    return NextResponse.json({
      success: true,
      message: "Workflow updated successfully.",
      workflow,
    });
  } catch (error) {
    console.error("Update workflow error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update workflow.",
      },
      { status: 500 }
    );
  }
}