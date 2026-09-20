import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

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

// ==================================================
// GET - Load Workflows
// ==================================================

export async function GET() {
  try {
    const workflows = await prisma.workflowTemplate.findMany({
      orderBy: {
        name: "asc",
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
      workflows,
    });
  } catch (error) {
    console.error("Load workflows error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load workflows.",
      },
      { status: 500 }
    );
  }
}

// ==================================================
// POST - Create Workflow
// ==================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const baseAmount = parseMoney(body.baseAmount);

    const rawDefaultStaffId = body.defaultStaffId;

    let defaultStaffId: number | null = null;

    if (
      rawDefaultStaffId !== undefined &&
      rawDefaultStaffId !== null &&
      rawDefaultStaffId !== ""
    ) {
      const parsedStaffId = Number(rawDefaultStaffId);

      if (!Number.isInteger(parsedStaffId) || parsedStaffId <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid default staff selection.",
          },
          { status: 400 }
        );
      }

      defaultStaffId = parsedStaffId;
    }

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

    if (defaultStaffId !== null) {
      const staff = await prisma.staff.findFirst({
        where: {
          id: defaultStaffId,
          status: true,
        },
        select: {
          id: true,
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

    const existingWorkflow = await prisma.workflowTemplate.findFirst({
      where: {
        name: {
          equals: name,
        },
      },
    });

    if (existingWorkflow) {
      return NextResponse.json(
        {
          success: false,
          message: "A workflow with this name already exists.",
        },
        { status: 409 }
      );
    }

    const workflow = await prisma.workflowTemplate.create({
      data: {
        name,
        description: description || null,
        defaultStaffId,
        baseAmount,
        status: true,
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

    // ==============================================
    // Audit log: workflow created
    // ==============================================

    await writeAuditLog({
      module: "WORKFLOW",
      action: "CREATE",
      entity: "WORKFLOW_TEMPLATE",
      entityId: workflow.id,
      description: `Created workflow: ${workflow.name}`,
      metadata: {
        workflowId: workflow.id,
        name: workflow.name,
        description: workflow.description,
        baseAmount: workflow.baseAmount,
        defaultStaffId: workflow.defaultStaffId,
        defaultStaffName: workflow.defaultStaff?.name ?? null,
        status: workflow.status,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Workflow created successfully.",
        workflow,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create workflow error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create workflow.",
      },
      { status: 500 }
    );
  }
}