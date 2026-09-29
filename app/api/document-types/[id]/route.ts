import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type LanguageInput = {
  languageId?: unknown;
  price?: unknown;
};

function parseId(value: string): number | null {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function parseMoney(value: unknown): number | null {
  const raw = String(value ?? "").trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    return null;
  }

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount;
}

function serializeDocumentType(
  documentType: {
    id: number;
    name: string;
    description: string | null;
    defaultAmount: unknown;
    status: boolean;
    languages?: Array<{
      languageId: number;
      price: unknown;
      language: {
        id: number;
        name: string;
        status: boolean;
      };
    }>;
  }
) {
  return {
    id: documentType.id,
    name: documentType.name,
    description: documentType.description,
    defaultAmount: Number(
      documentType.defaultAmount
    ),
    status: documentType.status,
    languages: (
      documentType.languages ?? []
    ).map((item) => ({
      languageId: item.languageId,
        language: item.language,
        price: Number(item.price),
      })),
  };
}

async function loadDocumentType(id: number) {
  return prisma.documentType.findUnique({
    where: {
      id,
    },
    include: {
      languages: {
        include: {
          language: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: {
          language: {
            name: "asc",
          },
        },
      },
    },
  });
}

// ==================================================
// PATCH - Update / Activate / Deactivate
// ==================================================

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
          message: "Invalid document type ID.",
        },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const requestBody = body as {
      name?: unknown;
      description?: unknown;
      defaultAmount?: unknown;
      status?: unknown;
      languages?: unknown;
    };

    const existingDocumentType =
      await loadDocumentType(id);

    if (!existingDocumentType) {
      return NextResponse.json(
        {
          success: false,
          message: "Document type not found.",
        },
        { status: 404 }
      );
    }

    const hasStatus =
      Object.prototype.hasOwnProperty.call(
        requestBody,
        "status"
      );

    const hasName =
      Object.prototype.hasOwnProperty.call(
        requestBody,
        "name"
      );

    const hasDescription =
      Object.prototype.hasOwnProperty.call(
        requestBody,
        "description"
      );

    const hasDefaultAmount =
      Object.prototype.hasOwnProperty.call(
        requestBody,
        "defaultAmount"
      );

    const hasLanguages =
      Object.prototype.hasOwnProperty.call(
        requestBody,
        "languages"
      );

    const isStatusOnlyUpdate =
      hasStatus &&
      !hasName &&
      !hasDescription &&
      !hasDefaultAmount &&
      !hasLanguages;

    // ==================================================
    // STATUS ONLY
    // ==================================================

    if (isStatusOnlyUpdate) {
      if (
        typeof requestBody.status !== "boolean"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Status must be true or false.",
          },
          { status: 400 }
        );
      }

      const updatedDocumentType =
        await prisma.documentType.update({
          where: {
            id,
          },
          data: {
            status: requestBody.status,
          },
        });

      const fullDocumentType =
        await loadDocumentType(
          updatedDocumentType.id
        );

      if (!fullDocumentType) {
        throw new Error(
          "Unable to load updated document type."
        );
      }

      await writeAuditLog({
        module: "SETTINGS",
        action: requestBody.status
          ? "ACTIVATE"
          : "DEACTIVATE",
        entity: "DOCUMENT_TYPE",
        entityId: fullDocumentType.id,
        description:
          requestBody.status
            ? `Document type "${fullDocumentType.name}" activated.`
            : `Document type "${fullDocumentType.name}" deactivated.`,
        metadata: {
          documentTypeId:
            fullDocumentType.id,
          name: fullDocumentType.name,
          oldStatus:
            existingDocumentType.status,
          newStatus:
            fullDocumentType.status,
        },
      });

      return NextResponse.json({
        success: true,
        message: requestBody.status
          ? "Document type activated successfully."
          : "Document type deactivated successfully.",
        documentType:
          serializeDocumentType(
            fullDocumentType
          ),
      });
    }

    // ==================================================
    // NORMAL EDIT
    // ==================================================

    const name =
      typeof requestBody.name === "string"
        ? requestBody.name.trim()
        : existingDocumentType.name;

    const description =
      typeof requestBody.description ===
      "string"
        ? requestBody.description.trim()
        : requestBody.description === null
          ? null
          : existingDocumentType.description;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Document type name is required.",
        },
        { status: 400 }
      );
    }

    const parsedDefaultAmount =
      hasDefaultAmount
        ? parseMoney(
            requestBody.defaultAmount
          )
        : Number(
            existingDocumentType.defaultAmount
          );

    if (parsedDefaultAmount === null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid default price is required.",
        },
        { status: 400 }
      );
    }

    const defaultAmount = parsedDefaultAmount;

    const status =
      typeof requestBody.status === "boolean"
        ? requestBody.status
        : existingDocumentType.status;

    const duplicate =
      await prisma.documentType.findFirst({
        where: {
          name: {
            equals: name,
          },
          NOT: {
            id,
          },
        },
        select: {
          id: true,
        },
      });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Another document type with this name already exists.",
        },
        { status: 409 }
      );
    }

    const languageRows: Array<{
      languageId: number;
      price: number;
    }> = [];

    if (hasLanguages) {
      if (!Array.isArray(requestBody.languages)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Languages must be an array.",
          },
          { status: 400 }
        );
      }

      for (
        const item of
          requestBody.languages as unknown[]
      ) {
        if (
          typeof item !== "object" ||
          item === null ||
          Array.isArray(item)
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Invalid language configuration.",
            },
            { status: 400 }
          );
        }

        const input =
          item as LanguageInput;

        const languageId =
          Number(input.languageId);

        const price =
          parseMoney(input.price);

        if (
          !Number.isInteger(languageId) ||
          languageId <= 0 ||
          price === null
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Every selected language must have a valid price.",
            },
            { status: 400 }
          );
        }

        languageRows.push({
          languageId,
          price,
        });
      }

      const languageIds =
        languageRows.map(
          (item) => item.languageId
        );

      if (
        new Set(languageIds).size !==
        languageIds.length
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The same language cannot be configured more than once.",
          },
          { status: 400 }
        );
      }

      if (languageIds.length > 0) {
        const activeLanguages =
          await prisma.language.findMany({
            where: {
              id: {
                in: languageIds,
              },
              status: true,
            },
            select: {
              id: true,
            },
          });

        if (
          activeLanguages.length !==
          languageIds.length
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "One or more selected languages are invalid or inactive.",
            },
            { status: 400 }
          );
        }
      }
    }

    const updatedDocumentType =
      await prisma.$transaction(
        async (tx) => {
          await tx.documentType.update({
              where: {
                id,
              },
              data: {
                name,
                description:
                  description || null,
                defaultAmount,
                status,
              },
            });

          if (hasLanguages) {
            await tx.documentTypeLanguage.deleteMany({
              where: {
                documentTypeId: id,
              },
            });

            if (languageRows.length > 0) {
              await tx.documentTypeLanguage.createMany({
                data: languageRows.map(
                  (item) => ({
                    documentTypeId: id,
                    languageId:
                      item.languageId,
                    price: item.price,
                  })
                ),
              });
            }
          }

          return tx.documentType.findUniqueOrThrow({
            where: {
              id,
            },
            include: {
              languages: {
                include: {
                  language: {
                    select: {
                      id: true,
                      name: true,
                      status: true,
                    },
                  },
                },
                orderBy: {
                  language: {
                    name: "asc",
                  },
                },
              },
            },
          });
        }
      );

    await writeAuditLog({
      module: "SETTINGS",
      action: "UPDATE",
      entity: "DOCUMENT_TYPE",
      entityId: updatedDocumentType.id,
      description:
        `Document type "${updatedDocumentType.name}" updated.`,
      metadata: {
        documentTypeId:
          updatedDocumentType.id,
        oldValues: {
          name:
            existingDocumentType.name,
          description:
            existingDocumentType.description,
          defaultAmount:
            Number(
              existingDocumentType.defaultAmount
            ),
          status:
            existingDocumentType.status,
          languages:
            existingDocumentType.languages.map(
              (item) => ({
                languageId:
                  item.languageId,
                languageName:
                  item.language.name,
                price:
                  Number(item.price),
              })
            ),
        },
        newValues: {
          name:
            updatedDocumentType.name,
          description:
            updatedDocumentType.description,
          defaultAmount:
            Number(
              updatedDocumentType.defaultAmount
            ),
          status:
            updatedDocumentType.status,
          languages:
            updatedDocumentType.languages.map(
              (item) => ({
                languageId:
                  item.languageId,
                languageName:
                  item.language.name,
                price:
                  Number(item.price),
              })
            ),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Document type updated successfully.",
      documentType:
        serializeDocumentType(
          updatedDocumentType
        ),
    });
  } catch (error) {
    console.error(
      "Update document type error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to update document type.",
      },
      { status: 500 }
    );
  }
}
