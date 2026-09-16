import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const completed =
      body.completed === true;

    const task =
      await prisma.workflowTask.findUnique({
        where: {
          id,
        },
        include: {
          workflowStep: true,
          fileWorkflow: {
            include: {
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

      await prisma.$transaction(
        async (tx) => {
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
              remarks:
                "Workflow step completed.",
              changedAt: now,
            },
          });

          // ------------------------------------------
          // Find next step
          // ------------------------------------------

          const nextTask =
            task.fileWorkflow.tasks
              .filter(
                (item) =>
                  item.status !==
                    "CANCELLED" &&
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
                workflowTaskId:
                  nextTask.id,
                oldStatus:
                  nextTask.status,
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
                id:
                  task.fileWorkflow
                    .clientFileId,
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
                id:
                  task.fileWorkflow
                    .clientFileId,
              },
              data: {
                status: "COMPLETED",
                completedAt: now,
              },
            });
          }
        }
      );

      return NextResponse.json({
        success: true,
        message:
          "Workflow step completed.",
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

    await prisma.$transaction(
      async (tx) => {
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
              task.fileWorkflow.startedAt ||
              now,
          },
        });

        await tx.taskHistory.create({
          data: {
            workflowTaskId: task.id,
            oldStatus: "COMPLETED",
            newStatus: "ACTIVE",
            remarks:
              "Workflow step reopened.",
            changedAt: now,
          },
        });

        // ----------------------------------------------
        // Reset later tasks to PENDING
        // ----------------------------------------------

        const laterTasks =
          task.fileWorkflow.tasks.filter(
            (item) =>
              item.id !== task.id &&
              item.workflowStep.stepNumber >
                task.workflowStep.stepNumber &&
              item.status !== "CANCELLED"
          );

        for (const laterTask of laterTasks) {
          if (
            laterTask.status !==
              "PENDING"
          ) {
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
                workflowTaskId:
                  laterTask.id,
                oldStatus:
                  laterTask.status,
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
            id:
              task.fileWorkflow
                .clientFileId,
          },
          data: {
            status: "IN_PROGRESS",
            completedAt: null,
          },
        });
      }
    );

    return NextResponse.json({
      success: true,
      message:
        "Workflow step reopened.",
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