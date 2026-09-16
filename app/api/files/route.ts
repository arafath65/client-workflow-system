import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";

// ==================================================
// GET - Load Files
// ==================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";

    const files = await prisma.clientFile.findMany({
      where: search
        ? {
            OR: [
              {
                fileNumber: {
                  contains: search,
                },
              },
              {
                title: {
                  contains: search,
                },
              },
              {
                client: {
                  name: {
                    contains: search,
                  },
                },
              },
            ],
          }
        : undefined,

      include: {
        client: true,
        thirdParty: true,
        fileWorkflows: {
          include: {
            workflowTemplate: true,
            assignedStaff: true,
            tasks: {
              include: {
                workflowStep: true,
                assignedStaff: true,
                subTasks: {
                  include: {
                    workflowSubTask: true,
                    assignedStaff: true,
                  },
                },
              },
              orderBy: {
                workflowStep: {
                  stepNumber: "asc",
                },
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error("Load files error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load files.",
      },
      { status: 500 }
    );
  }
}

// ==================================================
// POST - Create File
// ==================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const clientId = Number(body.clientId);
    const workflowTemplateId = Number(
      body.workflowTemplateId
    );

    const assignedStaffId =
      body.assignedStaffId === null ||
      body.assignedStaffId === undefined ||
      body.assignedStaffId === ""
        ? null
        : Number(body.assignedStaffId);

    const thirdPartyId =
      body.thirdPartyId === null ||
      body.thirdPartyId === undefined ||
      body.thirdPartyId === ""
        ? null
        : Number(body.thirdPartyId);

    const fileNumberType =
      body.fileNumberType === "CUSTOM"
        ? "CUSTOM"
        : "SYSTEM";

    const customFileNumber = String(
      body.fileNumber ?? ""
    ).trim();

    const description = String(
      body.description ?? ""
    ).trim();

    // --------------------------------------------------
    // Validate Client
    // --------------------------------------------------

    if (!Number.isInteger(clientId) || clientId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid client is required.",
        },
        { status: 400 }
      );
    }

    const client = await prisma.client.findUnique({
      where: {
        id: clientId,
      },
    });

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          message: "Client not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // Validate Workflow
    // --------------------------------------------------

    if (
      !Number.isInteger(workflowTemplateId) ||
      workflowTemplateId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid service type is required.",
        },
        { status: 400 }
      );
    }

    const workflow =
      await prisma.workflowTemplate.findFirst({
        where: {
          id: workflowTemplateId,
          status: true,
        },
        include: {
          steps: {
            where: {
              status: true,
            },
            orderBy: {
              stepNumber: "asc",
            },
            include: {
              subTasks: {
                where: {
                  status: true,
                },
                orderBy: {
                  subTaskNumber: "asc",
                },
              },
            },
          },
        },
      });

    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          message: "Service type not found or inactive.",
        },
        { status: 404 }
      );
    }

    if (workflow.steps.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This service type does not have any active steps.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Validate Main Responsible Staff
    // --------------------------------------------------

    if (assignedStaffId !== null) {
      if (
        !Number.isInteger(assignedStaffId) ||
        assignedStaffId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid main responsible staff.",
          },
          { status: 400 }
        );
      }

      const staff = await prisma.staff.findFirst({
        where: {
          id: assignedStaffId,
          status: true,
        },
      });

      if (!staff) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Main responsible staff not found or inactive.",
          },
          { status: 404 }
        );
      }
    }

    // --------------------------------------------------
    // Validate Third Party
    // --------------------------------------------------

    if (thirdPartyId !== null) {
      if (
        !Number.isInteger(thirdPartyId) ||
        thirdPartyId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid third party.",
          },
          { status: 400 }
        );
      }

      const thirdParty =
        await prisma.thirdParty.findFirst({
          where: {
            id: thirdPartyId,
            status: true,
          },
        });

      if (!thirdParty) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Third party not found or inactive.",
          },
          { status: 404 }
        );
      }
    }

    // --------------------------------------------------
    // Generate / Validate File Number
    // --------------------------------------------------

    let fileNumber = "";

    if (fileNumberType === "CUSTOM") {
      if (!customFileNumber) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Custom file number is required.",
          },
          { status: 400 }
        );
      }

      fileNumber = customFileNumber;
    }

    // --------------------------------------------------
    // Create File + Workflow + Tasks + Subtasks
    // --------------------------------------------------

    const result = await prisma.$transaction(
      async (tx) => {
        // ----------------------------------------------
        // System Generated Number
        // ----------------------------------------------

        if (fileNumberType === "SYSTEM") {
          const sequence =
            await tx.fileNumberSequence.findUnique({
              where: {
                id: 1,
              },
            });

          const nextNumber =
            sequence?.nextNumber ?? 1;

          fileNumber =
            `AIG-${String(nextNumber).padStart(6, "0")}`;

          await tx.fileNumberSequence.upsert({
            where: {
              id: 1,
            },
            create: {
              id: 1,
              nextNumber: nextNumber + 1,
            },
            update: {
              nextNumber: nextNumber + 1,
            },
          });
        }

        // ----------------------------------------------
        // Duplicate File Number Check
        // ----------------------------------------------

        const existingFile =
          await tx.clientFile.findUnique({
            where: {
              fileNumber,
            },
          });

        if (existingFile) {
          throw new Error(
            "FILE_NUMBER_ALREADY_EXISTS"
          );
        }

        // ----------------------------------------------
        // Create Client File
        // ----------------------------------------------

        const clientFile =
          await tx.clientFile.create({
            data: {
              clientId,
              thirdPartyId,
              fileNumber,
              fileNumberType,
              title: workflow.name,
              description:
                description || null,
              status: "IN_PROGRESS",
            },
          });

        // ----------------------------------------------
        // Create File Workflow
        // ----------------------------------------------

        const fileWorkflow =
          await tx.fileWorkflow.create({
            data: {
              clientFileId: clientFile.id,
              workflowTemplateId:
                workflow.id,
              assignedStaffId,
              status: "IN_PROGRESS",
              startedAt: new Date(),
            },
          });

        // ----------------------------------------------
        // Create Workflow Tasks + Subtasks
        // ----------------------------------------------

        for (let index = 0; index < workflow.steps.length; index++) {
          const step = workflow.steps[index];

          const task =
            await tx.workflowTask.create({
              data: {
                fileWorkflowId:
                  fileWorkflow.id,

                workflowStepId:
                  step.id,

                // IMPORTANT:
                // null means "inherit from FileWorkflow"
                assignedStaffId: null,

                status:
                  index === 0
                    ? TaskStatus.ACTIVE
                    : TaskStatus.PENDING,

                startedAt:
                  index === 0
                    ? new Date()
                    : null,
              },
            });

          // --------------------------------------------
          // Create File Subtask Instances
          // --------------------------------------------

          if (step.subTasks.length > 0) {
            await tx.fileWorkflowSubTask.createMany({
              data: step.subTasks.map(
                (subTask) => ({
                  workflowTaskId: task.id,
                  workflowSubTaskId:
                    subTask.id,

                  // null means inherit effective
                  // staff from step/workflow
                  assignedStaffId: null,

                  status:
                    index === 0
                      ? TaskStatus.ACTIVE
                      : TaskStatus.PENDING,
                })
              ),
            });
          }
        }

        return clientFile;
      }
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "File created successfully.",
        file: result,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "FILE_NUMBER_ALREADY_EXISTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This file number already exists.",
        },
        { status: 409 }
      );
    }

    console.error("Create file error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create file.",
      },
      { status: 500 }
    );
  }
}