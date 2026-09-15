import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();

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
    // Check duplicate workflow name
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
    // Create workflow
    // ---------------------------------------------
    const workflow = await prisma.workflowTemplate.create({
      data: {
        name,
        description: description || null,
        status: true,
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