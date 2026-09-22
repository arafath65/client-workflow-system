import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

function parseMoney(value: unknown): string | null {
  const raw = String(value ?? "").trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    return null;
  }

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount.toFixed(2);
}

function serializeDocumentType(documentType: {
  id: number;
  name: string;
  description: string | null;
  defaultAmount: unknown;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: documentType.id,
    name: documentType.name,
    description: documentType.description,
    defaultAmount: Number(documentType.defaultAmount),
    status: documentType.status,
    createdAt: documentType.createdAt,
    updatedAt: documentType.updatedAt,
  };
}

// ==================================================
// GET - Load Document Types
// ==================================================

export async function GET() {
  try {
    const documentTypes = await prisma.documentType.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      documentTypes: documentTypes.map(serializeDocumentType),
    });
  } catch (error) {
    console.error("Load document types error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load document types.",
      },
      { status: 500 }
    );
  }
}

// ==================================================
// POST - Create Document Type
// ==================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const defaultAmount = parseMoney(body.defaultAmount);

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Document type name is required.",
        },
        { status: 400 }
      );
    }

    if (defaultAmount === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid default price is required.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.documentType.findUnique({
      where: {
        name,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "A document type with this name already exists.",
        },
        { status: 409 }
      );
    }

    const documentType = await prisma.documentType.create({
      data: {
        name,
        description: description || null,
        defaultAmount,
        status: true,
      },
    });

    await writeAuditLog({
      module: "SETTINGS",
      action: "CREATE",
      entity: "DOCUMENT_TYPE",
      entityId: documentType.id,
      description: `Document type "${documentType.name}" created.`,
      metadata: {
        name: documentType.name,
        description: documentType.description,
        defaultAmount,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Document type created successfully.",
        documentType: serializeDocumentType(documentType),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create document type error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create document type.",
      },
      { status: 500 }
    );
  }
}