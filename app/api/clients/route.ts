import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";

    const clients = await prisma.client.findMany({
      where: search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                },
              },
              {
                whatsapp: {
                  contains: search,
                },
              },
            ],
          }
        : undefined,
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      clients,
    });
  } catch (error) {
    console.error("Get clients error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load clients.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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
              "A client with this WhatsApp number already exists.",
          },
          { status: 409 }
        );
      }
    }

    const client = await prisma.client.create({
      data: {
        name,
        whatsapp: whatsapp || null,
      },
    });

    return NextResponse.json({
      success: true,
      client,
      message: "Client created successfully.",
    });
  } catch (error) {
    console.error("Create client error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create client.",
      },
      { status: 500 }
    );
  }
}