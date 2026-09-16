import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const thirdParties = await prisma.thirdParty.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      thirdParties,
    });
  } catch (error) {
    console.error(
      "Get third parties error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load third parties.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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

    const existing =
      await prisma.thirdParty.findFirst({
        where: {
          name: {
            equals: name,
          },
        },
      });

    if (existing) {
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
      await prisma.thirdParty.create({
        data: {
          name,
          whatsapp: whatsapp || null,
          status: true,
        },
      });

    return NextResponse.json(
      {
        success: true,
        message:
          "Third party created successfully.",
        thirdParty,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Create third party error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create third party.",
      },
      {
        status: 500,
      }
    );
  }
}