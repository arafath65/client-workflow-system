import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseId(value: string): number | null {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function serializeLanguage(language: {
  id: number;
  name: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: language.id,
    name: language.name,
    status: language.status,
    createdAt: language.createdAt,
    updatedAt: language.updatedAt,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id: rawId } = await params;
    const id = parseId(rawId);

    if (id === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid language ID.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.language.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Language not found.",
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (typeof body.status !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          message: "Status must be true or false.",
        },
        { status: 400 }
      );
    }

    const language = await prisma.language.update({
      where: {
        id,
      },
      data: {
        status: body.status,
      },
    });

    await writeAuditLog({
      module: "SETTINGS",
      action: body.status
        ? "ACTIVATE"
        : "DEACTIVATE",
      entity: "LANGUAGE",
      entityId: language.id,
      description: body.status
        ? `Language "${language.name}" activated.`
        : `Language "${language.name}" deactivated.`,
      metadata: {
        languageId: language.id,
        name: language.name,
        oldStatus: existing.status,
        newStatus: language.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: body.status
        ? "Language activated successfully."
        : "Language deactivated successfully.",
      language: serializeLanguage(language),
    });
  } catch (error) {
    console.error(
      "Update language error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to update language.",
      },
      { status: 500 }
    );
  }
}
