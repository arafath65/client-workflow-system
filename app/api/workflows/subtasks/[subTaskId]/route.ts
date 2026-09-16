import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    subTaskId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { subTaskId } = await context.params;

    const id = Number(subTaskId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sub task ID.",
        },
        { status: 400 }
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
        { status: 404 }
      );
    }

    const body = await request.json();

    const title = String(
      body.title ?? ""
    ).trim();

    const description =
      body.description === null ||
      body.description === undefined
        ? null
        : String(body.description).trim() || null;

    const defaultStaffId =
      body.defaultStaffId === null ||
      body.defaultStaffId === undefined ||
      body.defaultStaffId === ""
        ? null
        : Number(body.defaultStaffId);

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "Sub task name is required.",
        },
        { status: 400 }
      );
    }

    // Validate default staff when selected
    if (defaultStaffId !== null) {
      if (
        !Number.isInteger(defaultStaffId) ||
        defaultStaffId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid default staff.",
          },
          { status: 400 }
        );
      }

      const staff = await prisma.staff.findUnique({
        where: {
          id: defaultStaffId,
        },
      });

      if (!staff) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Selected staff member was not found.",
          },
          { status: 404 }
        );
      }

      if (!staff.status) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Cannot assign an inactive staff member.",
          },
          { status: 400 }
        );
      }
    }

    const updatedSubTask =
      await prisma.workflowSubTask.update({
        where: {
          id,
        },
        data: {
          title,
          description,
          defaultStaffId,
        },
      });

    return NextResponse.json({
      success: true,
      message:
        "Sub task updated successfully.",
      subTask: updatedSubTask,
    });
  } catch (error) {
    console.error(
      "Update workflow sub task error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update sub task.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { subTaskId } = await context.params;

    const id = Number(subTaskId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sub task ID.",
        },
        { status: 400 }
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
        { status: 404 }
      );
    }

    await prisma.workflowSubTask.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Sub task deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete workflow sub task error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to delete sub task.",
      },
      { status: 500 }
    );
  }
}