import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseMoney(value: unknown): string | null {
  const raw = String(value ?? "").trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    return null;
  }

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount.toFixed(2);
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const workflowId = Number(id);

    if (!Number.isInteger(workflowId) || workflowId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid workflow ID.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const existingWorkflow = await prisma.workflowTemplate.findUnique({
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

    // ==============================================
    // Activate / Deactivate
    // ==============================================

    if (typeof body.status === "boolean") {
      const workflow = await prisma.workflowTemplate.update({
        where: {
          id: workflowId,
        },
        data: {
          status: body.status,
        },
      });

      await writeAuditLog({
        module: "WORKFLOW",
        action: body.status ? "ACTIVATE" : "DEACTIVATE",
        entity: "WORKFLOW_TEMPLATE",
        entityId: workflow.id,
        description: body.status
          ? `Activated workflow: ${workflow.name}`
          : `Deactivated workflow: ${workflow.name}`,
        metadata: {
          workflowId: workflow.id,
          name: workflow.name,
          previousStatus: existingWorkflow.status,
          newStatus: workflow.status,
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

    // ==============================================
    // Edit workflow details
    // ==============================================

    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const baseAmount = parseMoney(body.baseAmount);

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Workflow name is required.",
        },
        { status: 400 }
      );
    }

    if (baseAmount === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid service price is required.",
        },
        { status: 400 }
      );
    }

    const duplicateWorkflow = await prisma.workflowTemplate.findFirst({
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
          message: "A workflow with this name already exists.",
        },
        { status: 409 }
      );
    }

    const rawDefaultStaffId = body.defaultStaffId;

    const defaultStaffId =
      rawDefaultStaffId === null ||
      rawDefaultStaffId === undefined ||
      rawDefaultStaffId === ""
        ? null
        : Number(rawDefaultStaffId);

    if (
      defaultStaffId !== null &&
      (!Number.isInteger(defaultStaffId) || defaultStaffId <= 0)
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

    const workflow = await prisma.workflowTemplate.update({
      where: {
        id: workflowId,
      },
      data: {
        name,
        description: description || null,
        defaultStaffId,
        baseAmount,
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

    // ==============================================
    // Audit log: workflow updated
    // ==============================================

    await writeAuditLog({
      module: "WORKFLOW",
      action: "UPDATE",
      entity: "WORKFLOW_TEMPLATE",
      entityId: workflow.id,
      description: `Updated workflow: ${workflow.name}`,
      metadata: {
        workflowId: workflow.id,
        previousValues: {
          name: existingWorkflow.name,
          description: existingWorkflow.description,
          baseAmount: existingWorkflow.baseAmount,
          defaultStaffId: existingWorkflow.defaultStaffId,
        },
        newValues: {
          name: workflow.name,
          description: workflow.description,
          baseAmount: workflow.baseAmount,
          defaultStaffId: workflow.defaultStaffId,
          defaultStaffName: workflow.defaultStaff?.name ?? null,
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