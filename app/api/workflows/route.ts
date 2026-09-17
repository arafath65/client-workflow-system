
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // ---------------------------------------------
    // Parse Default Staff
    // ---------------------------------------------

    const rawDefaultStaffId = body.defaultStaffId;

    let defaultStaffId: number | null = null;

    if (
      rawDefaultStaffId !== undefined &&
      rawDefaultStaffId !== null &&
      rawDefaultStaffId !== ""
    ) {
      const parsedStaffId = Number(rawDefaultStaffId);

      if (
        !Number.isInteger(parsedStaffId) ||
        parsedStaffId <= 0
      ) {
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

    // ---------------------------------------------
    // Validation
    // ---------------------------------------------

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
    // Validate Default Staff
    // ---------------------------------------------

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
            message: "Selected staff member is not active or does not exist.",
          },
          { status: 400 }
        );
      }
    }

    // ---------------------------------------------
    // Check Duplicate Workflow Name
    // ---------------------------------------------

    const existingWorkflow =
      await prisma.workflowTemplate.findFirst({
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

    // ---------------------------------------------
    // Create Workflow
    // ---------------------------------------------

    const workflow = await prisma.workflowTemplate.create({
      data: {
        name,
        description: description || null,
        defaultStaffId,
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