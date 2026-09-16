import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id: idParam } = await params;

    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid third party ID.",
        },
        {
          status: 400,
        }
      );
    }

    const existing =
      await prisma.thirdParty.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Third party not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body = await request.json();

    /*
     * Activate / Deactivate
     */
    if (typeof body.status === "boolean") {
      const thirdParty =
        await prisma.thirdParty.update({
          where: {
            id,
          },
          data: {
            status: body.status,
          },
        });

      return NextResponse.json({
        success: true,
        message: body.status
          ? "Third party activated successfully."
          : "Third party deactivated successfully.",
        thirdParty,
      });
    }

    /*
     * Edit
     */
    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const whatsapp =
      typeof body.whatsapp === "string"
        ? body.whatsapp.trim()
        : "";

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Third party name is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Prevent duplicate third party names.
     * Exclude the current record.
     */
    const duplicate =
      await prisma.thirdParty.findFirst({
        where: {
          name: {
            equals: name,
          },
          NOT: {
            id,
          },
        },
      });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A third party with this name already exists.",
        },
        {
          status: 409,
        }
      );
    }

    const thirdParty =
      await prisma.thirdParty.update({
        where: {
          id,
        },
        data: {
          name,
          whatsapp: whatsapp || null,
        },
      });

    return NextResponse.json({
      success: true,
      message:
        "Third party updated successfully.",
      thirdParty,
    });
  } catch (error) {
    console.error(
      "Update third party error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update third party.",
      },
      {
        status: 500,
      }
    );
  }
}