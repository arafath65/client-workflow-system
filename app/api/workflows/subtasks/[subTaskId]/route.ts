import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      subTaskId: string;
    }>;
  }
) {
  try {
    const { subTaskId } = await params;

    const id = Number(subTaskId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sub task ID.",
        },
        {
          status: 400,
        }
      );
    }

    const subTask =
      await prisma.workflowSubTask.findUnique({
        where: {
          id,
        },
      });

    if (!subTask) {
      return NextResponse.json(
        {
          success: false,
          message: "Sub task not found.",
        },
        {
          status: 404,
        }
      );
    }

    await prisma.workflowSubTask.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Sub task deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete workflow sub task error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete sub task.",
      },
      {
        status: 500,
      }
    );
  }
}