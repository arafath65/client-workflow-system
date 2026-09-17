
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    subTaskId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { subTaskId } = await params;
    const id = Number(subTaskId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid subtask." },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (typeof body.completed !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          message: "A valid completed value is required.",
        },
        { status: 400 }
      );
    }

    const subTask = await prisma.fileWorkflowSubTask.findUnique({
      where: { id },
      include: {
        workflowTask: {
          include: {
            workflowStep: true,
            fileWorkflow: {
              include: {
                tasks: {
                  include: {
                    workflowStep: true,
                    subTasks: true,
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
        { success: false, message: "Subtask not found." },
        { status: 404 }
      );
    }

    const parentTask = subTask.workflowTask;
    const now = new Date();
    const completed = body.completed;

    // Only the active step's subtasks may be changed.
    if (
      parentTask.status !== "ACTIVE" &&
      parentTask.status !== "COMPLETED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Only the active or completed step can be updated.",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.fileWorkflowSubTask.update({
        where: { id },
        data: {
          status: completed ? "COMPLETED" : "PENDING",
          completedAt: completed ? now : null,
        },
      });

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

      // A subtask was unticked: reopen the parent and
      // reset all later workflow steps.
      if (!completed) {
        if (parentTask.status === "COMPLETED") {
          await tx.workflowTask.update({
            where: { id: parentTask.id },
            data: {
              status: "ACTIVE",
              completedAt: null,
              startedAt: parentTask.startedAt ?? now,
            },
          });

          await tx.taskHistory.create({
            data: {
              workflowTaskId: parentTask.id,
              oldStatus: "COMPLETED",
              newStatus: "ACTIVE",
              remarks: "Reopened because a subtask was reopened.",
              changedAt: now,
            },
          });
        }

        const laterTasks =
          parentTask.fileWorkflow.tasks.filter(
            (item) =>
              item.id !== parentTask.id &&
              item.workflowStep.stepNumber >
                parentTask.workflowStep.stepNumber &&
              item.status !== "CANCELLED"
          );

        for (const laterTask of laterTasks) {
          if (laterTask.status !== "PENDING") {
            await tx.workflowTask.update({
              where: { id: laterTask.id },
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
                  "Reset because a previous step's subtask was reopened.",
                changedAt: now,
              },
            });
          }
        }

        await tx.fileWorkflow.update({
          where: { id: parentTask.fileWorkflow.id },
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

      // All subtasks are complete: complete the parent task
      // and activate the next step.
      if (
        allSubTasksCompleted &&
        parentTask.status === "ACTIVE"
      ) {
        await tx.workflowTask.update({
          where: { id: parentTask.id },
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
            remarks: "Automatically completed after all subtasks were completed.",
            changedAt: now,
          },
        });

        const nextTask =
          parentTask.fileWorkflow.tasks
            .filter(
              (item) =>
                item.id !== parentTask.id &&
                item.status !== "CANCELLED" &&
                item.workflowStep.stepNumber >
                  parentTask.workflowStep.stepNumber
            )
            .sort(
              (a, b) =>
                a.workflowStep.stepNumber -
                b.workflowStep.stepNumber
            )[0];

        if (nextTask) {
          await tx.workflowTask.update({
            where: { id: nextTask.id },
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
                "Automatically activated after previous step was completed.",
              changedAt: now,
            },
          });

          await tx.fileWorkflow.update({
            where: { id: parentTask.fileWorkflow.id },
            data: { status: "IN_PROGRESS" },
          });

          await tx.clientFile.update({
            where: {
              id: parentTask.fileWorkflow.clientFileId,
            },
            data: { status: "IN_PROGRESS" },
          });
        } else {
          await tx.fileWorkflow.update({
            where: { id: parentTask.fileWorkflow.id },
            data: {
              status: "COMPLETED",
              completedAt: now,
            },
          });

          await tx.clientFile.update({
            where: {
              id: parentTask.fileWorkflow.clientFileId,
            },
            data: {
              status: "COMPLETED",
              completedAt: now,
            },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: completed
        ? "Subtask updated."
        : "Subtask reopened.",
    });
  } catch (error) {
    console.error("Update subtask status error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update subtask status.",
      },
      { status: 500 }
    );
  }
}