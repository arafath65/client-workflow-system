import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

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

    const body = await request.json();

    const completed = body.completed === true;

    const task = await prisma.workflowTask.findUnique({
      where: {
        id,
      },
      include: {
        workflowStep: true,
        fileWorkflow: {
          include: {
            clientFile: {
              select: {
                id: true,
                fileNumber: true,
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

    const now = new Date();

    // --------------------------------------------------
    // Complete current task
    // --------------------------------------------------

    if (completed) {
      // Only ACTIVE task can normally be completed.
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

      const nextTask = task.fileWorkflow.tasks
        .filter(
          (item) =>
            item.status !== "CANCELLED" &&
            item.id !== task.id
        )
        .sort(
          (a, b) =>
            a.workflowStep.stepNumber -
            b.workflowStep.stepNumber
        )
        .find(
          (item) =>
            item.workflowStep.stepNumber >
            task.workflowStep.stepNumber
        );

      await prisma.$transaction(async (tx) => {
        await tx.workflowTask.update({
          where: {
            id: task.id,
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
            remarks: "Workflow step completed.",
            changedAt: now,
          },
        });

        // ------------------------------------------
        // Activate next step
        // ------------------------------------------

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

          // Complete all subtasks when main step is completed.
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
              workflowTaskId: nextTask.id,
              oldStatus: nextTask.status,
              newStatus: "ACTIVE",
              remarks:
                "Automatically activated after previous step was completed.",
              changedAt: now,
            },
          });

          await tx.fileWorkflow.update({
            where: {
              id: task.fileWorkflow.id,
            },
            data: {
              status: "IN_PROGRESS",
            },
          });

          await tx.clientFile.update({
            where: {
              id: task.fileWorkflow.clientFileId,
            },
            data: {
              status: "IN_PROGRESS",
            },
          });
        } else {
          // ----------------------------------------
          // Last step completed
          // ----------------------------------------

          await tx.fileWorkflow.update({
            where: {
              id: task.fileWorkflow.id,
            },
            data: {
              status: "COMPLETED",
              completedAt: now,
            },
          });

          await tx.clientFile.update({
            where: {
              id: task.fileWorkflow.clientFileId,
            },
            data: {
              status: "COMPLETED",
              completedAt: now,
            },
          });
        }
      });

      // --------------------------------------------------
      // Audit Log: Complete workflow task
      // --------------------------------------------------

      await writeAuditLog({
        module: "WORKFLOW",
        action: "COMPLETE_TASK",
        entity: "WORKFLOW_TASK",
        entityId: task.id,
        description: nextTask
          ? `Completed workflow step "${task.workflowStep.title}" and activated the next step.`
          : `Completed final workflow step "${task.workflowStep.title}". The workflow is now completed.`,
        metadata: {
          taskId: task.id,
          taskTitle: task.workflowStep.title,
          stepNumber: task.workflowStep.stepNumber,
          fileWorkflowId: task.fileWorkflow.id,
          clientFileId: task.fileWorkflow.clientFileId,
          fileNumber: task.fileWorkflow.clientFile.fileNumber,
          previousStatus: task.status,
          newStatus: "COMPLETED",
          nextTaskId: nextTask?.id ?? null,
          nextTaskTitle:
            nextTask?.workflowStep.title ?? null,
          nextTaskStatus: nextTask ? "ACTIVE" : null,
          workflowStatus: nextTask
            ? "IN_PROGRESS"
            : "COMPLETED",
          completedAt: now.toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Workflow step completed.",
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

    const laterTasks = task.fileWorkflow.tasks.filter(
      (item) =>
        item.id !== task.id &&
        item.workflowStep.stepNumber >
          task.workflowStep.stepNumber &&
        item.status !== "CANCELLED"
    );

    await prisma.$transaction(async (tx) => {
      // ----------------------------------------------
      // Current completed task becomes ACTIVE
      // ----------------------------------------------

      await tx.workflowTask.update({
        where: {
          id: task.id,
        },
        data: {
          status: "ACTIVE",
          completedAt: null,
          startedAt:
            task.fileWorkflow.startedAt || now,
        },
      });

      // Reset all subtasks when main step is reopened.
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
          remarks: "Workflow step reopened.",
          changedAt: now,
        },
      });

      // ----------------------------------------------
      // Reset later tasks to PENDING
      // ----------------------------------------------

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

          await tx.taskHistory.create({
            data: {
              workflowTaskId: laterTask.id,
              oldStatus: laterTask.status,
              newStatus: "PENDING",
              remarks:
                "Reset because a previous workflow step was reopened.",
              changedAt: now,
            },
          });
        }
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

    // --------------------------------------------------
    // Audit Log: Reopen workflow task
    // --------------------------------------------------

    await writeAuditLog({
      module: "WORKFLOW",
      action: "REOPEN_TASK",
      entity: "WORKFLOW_TASK",
      entityId: task.id,
      description: `Reopened workflow step "${task.workflowStep.title}" and reset later workflow steps to pending.`,
      metadata: {
        taskId: task.id,
        taskTitle: task.workflowStep.title,
        stepNumber: task.workflowStep.stepNumber,
        fileWorkflowId: task.fileWorkflow.id,
        clientFileId: task.fileWorkflow.clientFileId,
        fileNumber: task.fileWorkflow.clientFile.fileNumber,
        previousStatus: "COMPLETED",
        newStatus: "ACTIVE",
        resetTasks: laterTasks.map((laterTask) => ({
          taskId: laterTask.id,
          taskTitle: laterTask.workflowStep.title,
          stepNumber: laterTask.workflowStep.stepNumber,
          previousStatus: laterTask.status,
          newStatus: "PENDING",
        })),
        resetTaskCount: laterTasks.filter(
          (laterTask) =>
            laterTask.status !== "PENDING"
        ).length,
        workflowStatus: "IN_PROGRESS",
        reopenedAt: now.toISOString(),
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
          "Unable to update workflow task.",
      },
      { status: 500 }
    );
  }
}