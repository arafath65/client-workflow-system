import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

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

// ==================================================
// GET - Languages
// ==================================================

export async function GET() {
  try {
    const languages = await prisma.language.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      languages: languages.map(serializeLanguage),
    });
  } catch (error) {
    console.error(
      "Load languages error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load languages.",
      },
      { status: 500 }
    );
  }
}

// ==================================================
// POST - Create Language
// ==================================================

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const name = String(
      body.name ?? ""
    ).trim();

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Language name is required.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.language.findUnique({
      where: {
        name,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A language with this name already exists.",
        },
        { status: 409 }
      );
    }

    const language =
      await prisma.$transaction(
        async (tx) => {
          const created =
            await tx.language.create({
              data: {
                name,
                status: true,
              },
            });

          // A new language is immediately available for
          // every document type. Its initial price is the
          // current document default price.
          const documentTypes =
            await tx.documentType.findMany({
              select: {
                id: true,
                defaultAmount: true,
              },
            });

          if (documentTypes.length > 0) {
            await tx.documentTypeLanguage.createMany({
              data: documentTypes.map(
                (documentType) => ({
                  documentTypeId:
                    documentType.id,
                  languageId: created.id,
                  price:
                    documentType.defaultAmount,
                })
              ),
            });
          }

          return created;
        }
      );

    await writeAuditLog({
      module: "SETTINGS",
      action: "CREATE",
      entity: "LANGUAGE",
      entityId: language.id,
      description:
        `Language "${language.name}" created.`,
      metadata: {
        languageId: language.id,
        name: language.name,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Language created successfully.",
        language:
          serializeLanguage(language),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Create language error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to create language.",
      },
      { status: 500 }
    );
  }
}
