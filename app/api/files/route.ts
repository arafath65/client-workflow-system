
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { TaskStatus } from "@/generated/prisma/client";

// ==================================================
// Types
// ==================================================

type DocumentInput = {
  documentTypeId?: unknown;
  baseAmount?: unknown;
  discountAmount?: unknown;
};

type PreparedDocument = {
  documentTypeId: number;
  documentName: string;
  baseAmount: string;
  discountAmount: string;
  finalAmount: string;
  sortOrder: number;
};

// ==================================================
// Money Parser
// ==================================================

function parseMoney(
  value: unknown
): string | null {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return "0.00";
  }

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
// GET - Load Files
// ==================================================

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const search =
      searchParams.get("search")?.trim() ||
      "";

    const files =
      await prisma.clientFile.findMany({
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

              documents: {
                include: {
                  documentType: true,
                },
                orderBy: {
                  sortOrder: "asc",
                },
              },

              tasks: {
                include: {
                  workflowStep: true,

                  assignedStaff: true,

                  fileWorkflowDocument: true,

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
    console.error(
      "Load files error:",
      error
    );

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

export async function POST(
  request: NextRequest
) {
  try {
    const body: Record<
      string,
      unknown
    > = await request.json();

    // --------------------------------------------------
    // Basic Values
    // --------------------------------------------------

    const clientId =
      Number(body.clientId);

    const workflowTemplateId =
      Number(
        body.workflowTemplateId
      );

    const assignedStaffId =
      body.assignedStaffId === null ||
      body.assignedStaffId ===
        undefined ||
      body.assignedStaffId === ""
        ? null
        : Number(
            body.assignedStaffId
          );

    const thirdPartyId =
      body.thirdPartyId === null ||
      body.thirdPartyId ===
        undefined ||
      body.thirdPartyId === ""
        ? null
        : Number(
            body.thirdPartyId
          );

    const fileNumberType =
      body.fileNumberType === "CUSTOM"
        ? "CUSTOM"
        : "SYSTEM";

    const customFileNumber =
      String(
        body.fileNumber ?? ""
      ).trim();

    const description =
      String(
        body.description ?? ""
      ).trim();

    // ==================================================
    // Validate Client
    // ==================================================

    if (
      !Number.isInteger(clientId) ||
      clientId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid client is required.",
        },
        { status: 400 }
      );
    }

    const client =
      await prisma.client.findUnique({
        where: {
          id: clientId,
        },
      });

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Client not found.",
        },
        { status: 404 }
      );
    }

    // ==================================================
    // Validate Workflow
    // ==================================================

    if (
      !Number.isInteger(
        workflowTemplateId
      ) ||
      workflowTemplateId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid service type is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Load Workflow + Steps
    // --------------------------------------------------

    const workflow =
      await prisma.workflowTemplate.findFirst(
        {
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
                    subTaskNumber:
                      "asc",
                  },
                },
              },
            },
          },
        }
      );

    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Service type not found or inactive.",
        },
        { status: 404 }
      );
    }

    if (
      workflow.steps.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This service type does not have any active steps.",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // Determine Tracking Mode
    // ==================================================

    const isDocumentBased =
      workflow.trackingMode ===
      "DOCUMENT_BASED";

    // ==================================================
    // Document Based Preparation
    // ==================================================

    const rawDocuments: unknown[] =
      Array.isArray(body.documents)
        ? body.documents
        : [];

    let preparedDocuments: PreparedDocument[] =
      [];

    if (isDocumentBased) {
      // ------------------------------------------------
      // At least one document
      // ------------------------------------------------

      if (
        rawDocuments.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "At least one document is required for a document-based service.",
          },
          { status: 400 }
        );
      }

      // ------------------------------------------------
      // Extract Document Type IDs
      // ------------------------------------------------

      const documentTypeIds: number[] =
        rawDocuments.map(
          (item: unknown): number => {
            if (
              typeof item !==
                "object" ||
              item === null ||
              Array.isArray(item)
            ) {
              return NaN;
            }

            const input =
              item as DocumentInput;

            return Number(
              input.documentTypeId
            );
          }
        );

      // ------------------------------------------------
      // Validate Document Type IDs
      // ------------------------------------------------

      const hasInvalidId =
        documentTypeIds.some(
          (id: number) =>
            !Number.isInteger(id) ||
            id <= 0
        );

      if (hasInvalidId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Every document must have a valid Document Type.",
          },
          { status: 400 }
        );
      }

      // ------------------------------------------------
      // Duplicate Document Type Check
      // ------------------------------------------------

      const uniqueIds =
        new Set<number>(
          documentTypeIds
        );

      if (
        uniqueIds.size !==
        documentTypeIds.length
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The same Document Type cannot be added more than once to the same client file.",
          },
          { status: 400 }
        );
      }

      // ------------------------------------------------
      // Load Active Document Types
      // ------------------------------------------------

      const documentTypes =
        await prisma.documentType.findMany(
          {
            where: {
              id: {
                in: documentTypeIds,
              },
              status: true,
            },

            select: {
              id: true,
              name: true,
              defaultAmount: true,
            },
          }
        );

      // ------------------------------------------------
      // Check All Document Types Exist
      // ------------------------------------------------

      if (
        documentTypes.length !==
        uniqueIds.size
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "One or more selected Document Types are missing or inactive.",
          },
          { status: 400 }
        );
      }

      // ------------------------------------------------
      // Create Lookup Map
      // ------------------------------------------------

      const documentTypeMap =
        new Map(
          documentTypes.map(
            (documentType) => [
              documentType.id,
              documentType,
            ]
          )
        );

      // ------------------------------------------------
      // Prepare Document Instances
      // ------------------------------------------------

      preparedDocuments =
        rawDocuments.map(
          (
            item: unknown,
            index: number
          ): PreparedDocument => {
            if (
              typeof item !==
                "object" ||
              item === null ||
              Array.isArray(item)
            ) {
              throw new Error(
                "DOCUMENT_TYPE_NOT_FOUND"
              );
            }

            const input =
              item as DocumentInput;

            const documentTypeId =
              Number(
                input.documentTypeId
              );

            const documentType =
              documentTypeMap.get(
                documentTypeId
              );

            if (!documentType) {
              throw new Error(
                "DOCUMENT_TYPE_NOT_FOUND"
              );
            }

            // --------------------------------------------
            // Base Amount
            // --------------------------------------------

            let baseAmount: string;

            const submittedBase =
              input.baseAmount;

            if (
              submittedBase !==
                undefined &&
              submittedBase !==
                null &&
              String(
                submittedBase
              ).trim() !== ""
            ) {
              const parsed =
                parseMoney(
                  submittedBase
                );

              if (
                parsed === null
              ) {
                throw new Error(
                  "INVALID_DOCUMENT_BASE_AMOUNT"
                );
              }

              baseAmount =
                parsed;
            } else {
              baseAmount =
                documentType.defaultAmount.toFixed(
                  2
                );
            }

            // --------------------------------------------
            // Discount
            // --------------------------------------------

            const discountAmount =
              parseMoney(
                input.discountAmount
              );

            if (
              discountAmount ===
              null
            ) {
              throw new Error(
                "INVALID_DOCUMENT_DISCOUNT"
              );
            }

            // --------------------------------------------
            // Final Amount
            // --------------------------------------------

            const baseCents =
              Math.round(
                Number(
                  baseAmount
                ) * 100
              );

            const discountCents =
              Math.round(
                Number(
                  discountAmount
                ) * 100
              );

            if (
              discountCents >
              baseCents
            ) {
              throw new Error(
                "DOCUMENT_DISCOUNT_GREATER_THAN_BASE"
              );
            }

            const finalAmount =
              (
                (baseCents -
                  discountCents) /
                100
              ).toFixed(2);

            return {
              documentTypeId,

              documentName:
                documentType.name,

              baseAmount,

              discountAmount,

              finalAmount,

              sortOrder:
                index,
            };
          }
        );
    }

    // ==================================================
    // Pricing
    // ==================================================

    let baseAmount: string;
    let discountAmount: string;
    let finalAmount: string;

    if (isDocumentBased) {
      // ------------------------------------------------
      // Parent FileWorkflow totals
      // ------------------------------------------------

      const totals =
        preparedDocuments.reduce(
          (
            sum,
            document
          ) => ({
            base:
              sum.base +
              Number(
                document.baseAmount
              ),

            discount:
              sum.discount +
              Number(
                document.discountAmount
              ),

            final:
              sum.final +
              Number(
                document.finalAmount
              ),
          }),
          {
            base: 0,
            discount: 0,
            final: 0,
          }
        );

      baseAmount =
        totals.base.toFixed(2);

      discountAmount =
        totals.discount.toFixed(2);

      finalAmount =
        totals.final.toFixed(2);
    } else {
      // ------------------------------------------------
      // Standard Workflow
      // ------------------------------------------------

      baseAmount =
        workflow.baseAmount.toFixed(
          2
        );

      const parsedDiscount =
        parseMoney(
          body.discountAmount
        );

      if (
        parsedDiscount ===
        null
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Discount must be a valid non-negative amount with up to 2 decimal places.",
          },
          { status: 400 }
        );
      }

      discountAmount =
        parsedDiscount;

      const baseCents =
        Math.round(
          Number(
            baseAmount
          ) * 100
        );

      const discountCents =
        Math.round(
          Number(
            discountAmount
          ) * 100
        );

      if (
        discountCents >
        baseCents
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Discount cannot be greater than the base price.",
          },
          { status: 400 }
        );
      }

      finalAmount =
        (
          (baseCents -
            discountCents) /
          100
        ).toFixed(2);
    }

    // ==================================================
    // Resolve Main Staff
    // ==================================================

    const effectiveAssignedStaffId =
      assignedStaffId ??
      workflow.defaultStaffId ??
      null;

    if (
      effectiveAssignedStaffId !==
      null
    ) {
      if (
        !Number.isInteger(
          effectiveAssignedStaffId
        ) ||
        effectiveAssignedStaffId <=
          0
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

      const staff =
        await prisma.staff.findFirst({
          where: {
            id:
              effectiveAssignedStaffId,
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

    // ==================================================
    // Validate Third Party
    // ==================================================

    if (
      thirdPartyId !== null
    ) {
      if (
        !Number.isInteger(
          thirdPartyId
        ) ||
        thirdPartyId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid third party.",
          },
          { status: 400 }
        );
      }

      const thirdParty =
        await prisma.thirdParty.findFirst(
          {
            where: {
              id: thirdPartyId,
              status: true,
            },
          }
        );

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

    // ==================================================
    // File Number
    // ==================================================

    let fileNumber = "";

    if (
      fileNumberType ===
      "CUSTOM"
    ) {
      if (
        !customFileNumber
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Custom file number is required.",
          },
          { status: 400 }
        );
      }

      fileNumber =
        customFileNumber;
    }

    // ==================================================
    // Transaction
    // ==================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ----------------------------------------------
          // Generate System File Number
          // ----------------------------------------------

          if (
            fileNumberType ===
            "SYSTEM"
          ) {
            const sequence =
              await tx.fileNumberSequence.findUnique(
                {
                  where: {
                    id: 1,
                  },
                }
              );

            const nextNumber =
              sequence?.nextNumber ??
              1;

            fileNumber =
              `AIG-${String(
                nextNumber
              ).padStart(
                6,
                "0"
              )}`;

            await tx.fileNumberSequence.upsert(
              {
                where: {
                  id: 1,
                },

                create: {
                  id: 1,
                  nextNumber:
                    nextNumber +
                    1,
                },

                update: {
                  nextNumber:
                    nextNumber +
                    1,
                },
              }
            );
          }

          // ----------------------------------------------
          // Duplicate File Number
          // ----------------------------------------------

          const existingFile =
            await tx.clientFile.findUnique(
              {
                where: {
                  fileNumber,
                },
              }
            );

          if (existingFile) {
            throw new Error(
              "FILE_NUMBER_ALREADY_EXISTS"
            );
          }

          // ----------------------------------------------
          // Create Client File
          // ----------------------------------------------

          const clientFile =
            await tx.clientFile.create(
              {
                data: {
                  clientId,

                  thirdPartyId,

                  fileNumber,

                  fileNumberType,

                  title:
                    workflow.name,

                  description:
                    description ||
                    null,

                  status:
                    "IN_PROGRESS",
                },
              }
            );

          // ----------------------------------------------
          // Create File Workflow
          // ----------------------------------------------

          const fileWorkflow =
            await tx.fileWorkflow.create(
              {
                data: {
                  clientFileId:
                    clientFile.id,

                  workflowTemplateId:
                    workflow.id,

                  assignedStaffId:
                    effectiveAssignedStaffId,

                  status:
                    "IN_PROGRESS",

                  baseAmount,

                  discountAmount,

                  finalAmount,

                  startedAt:
                    new Date(),
                },
              }
            );

          // =================================================
          // DOCUMENT BASED
          // =================================================

          if (isDocumentBased) {
            for (
              const document of
                preparedDocuments
            ) {
              // ----------------------------------------------
              // Create Document Instance
              // ----------------------------------------------

              const fileDocument =
                await tx.fileWorkflowDocument.create(
                  {
                    data: {
                      fileWorkflowId:
                        fileWorkflow.id,

                      documentTypeId:
                        document.documentTypeId,

                      documentName:
                        document.documentName,

                      baseAmount:
                        document.baseAmount,

                      discountAmount:
                        document.discountAmount,

                      finalAmount:
                        document.finalAmount,

                      status:
                        "IN_PROGRESS",

                      sortOrder:
                        document.sortOrder,

                      startedAt:
                        new Date(),
                    },
                  }
                );

              // ----------------------------------------------
              // Create Independent Workflow Chain
              // ----------------------------------------------

              for (
                let index = 0;
                index <
                workflow.steps.length;
                index++
              ) {
                const step =
                  workflow.steps[
                    index
                  ];

                const task =
                  await tx.workflowTask.create(
                    {
                      data: {
                        fileWorkflowId:
                          fileWorkflow.id,

                        fileWorkflowDocumentId:
                          fileDocument.id,

                        workflowStepId:
                          step.id,

                        // null = inherit from FileWorkflow
                        assignedStaffId:
                          null,

                        status:
                          index ===
                          0
                            ? TaskStatus.ACTIVE
                            : TaskStatus.PENDING,

                        startedAt:
                          index ===
                          0
                            ? new Date()
                            : null,
                      },
                    }
                  );

                // --------------------------------------------
                // Create Subtasks
                // --------------------------------------------

                if (
                  step.subTasks
                    .length >
                  0
                ) {
                  await tx.fileWorkflowSubTask.createMany(
                    {
                      data: step.subTasks.map(
                        (
                          subTask
                        ) => ({
                          workflowTaskId:
                            task.id,

                          workflowSubTaskId:
                            subTask.id,

                          // null = inherit staff
                          assignedStaffId:
                            null,

                          status:
                            index ===
                            0
                              ? TaskStatus.ACTIVE
                              : TaskStatus.PENDING,
                        })
                      ),
                    }
                  );
                }
              }
            }
          } else {
            // =================================================
            // STANDARD WORKFLOW
            // =================================================

            for (
              let index = 0;
              index <
              workflow.steps.length;
              index++
            ) {
              const step =
                workflow.steps[
                  index
                ];

              const task =
                await tx.workflowTask.create(
                  {
                    data: {
                      fileWorkflowId:
                        fileWorkflow.id,

                      fileWorkflowDocumentId:
                        null,

                      workflowStepId:
                        step.id,

                      // null = inherit from FileWorkflow
                      assignedStaffId:
                        null,

                      status:
                        index ===
                        0
                          ? TaskStatus.ACTIVE
                          : TaskStatus.PENDING,

                      startedAt:
                        index ===
                        0
                          ? new Date()
                          : null,
                    },
                  }
                );

              // --------------------------------------------
              // Create Subtasks
              // --------------------------------------------

              if (
                step.subTasks
                  .length >
                0
              ) {
                await tx.fileWorkflowSubTask.createMany(
                  {
                    data: step.subTasks.map(
                      (
                        subTask
                      ) => ({
                        workflowTaskId:
                          task.id,

                        workflowSubTaskId:
                          subTask.id,

                        // null = inherit staff
                        assignedStaffId:
                          null,

                        status:
                          index ===
                          0
                            ? TaskStatus.ACTIVE
                            : TaskStatus.PENDING,
                      })
                    ),
                  }
                );
              }
            }
          }

          return clientFile;
        }
      );

    // ==================================================
    // Audit Log
    // ==================================================

    await writeAuditLog({
      module: "FILES",

      action: "CREATE",

      entity: "CLIENT_FILE",

      entityId: result.id,

      description:
        `Client file ${fileNumber} created for ${client.name}.`,

      metadata: {
        fileNumber,

        clientId,

        workflowTemplateId:
          workflow.id,

        workflowName:
          workflow.name,

        trackingMode:
          workflow.trackingMode,

        assignedStaffId:
          effectiveAssignedStaffId,

        thirdPartyId,

        baseAmount,

        discountAmount,

        finalAmount,

        documents:
          isDocumentBased
            ? preparedDocuments.map(
                (
                  document
                ) => ({
                  documentTypeId:
                    document.documentTypeId,

                  documentName:
                    document.documentName,

                  baseAmount:
                    document.baseAmount,

                  discountAmount:
                    document.discountAmount,

                  finalAmount:
                    document.finalAmount,
                })
              )
            : [],
      },
    });

    // ==================================================
    // Response
    // ==================================================

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
    // ==================================================
    // Known Errors
    // ==================================================

    if (
      error instanceof Error
    ) {
      switch (
        error.message
      ) {
        case "FILE_NUMBER_ALREADY_EXISTS":
          return NextResponse.json(
            {
              success: false,
              message:
                "This file number already exists.",
            },
            { status: 409 }
          );

        case "DOCUMENT_TYPE_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message:
                "One of the selected Document Types was not found.",
            },
            { status: 400 }
          );

        case "INVALID_DOCUMENT_BASE_AMOUNT":
          return NextResponse.json(
            {
              success: false,
              message:
                "One of the document prices is invalid.",
            },
            { status: 400 }
          );

        case "INVALID_DOCUMENT_DISCOUNT":
          return NextResponse.json(
            {
              success: false,
              message:
                "One of the document discounts is invalid.",
            },
            { status: 400 }
          );

        case "DOCUMENT_DISCOUNT_GREATER_THAN_BASE":
          return NextResponse.json(
            {
              success: false,
              message:
                "A document discount cannot be greater than its base price.",
            },
            { status: 400 }
          );
      }
    }

    // ==================================================
    // Unexpected Error
    // ==================================================

    console.error(
      "Create file error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to create file.",
      },
      { status: 500 }
    );
  }
}