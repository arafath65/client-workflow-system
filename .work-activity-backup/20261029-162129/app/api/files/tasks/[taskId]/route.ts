import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

function isDocumentBasedTask(task: {
  fileWorkflow: {
    workflowTemplate: {
      trackingMode: "STANDARD" | "DOCUMENT_BASED";
    };
  };
}) {
  return (
    task.fileWorkflow.workflowTemplate.trackingMode ===
    "DOCUMENT_BASED"
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { taskId } = await params;

    const id = Number(taskId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid task.",
        },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const completed =
      typeof body === "object" &&
      body !== null &&
      "completed" in body &&
      (body as { completed?: unknown }).completed === true;

    const task = await prisma.workflowTask.findUnique({
      where: {
        id,
      },
      include: {
        workflowStep: true,

        fileWorkflowDocument: true,

        fileWorkflow: {
          include: {
            workflowTemplate: {
              select: {
                trackingMode: true,
              },
            },

            documents: {
              select: {
                id: true,
                status: true,
              },
            },

            tasks: {
              include: {
                workflowStep: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          message: "Workflow task not found.",
        },
        { status: 404 }
      );
    }

    const documentBased = isDocumentBasedTask(task);
    const documentId =
      task.fileWorkflowDocumentId ?? null;

    // --------------------------------------------------
    // Helper: only tasks belonging to the same chain
    // --------------------------------------------------

    const isSameTaskChain = (candidate: {
      id: number;
      fileWorkflowDocumentId: number | null;
      status: string;
      workflowStep: {
        stepNumber: number;
      };
    }) => {
      if (candidate.id === task.id) {
        return false;
      }

      if (candidate.status === "CANCELLED") {
        return false;
      }

      if (documentBased) {
        return (
          candidate.fileWorkflowDocumentId ===
          documentId
        );
      }

      return (
        candidate.fileWorkflowDocumentId ===
        null
      );
    };

    const now = new Date();

    // --------------------------------------------------
    // Complete current task
    // --------------------------------------------------

    if (completed) {
      if (task.status !== "ACTIVE") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Only the active workflow step can be completed.",
          },
          { status: 400 }
        );
      }

      let completedDocument = false;
      let completedWorkflow = false;
      let completedClientFile = false;

      await prisma.$transaction(async (tx) => {
        // ----------------------------------------------
        // Complete current task
        // ----------------------------------------------

        await tx.workflowTask.update({
          where: {
            id: task.id,
          },
          data: {
            status: "COMPLETED",
            completedAt: now,
          },
        });

        // ----------------------------------------------
        // Complete all subtasks under this task
        // ----------------------------------------------

        await tx.fileWorkflowSubTask.updateMany({
          where: {
            workflowTaskId: task.id,
          },
          data: {
            status: "COMPLETED",
            completedAt: now,
          },
        });

        await tx.taskHistory.create({
          data: {
            workflowTaskId: task.id,
            oldStatus: task.status,
            newStatus: "COMPLETED",
            remarks:
              documentBased && documentId !== null
                ? "Document workflow step completed."
                : "Workflow step completed.",
            changedAt: now,
          },
        });

        // ----------------------------------------------
        // Find next task ONLY in the same chain
        // ----------------------------------------------

        const nextTask = task.fileWorkflow.tasks
          .filter(isSameTaskChain)
          .filter(
            (item) =>
              item.workflowStep.stepNumber >
              task.workflowStep.stepNumber
          )
          .sort(
            (a, b) =>
              a.workflowStep.stepNumber -
              b.workflowStep.stepNumber
          )[0];

        if (nextTask) {
          await tx.workflowTask.update({
            where: {
              id: nextTask.id,
            },
            data: {
              status: "ACTIVE",
              startedAt: now,
              completedAt: null,
            },
          });

          await tx.taskHistory.create({
            data: {
              workflowTaskId: nextTask.id,
              oldStatus: nextTask.status,
              newStatus: "ACTIVE",
              remarks:
                documentBased && documentId !== null
                  ? "Automatically activated after the previous document step was completed."
                  : "Automatically activated after previous step was completed.",
              changedAt: now,
            },
          });

          await tx.fileWorkflow.update({
            where: {
              id: task.fileWorkflow.id,
            },
            data: {
              status: "IN_PROGRESS",
              completedAt: null,
            },
          });

          await tx.clientFile.update({
            where: {
              id: task.fileWorkflow.clientFileId,
            },
            data: {
              status: "IN_PROGRESS",
              completedAt: null,
            },
          });

          if (documentBased && documentId !== null) {
            await tx.fileWorkflowDocument.update({
              where: {
                id: documentId,
              },
              data: {
                status: "IN_PROGRESS",
                completedAt: null,
              },
            });
          }

          return;
        }

        // ----------------------------------------------
        // Current chain has no next task
        // ----------------------------------------------

        if (documentBased && documentId !== null) {
          // --------------------------------------------
          // Complete this document
          // --------------------------------------------

          await tx.fileWorkflowDocument.update({
            where: {
              id: documentId,
            },
            data: {
              status: "COMPLETED",
              completedAt: now,
            },
          });

          completedDocument = true;

          // --------------------------------------------
          // Check whether every document is complete
          // --------------------------------------------

          const refreshedDocuments =
            await tx.fileWorkflowDocument.findMany({
              where: {
                fileWorkflowId:
                  task.fileWorkflow.id,
              },
              select: {
                id: true,
                status: true,
              },
            });

          const allDocumentsCompleted =
            refreshedDocuments.length > 0 &&
            refreshedDocuments.every(
              (document) =>
                document.status === "COMPLETED"
            );

          if (allDocumentsCompleted) {
            await tx.fileWorkflow.update({
              where: {
                id: task.fileWorkflow.id,
              },
              data: {
                status: "COMPLETED",
                completedAt: now,
              },
            });

            completedWorkflow = true;

            await tx.clientFile.update({
              where: {
                id: task.fileWorkflow.clientFileId,
              },
              data: {
                status: "COMPLETED",
                completedAt: now,
              },
            });

            completedClientFile = true;
          } else {
            await tx.fileWorkflow.update({
              where: {
                id: task.fileWorkflow.id,
              },
              data: {
                status: "IN_PROGRESS",
                completedAt: null,
              },
            });

            await tx.clientFile.update({
              where: {
                id: task.fileWorkflow.clientFileId,
              },
              data: {
                status: "IN_PROGRESS",
                completedAt: null,
              },
            });
          }

          return;
        }

        // ----------------------------------------------
        // Standard workflow: no next task means the
        // whole workflow/file is complete.
        // ----------------------------------------------

        await tx.fileWorkflow.update({
          where: {
            id: task.fileWorkflow.id,
          },
          data: {
            status: "COMPLETED",
            completedAt: now,
          },
        });

        completedWorkflow = true;

        await tx.clientFile.update({
          where: {
            id: task.fileWorkflow.clientFileId,
          },
          data: {
            status: "COMPLETED",
            completedAt: now,
          },
        });

        completedClientFile = true;
      });

      await writeAuditLog({
        module: "FILES",
        action: "COMPLETE_TASK",
        entity: "WORKFLOW_TASK",
        entityId: task.id,
        description:
          documentBased && documentId !== null
            ? `Document workflow step ${task.workflowStep.stepNumber} completed for document #${documentId}.`
            : `Workflow step ${task.workflowStep.stepNumber} completed.`,
        metadata: {
          taskId: task.id,
          fileWorkflowId: task.fileWorkflow.id,
          fileWorkflowDocumentId: documentId,
          trackingMode:
            task.fileWorkflow.workflowTemplate
              .trackingMode,
          completedDocument,
          completedWorkflow,
          completedClientFile,
        },
      });

      return NextResponse.json({
        success: true,
        message:
          "Workflow step completed.",
        completedDocument,
        completedWorkflow,
        completedClientFile,
      });
    }

    // --------------------------------------------------
    // Untick / Reopen current task
    // --------------------------------------------------

    if (task.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This workflow step is not completed.",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // ----------------------------------------------
      // Current task becomes ACTIVE
      // ----------------------------------------------

      await tx.workflowTask.update({
        where: {
          id: task.id,
        },
        data: {
          status: "ACTIVE",
          completedAt: null,
          startedAt:
            task.fileWorkflow.startedAt ||
            now,
        },
      });

      // ----------------------------------------------
      // Reset this task's subtasks
      // ----------------------------------------------

      await tx.fileWorkflowSubTask.updateMany({
        where: {
          workflowTaskId: task.id,
        },
        data: {
          status: "PENDING",
          completedAt: null,
        },
      });

      await tx.taskHistory.create({
        data: {
          workflowTaskId: task.id,
          oldStatus: "COMPLETED",
          newStatus: "ACTIVE",
          remarks:
            documentBased && documentId !== null
              ? "Document workflow step reopened."
              : "Workflow step reopened.",
          changedAt: now,
        },
      });

      // ----------------------------------------------
      // Reset later tasks ONLY in the same chain
      // ----------------------------------------------

      const laterTasks = task.fileWorkflow.tasks
        .filter(isSameTaskChain)
        .filter(
          (item) =>
            item.workflowStep.stepNumber >
            task.workflowStep.stepNumber
        );

      for (const laterTask of laterTasks) {
        if (laterTask.status !== "PENDING") {
          await tx.workflowTask.update({
            where: {
              id: laterTask.id,
            },
            data: {
              status: "PENDING",
              startedAt: null,
              completedAt: null,
            },
          });

          await tx.fileWorkflowSubTask.updateMany({
            where: {
              workflowTaskId:
                laterTask.id,
            },
            data: {
              status: "PENDING",
              completedAt: null,
            },
          });

          await tx.taskHistory.create({
            data: {
              workflowTaskId:
                laterTask.id,
              oldStatus:
                laterTask.status,
              newStatus: "PENDING",
              remarks:
                documentBased && documentId !== null
                  ? "Reset because a later document step was reopened."
                  : "Reset because a later workflow step was reopened.",
              changedAt: now,
            },
          });
        }
      }

      // ----------------------------------------------
      // Reopen document/workflow/file states
      // ----------------------------------------------

      if (documentBased && documentId !== null) {
        await tx.fileWorkflowDocument.update({
          where: {
            id: documentId,
          },
          data: {
            status: "IN_PROGRESS",
            completedAt: null,
          },
        });
      }

      await tx.fileWorkflow.update({
        where: {
          id: task.fileWorkflow.id,
        },
        data: {
          status: "IN_PROGRESS",
          completedAt: null,
        },
      });

      await tx.clientFile.update({
        where: {
          id: task.fileWorkflow.clientFileId,
        },
        data: {
          status: "IN_PROGRESS",
          completedAt: null,
        },
      });
    });

    await writeAuditLog({
      module: "FILES",
      action: "REOPEN_TASK",
      entity: "WORKFLOW_TASK",
      entityId: task.id,
      description:
        documentBased && documentId !== null
          ? `Document workflow step ${task.workflowStep.stepNumber} reopened for document #${documentId}.`
          : `Workflow step ${task.workflowStep.stepNumber} reopened.`,
      metadata: {
        taskId: task.id,
        fileWorkflowId: task.fileWorkflow.id,
        fileWorkflowDocumentId: documentId,
        trackingMode:
          task.fileWorkflow.workflowTemplate
            .trackingMode,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Workflow step reopened.",
    });
  } catch (error) {
    console.error(
      "Update workflow task error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to update workflow task.",
      },
      { status: 500 }
    );
  }
}
