import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

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
    const { id } =
      await context.params;

    const clientId = Number(id);

    if (
      !Number.isInteger(clientId) ||
      clientId <= 0
    ) {
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
    // Find Client
    // --------------------------------------------------

    const existingClient =
      await prisma.client.findUnique({
        where: {
          id: clientId,
        },
      });

    if (!existingClient) {
      return NextResponse.json(
        {
          success: false,
          message: "Client not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // Activate / Deactivate
    // --------------------------------------------------

    if (
      typeof body.status ===
      "boolean"
    ) {
      if (
        existingClient.status ===
        body.status
      ) {
        return NextResponse.json({
          success: true,
          client: existingClient,
          message: `Client is already ${
            body.status
              ? "active"
              : "inactive"
          }.`,
        });
      }

      const client =
        await prisma.client.update({
          where: {
            id: clientId,
          },

          data: {
            status:
              body.status,
          },
        });

      await writeAuditLog({
        module: "CLIENTS",

        action: body.status
          ? "ACTIVATE"
          : "DEACTIVATE",

        entity: "Client",

        entityId: client.id,

        description: `${
          body.status
            ? "Activated"
            : "Deactivated"
        } client: ${client.name}`,

        metadata: {
          previousStatus:
            existingClient.status,

          newStatus:
            client.status,

          clientId: client.id,

          name: client.name,
        },
      });

      return NextResponse.json({
        success: true,
        client,
        message: `Client ${
          body.status
            ? "activated"
            : "deactivated"
        } successfully.`,
      });
    }

    // --------------------------------------------------
    // Update Client Information
    // --------------------------------------------------

    const name = String(
      body.name || ""
    ).trim();

    const whatsapp = String(
      body.whatsapp || ""
    ).trim();

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Client name is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Duplicate WhatsApp Check
    // --------------------------------------------------

    if (whatsapp) {
      const duplicate =
        await prisma.client.findFirst({
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

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            duplicate: true,
            client: duplicate,
            message:
              "Another client with this WhatsApp number already exists.",
          },
          { status: 409 }
        );
      }
    }

    const client =
      await prisma.client.update({
        where: {
          id: clientId,
        },

        data: {
          name,
          whatsapp:
            whatsapp || null,
        },
      });

    await writeAuditLog({
      module: "CLIENTS",

      action: "UPDATE",

      entity: "Client",

      entityId: client.id,

      description: `Updated client: ${client.name}`,

      metadata: {
        name: client.name,
        whatsapp: client.whatsapp,
        status: client.status,
      },
    });

    return NextResponse.json({
      success: true,
      client,
      message:
        "Client updated successfully.",
    });
  } catch (error) {
    console.error(
      "Update client error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update client.",
      },
      { status: 500 }
    );
  }
}