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

    // ---------------------------------------------
    // Validate ID
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
    // Read request body
    // ---------------------------------------------
    const body = await request.json();

    // ---------------------------------------------
    // Check workflow exists
    // ---------------------------------------------
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

    // ---------------------------------------------
    // Status update
    // ---------------------------------------------
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

    // ---------------------------------------------
    // Details update
    // ---------------------------------------------
    const name = String(
      body.name ?? ""
    ).trim();

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

    // ---------------------------------------------
    // Check duplicate name
    // ---------------------------------------------
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

    // ---------------------------------------------
    // Update workflow
    // ---------------------------------------------
    const workflow =
      await prisma.workflowTemplate.update({
        where: {
          id: workflowId,
        },
        data: {
          name,
          description: description || null,
        },
      });

    return NextResponse.json({
      success: true,
      message: "Workflow updated successfully.",
      workflow,
    });
  } catch (error) {
    console.error(
      "Update workflow error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update workflow.",
      },
      { status: 500 }
    );
  }
}