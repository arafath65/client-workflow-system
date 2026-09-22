
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

// ==================================================
// Route Context
// ==================================================

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ==================================================
// Helpers
// ==================================================

function parseId(value: string): number | null {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function serializeDocumentType(
  documentType: {
    id: number;
    name: string;
    description: string | null;
    defaultAmount: unknown;
    status: boolean;
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
  };
}

// ==================================================
// PATCH - Update / Activate / Deactivate
// ==================================================

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    // --------------------------------------------------
    // Get ID
    // --------------------------------------------------

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

    // --------------------------------------------------
    // Read Request Body
    // --------------------------------------------------

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
    };

    // --------------------------------------------------
    // Check Existing Document Type
    // --------------------------------------------------

    const existingDocumentType =
      await prisma.documentType.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          name: true,
          description: true,
          defaultAmount: true,
          status: true,
        },
      });

    if (!existingDocumentType) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Document type not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // Detect Update Type
    // --------------------------------------------------

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

    const isStatusOnlyUpdate =
      hasStatus &&
      !hasName &&
      !hasDescription &&
      !hasDefaultAmount;

    // ==================================================
    // STATUS ONLY
    // ==================================================

    if (isStatusOnlyUpdate) {
      if (
        typeof requestBody.status !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Status must be true or false.",
          },
          { status: 400 }
        );
      }

      const nextStatus =
        requestBody.status;

      const updatedDocumentType =
        await prisma.documentType.update({
          where: {
            id,
          },
          data: {
            status: nextStatus,
          },
          select: {
            id: true,
            name: true,
            description: true,
            defaultAmount: true,
            status: true,
          },
        });

      // --------------------------------------------------
      // Audit Log
      // --------------------------------------------------

      await writeAuditLog({
        module: "SETTINGS",
        action: nextStatus
          ? "ACTIVATE"
          : "DEACTIVATE",
        entity: "DOCUMENT_TYPE",
        entityId:
          updatedDocumentType.id,
        description: nextStatus
          ? `Document type "${updatedDocumentType.name}" activated.`
          : `Document type "${updatedDocumentType.name}" deactivated.`,
        metadata: {
          documentTypeId:
            updatedDocumentType.id,
          name:
            updatedDocumentType.name,
          oldStatus:
            existingDocumentType.status,
          newStatus: nextStatus,
        },
      });

      return NextResponse.json({
        success: true,
        message: nextStatus
          ? "Document type activated successfully."
          : "Document type deactivated successfully.",
        documentType:
          serializeDocumentType(
            updatedDocumentType
          ),
      });
    }

    // ==================================================
    // NORMAL EDIT
    // ==================================================

    const name =
      typeof requestBody.name ===
      "string"
        ? requestBody.name.trim()
        : existingDocumentType.name;

    const description =
      typeof requestBody.description ===
      "string"
        ? requestBody.description.trim()
        : requestBody.description ===
          null
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

    // --------------------------------------------------
    // Parse Default Amount
    // --------------------------------------------------

    let defaultAmount =
      Number(
        existingDocumentType.defaultAmount
      );

    if (hasDefaultAmount) {
      const rawAmount =
        requestBody.defaultAmount;

      if (
        typeof rawAmount !==
          "string" &&
        typeof rawAmount !==
          "number"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Valid default price is required.",
          },
          { status: 400 }
        );
      }

      const amountText =
        String(rawAmount).trim();

      if (
        !/^\d+(?:\.\d{1,2})?$/.test(
          amountText
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Valid default price is required.",
          },
          { status: 400 }
        );
      }

      defaultAmount =
        Number(amountText);

      if (
        !Number.isFinite(
          defaultAmount
        ) ||
        defaultAmount < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Default price must be zero or greater.",
          },
          { status: 400 }
        );
      }
    }

    // --------------------------------------------------
    // Validate Optional Status
    // --------------------------------------------------

    let status =
      existingDocumentType.status;

    if (hasStatus) {
      if (
        typeof requestBody.status !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Status must be true or false.",
          },
          { status: 400 }
        );
      }

      status = requestBody.status;
    }

    // --------------------------------------------------
    // Check Duplicate Name
    // --------------------------------------------------

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

    // --------------------------------------------------
    // Update
    // --------------------------------------------------

    const updatedDocumentType =
      await prisma.documentType.update({
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
        select: {
          id: true,
          name: true,
          description: true,
          defaultAmount: true,
          status: true,
        },
      });

    // --------------------------------------------------
    // Audit Log
    // --------------------------------------------------

    await writeAuditLog({
      module: "SETTINGS",
      action: "UPDATE",
      entity: "DOCUMENT_TYPE",
      entityId:
        updatedDocumentType.id,
      description: `Document type "${updatedDocumentType.name}" updated.`,
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
        },
      },
    });

    // --------------------------------------------------
    // Response
    // --------------------------------------------------

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
