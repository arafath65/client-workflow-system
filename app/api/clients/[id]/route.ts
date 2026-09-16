import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const clientId = Number(id);

    if (!Number.isInteger(clientId) || clientId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid client ID.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // --------------------------------------------------
    // Activate / Deactivate
    // --------------------------------------------------
    if (typeof body.status === "boolean") {
      // Client model currently does not contain a status field.
      // Status handling is intentionally not supported here.
      return NextResponse.json(
        {
          success: false,
          message: "Client status is not available in the current schema.",
        },
        { status: 400 }
      );
    }

    const name = String(body.name || "").trim();
    const whatsapp = String(body.whatsapp || "").trim();

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Client name is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Duplicate WhatsApp check
    // --------------------------------------------------
    if (whatsapp) {
      const existingClient = await prisma.client.findFirst({
        where: {
          whatsapp,
          NOT: {
            id: clientId,
          },
        },
        select: {
          id: true,
          name: true,
          whatsapp: true,
        },
      });

      if (existingClient) {
        return NextResponse.json(
          {
            success: false,
            duplicate: true,
            client: existingClient,
            message:
              "Another client with this WhatsApp number already exists.",
          },
          { status: 409 }
        );
      }
    }

    const client = await prisma.client.update({
      where: {
        id: clientId,
      },
      data: {
        name,
        whatsapp: whatsapp || null,
      },
    });

    return NextResponse.json({
      success: true,
      client,
      message: "Client updated successfully.",
    });
  } catch (error) {
    console.error("Update client error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update client.",
      },
      { status: 500 }
    );
  }
}