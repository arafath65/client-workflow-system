import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { makeWorkflowActivityData, resolveWorkflowActivityActor } from "@/lib/workflow-activity";

type RouteContext = {
  params: Promise<{
    subTaskId: string;
  }>;
};

function isDocumentBasedTask(task: {
  workflowTask: {
    fileWorkflow: {
      workflowTemplate: {
        trackingMode: "STANDARD" | "DOCUMENT_BASED";
      };
    };
  };
}) {
  return (
    task.workflowTask.fileWorkflow.workflowTemplate.trackingMode ===
    "DOCUMENT_BASED"
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { subTaskId } = await params;
    const id = Number(subTaskId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid subtask.",
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
      (body as { completed?: unknown }).completed;

    if (typeof completed !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          message: "A valid completed value is required.",
        },
        { status: 400 }
      );
    }

    const subTask = await prisma.fileWorkflowSubTask.findUnique({
      where: {
        id,
      },
      include: {
        workflowSubTask: true,
        assignedStaff: { select: { id: true, name: true } },
        workflowTask: {
          include: {
            workflowStep: true,
            assignedStaff: { select: { id: true, name: true } },

            fileWorkflow: {
              include: {
                clientFile: {
                  select: {
                    id: true,
                    fileNumber: true,
                    client: { select: { name: true } },
                  },
                },
                assignedStaff: { select: { id: true, name: true } },
                workflowTemplate: {
                  select: {
                    trackingMode: true,
                    name: true,
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
                    assignedStaff: { select: { id: true, name: true } },
                  },
                },
              },
            },

            subTasks: true,
          },
        },
      },
    });

    if (!subTask) {
      return NextResponse.json(
        {
          success: false,
          message: "Subtask not found.",
        },
        { status: 404 }
      );
    }

    const parentTask = subTask.workflowTask;
    const documentBased = isDocumentBasedTask(subTask);
    const documentId = parentTask.fileWorkflowDocumentId ?? null;
    const now = new Date();
    const actor = await resolveWorkflowActivityActor(request);

    // --------------------------------------------------
    // Only the active/completed step's subtasks may be changed
    // --------------------------------------------------

    if (
      parentTask.status !== "ACTIVE" &&
      parentTask.status !== "COMPLETED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only the active or completed step can be updated.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Same-chain helper
    // --------------------------------------------------

    const isSameTaskChain = (candidate: {
      id: number;
      fileWorkflowDocumentId: number | null;
      status: string;
      workflowStep: {
        stepNumber: number;
      };
    }) => {
      if (candidate.id === parentTask.id) {
        return false;
      }

      if (candidate.status === "CANCELLED") {
        return false;
      }

      if (documentBased) {
        return candidate.fileWorkflowDocumentId === documentId;
      }

      return candidate.fileWorkflowDocumentId === null;
    };

    let completedDocument = false;
    let completedWorkflow = false;
    let completedClientFile = false;

    await prisma.$transaction(async (tx) => {
      // ------------------------------------------------
      // Update current subtask
      // ------------------------------------------------

      await tx.fileWorkflowSubTask.update({
        where: {
          id,
        },
        data: {
          status: completed ? "COMPLETED" : "PENDING",
          completedAt: completed ? now : null,
        },
      });

      if (subTask.status !== (completed ? "COMPLETED" : "PENDING")) {
        await tx.workflowActivityLog.create({
          data: makeWorkflowActivityData({
            clientFileId: parentTask.fileWorkflow.clientFileId,
            fileWorkflowId: parentTask.fileWorkflow.id,
            workflowTaskId: parentTask.id,
            fileWorkflowSubTaskId: subTask.id,
            fileWorkflowDocumentId: documentId,
            staffId: subTask.assignedStaffId ?? parentTask.assignedStaffId ?? parentTask.fileWorkflow.assignedStaffId,
            staffName: subTask.assignedStaff?.name ?? parentTask.assignedStaff?.name ?? parentTask.fileWorkflow.assignedStaff?.name,
            actorUserId: actor.actorUserId,
            actorUsername: actor.actorUsername,
            activityType: "SUBTASK",
            action: completed ? "COMPLETED" : "REOPENED",
            fileNumber: parentTask.fileWorkflow.clientFile.fileNumber,
            clientName: parentTask.fileWorkflow.clientFile.client.name,
            workflowName: parentTask.fileWorkflow.workflowTemplate.name,
            stepNumber: parentTask.workflowStep.stepNumber,
            stepTitle: parentTask.workflowStep.title,
            subTaskNumber: subTask.workflowSubTask.subTaskNumber,
            subTaskTitle: subTask.workflowSubTask.title,
            remarks: completed ? (subTask.remarks ?? "Subtask completed.") : "Subtask reopened.",
            createdAt: now,
          }),
        });
      }

      // ------------------------------------------------
      // Refresh subtasks under current parent task
      // ------------------------------------------------

      const refreshedSubTasks =
        await tx.fileWorkflowSubTask.findMany({
          where: {
            workflowTaskId: parentTask.id,
          },
        });

      const allSubTasksCompleted =
        refreshedSubTasks.length > 0 &&
        refreshedSubTasks.every(
          (item) => item.status === "COMPLETED"
        );

      // ==================================================
      // REOPEN SUBTASK
      // ==================================================

      if (!completed) {
        // ----------------------------------------------
        // Reopen parent step
        // ----------------------------------------------

        if (parentTask.status === "COMPLETED") {
          await tx.workflowTask.update({
            where: {
              id: parentTask.id,
            },
            data: {
              status: "ACTIVE",
              completedAt: null,
              startedAt:
                parentTask.startedAt ?? now,
            },
          });

          await tx.taskHistory.create({
            data: {
              workflowTaskId: parentTask.id,
              oldStatus: "COMPLETED",
              newStatus: "ACTIVE",
              remarks:
                documentBased && documentId !== null
                  ? "Document workflow step reopened because a subtask was reopened."
                  : "Workflow step reopened because a subtask was reopened.",
              changedAt: now,
            },
          });

          await tx.workflowActivityLog.create({
            data: makeWorkflowActivityData({
              clientFileId: parentTask.fileWorkflow.clientFileId,
              fileWorkflowId: parentTask.fileWorkflow.id,
              workflowTaskId: parentTask.id,
              fileWorkflowDocumentId: documentId,
              staffId: parentTask.assignedStaffId ?? parentTask.fileWorkflow.assignedStaffId,
              staffName: parentTask.assignedStaff?.name ?? parentTask.fileWorkflow.assignedStaff?.name,
              actorUserId: actor.actorUserId,
              actorUsername: actor.actorUsername,
              activityType: "WORKFLOW_STEP",
              action: "REOPENED",
              fileNumber: parentTask.fileWorkflow.clientFile.fileNumber,
              clientName: parentTask.fileWorkflow.clientFile.client.name,
              workflowName: parentTask.fileWorkflow.workflowTemplate.name,
              stepNumber: parentTask.workflowStep.stepNumber,
              stepTitle: parentTask.workflowStep.title,
              remarks: "Workflow step reopened because a subtask was reopened.",
              createdAt: now,
            }),
          });
        }

        // ----------------------------------------------
        // Reset later tasks ONLY in same document chain
        // ----------------------------------------------

        const laterTasks = parentTask.fileWorkflow.tasks
          .filter(isSameTaskChain)
          .filter(
            (item) =>
              item.workflowStep.stepNumber >
              parentTask.workflowStep.stepNumber
          );

        for (const laterTask of laterTasks) {
          if (laterTask.status !== "PENDING") {
            const laterSubtasksBeforeReset = await tx.fileWorkflowSubTask.findMany({
              where: { workflowTaskId: laterTask.id },
              include: {
                workflowSubTask: true,
                assignedStaff: { select: { id: true, name: true } },
              },
            });

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
              where: { workflowTaskId: laterTask.id },
              data: { status: "PENDING", completedAt: null },
            });

            for (const laterSubtask of laterSubtasksBeforeReset) {
              if (laterSubtask.status === "PENDING") continue;
              await tx.workflowActivityLog.create({
                data: makeWorkflowActivityData({
                  clientFileId: parentTask.fileWorkflow.clientFileId,
                  fileWorkflowId: parentTask.fileWorkflow.id,
                  workflowTaskId: laterTask.id,
                  fileWorkflowSubTaskId: laterSubtask.id,
                  fileWorkflowDocumentId: documentId,
                  staffId: laterSubtask.assignedStaffId ?? laterTask.assignedStaffId ?? parentTask.fileWorkflow.assignedStaffId,
                  staffName: laterSubtask.assignedStaff?.name ?? laterTask.assignedStaff?.name ?? parentTask.fileWorkflow.assignedStaff?.name,
                  actorUserId: actor.actorUserId,
                  actorUsername: actor.actorUsername,
                  activityType: "SUBTASK",
                  action: "RESET",
                  fileNumber: parentTask.fileWorkflow.clientFile.fileNumber,
                  clientName: parentTask.fileWorkflow.clientFile.client.name,
                  workflowName: parentTask.fileWorkflow.workflowTemplate.name,
                  stepNumber: laterTask.workflowStep.stepNumber,
                  stepTitle: laterTask.workflowStep.title,
                  subTaskNumber: laterSubtask.workflowSubTask.subTaskNumber,
                  subTaskTitle: laterSubtask.workflowSubTask.title,
                  remarks: "Subtask reset to pending after an earlier subtask was reopened.",
                  createdAt: now,
                }),
              });
            }

            await tx.taskHistory.create({
              data: {
                workflowTaskId: laterTask.id,
                oldStatus: laterTask.status,
                newStatus: "PENDING",
                remarks:
                  documentBased && documentId !== null
                    ? "Reset because a later step in the same document was reopened."
                    : "Reset because a later workflow step was reopened.",
                changedAt: now,
              },
            });

            await tx.workflowActivityLog.create({
              data: makeWorkflowActivityData({
                clientFileId: parentTask.fileWorkflow.clientFileId,
                fileWorkflowId: parentTask.fileWorkflow.id,
                workflowTaskId: laterTask.id,
                fileWorkflowDocumentId: documentId,
                staffId: laterTask.assignedStaffId ?? parentTask.fileWorkflow.assignedStaffId,
                staffName: laterTask.assignedStaff?.name ?? parentTask.fileWorkflow.assignedStaff?.name,
                actorUserId: actor.actorUserId,
                actorUsername: actor.actorUsername,
                activityType: "WORKFLOW_STEP",
                action: "RESET",
                fileNumber: parentTask.fileWorkflow.clientFile.fileNumber,
                clientName: parentTask.fileWorkflow.clientFile.client.name,
                workflowName: parentTask.fileWorkflow.workflowTemplate.name,
                stepNumber: laterTask.workflowStep.stepNumber,
                stepTitle: laterTask.workflowStep.title,
                remarks: "Workflow step reset to pending after an earlier subtask was reopened.",
                createdAt: now,
              }),
            });
          }
        }

        // ----------------------------------------------
        // Reopen document if applicable
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

        // ----------------------------------------------
        // Reopen workflow + client file
        // ----------------------------------------------

        await tx.fileWorkflow.update({
          where: {
            id: parentTask.fileWorkflow.id,
          },
          data: {
            status: "IN_PROGRESS",
            completedAt: null,
          },
        });

        await tx.clientFile.update({
          where: {
            id: parentTask.fileWorkflow.clientFileId,
          },
          data: {
            status: "IN_PROGRESS",
            completedAt: null,
          },
        });

        return;
      }

      // ==================================================
      // COMPLETE SUBTASK -> MAY COMPLETE PARENT STEP
      // ==================================================

      if (
        allSubTasksCompleted &&
        parentTask.status === "ACTIVE"
      ) {
        // ----------------------------------------------
        // Complete parent step
        // ----------------------------------------------

        await tx.workflowTask.update({
          where: {
            id: parentTask.id,
          },
          data: {
            status: "COMPLETED",
            completedAt: now,
          },
        });

        await tx.taskHistory.create({
          data: {
            workflowTaskId: parentTask.id,
            oldStatus: "ACTIVE",
            newStatus: "COMPLETED",
            remarks:
              documentBased && documentId !== null
                ? "Document workflow step automatically completed after all subtasks were completed."
                : "Workflow step automatically completed after all subtasks were completed.",
            changedAt: now,
          },
        });

        await tx.workflowActivityLog.create({
          data: makeWorkflowActivityData({
            clientFileId: parentTask.fileWorkflow.clientFileId,
            fileWorkflowId: parentTask.fileWorkflow.id,
            workflowTaskId: parentTask.id,
            fileWorkflowDocumentId: documentId,
            staffId: parentTask.assignedStaffId ?? parentTask.fileWorkflow.assignedStaffId,
            staffName: parentTask.assignedStaff?.name ?? parentTask.fileWorkflow.assignedStaff?.name,
            actorUserId: actor.actorUserId,
            actorUsername: actor.actorUsername,
            activityType: "WORKFLOW_STEP",
            action: "COMPLETED",
            fileNumber: parentTask.fileWorkflow.clientFile.fileNumber,
            clientName: parentTask.fileWorkflow.clientFile.client.name,
            workflowName: parentTask.fileWorkflow.workflowTemplate.name,
            stepNumber: parentTask.workflowStep.stepNumber,
            stepTitle: parentTask.workflowStep.title,
            remarks: "Workflow step automatically completed after all subtasks were completed.",
            createdAt: now,
          }),
        });

        // ----------------------------------------------
        // Find next task ONLY in same chain
        // ----------------------------------------------

        const nextTask = parentTask.fileWorkflow.tasks
          .filter(isSameTaskChain)
          .filter(
            (item) =>
              item.workflowStep.stepNumber >
              parentTask.workflowStep.stepNumber
          )
          .sort(
            (a, b) =>
              a.workflowStep.stepNumber -
              b.workflowStep.stepNumber
          )[0];

        // ----------------------------------------------
        // Next step exists
        // ----------------------------------------------

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
                  ? "Automatically activated after the previous step in the same document was completed."
                  : "Automatically activated after previous workflow step was completed.",
              changedAt: now,
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

          await tx.fileWorkflow.update({
            where: {
              id: parentTask.fileWorkflow.id,
            },
            data: {
              status: "IN_PROGRESS",
              completedAt: null,
            },
          });

          await tx.clientFile.update({
            where: {
              id: parentTask.fileWorkflow.clientFileId,
            },
            data: {
              status: "IN_PROGRESS",
              completedAt: null,
            },
          });

          return;
        }

        // ==================================================
        // NO NEXT TASK
        // ==================================================

        // ------------------------------------------------
        // Document-Based: complete current document first
        // ------------------------------------------------

        if (documentBased && documentId !== null) {
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

          // ----------------------------------------------
          // Check all documents
          // ----------------------------------------------

          const refreshedDocuments =
            await tx.fileWorkflowDocument.findMany({
              where: {
                fileWorkflowId:
                  parentTask.fileWorkflow.id,
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
                id: parentTask.fileWorkflow.id,
              },
              data: {
                status: "COMPLETED",
                completedAt: now,
              },
            });

            completedWorkflow = true;

            await tx.clientFile.update({
              where: {
                id: parentTask.fileWorkflow.clientFileId,
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
                id: parentTask.fileWorkflow.id,
              },
              data: {
                status: "IN_PROGRESS",
                completedAt: null,
              },
            });

            await tx.clientFile.update({
              where: {
                id: parentTask.fileWorkflow.clientFileId,
              },
              data: {
                status: "IN_PROGRESS",
                completedAt: null,
              },
            });
          }

          return;
        }

        // ------------------------------------------------
        // Standard workflow: no next task = complete all
        // ------------------------------------------------

        await tx.fileWorkflow.update({
          where: {
            id: parentTask.fileWorkflow.id,
          },
          data: {
            status: "COMPLETED",
            completedAt: now,
          },
        });

        completedWorkflow = true;

        await tx.clientFile.update({
          where: {
            id: parentTask.fileWorkflow.clientFileId,
          },
          data: {
            status: "COMPLETED",
            completedAt: now,
          },
        });

        completedClientFile = true;
      }
    });

    // ==================================================
    // Audit Log
    // ==================================================

    await writeAuditLog({
      module: "FILES",
      action: completed
        ? "COMPLETE_SUBTASK"
        : "REOPEN_SUBTASK",
      entity: "FILE_WORKFLOW_SUBTASK",
      entityId: id,
      description:
        documentBased && documentId !== null
          ? completed
            ? `Subtask #${id} completed for document #${documentId}.`
            : `Subtask #${id} reopened for document #${documentId}.`
          : completed
            ? `Subtask #${id} completed.`
            : `Subtask #${id} reopened.`,
      metadata: {
        subTaskId: id,
        workflowTaskId: parentTask.id,
        fileWorkflowId: parentTask.fileWorkflow.id,
        fileWorkflowDocumentId: documentId,
        trackingMode:
          parentTask.fileWorkflow.workflowTemplate
            .trackingMode,
        completedDocument,
        completedWorkflow,
        completedClientFile,
      },
    });

    return NextResponse.json({
      success: true,
      message: completed
        ? "Subtask updated."
        : "Subtask reopened.",
      completedDocument,
      completedWorkflow,
      completedClientFile,
    });
  } catch (error) {
    console.error(
      "Update subtask status error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to update subtask status.",
      },
      { status: 500 }
    );
  }
}
