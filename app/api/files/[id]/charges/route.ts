import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ==================================================
// Money Helpers
// ==================================================

function parseMoney(value: unknown): string | null {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    return null;
  }

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount.toFixed(2);
}

function parsePositiveInteger(value: unknown): number | null {
  const raw = String(value ?? "").trim();

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const number = Number(raw);

  if (!Number.isSafeInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

function parseFileId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ==================================================
// GET - Load File Charges
// ==================================================

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const clientFileId = parseFileId(id);

    if (clientFileId === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file ID.",
        },
        { status: 400 }
      );
    }

    const clientFile = await prisma.clientFile.findUnique({
      where: {
        id: clientFileId,
      },
      select: {
        id: true,
        fileNumber: true,
      },
    });

    if (!clientFile) {
      return NextResponse.json(
        {
          success: false,
          message: "Client file not found.",
        },
        { status: 404 }
      );
    }

    const charges = await prisma.fileCharge.findMany({
      where: {
        clientFileId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const total = charges.reduce(
      (sum, charge) => sum + Number(charge.totalAmount),
      0
    );

    return NextResponse.json({
      success: true,
      charges,
      totalAmount: total.toFixed(2),
    });
  } catch (error) {
    console.error("Load file charges error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load file charges.",
      },
      { status: 500 }
    );
  }
}

// ==================================================
// POST - Add File Charge
// ==================================================

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const clientFileId = parseFileId(id);

    if (clientFileId === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file ID.",
        },
        { status: 400 }
      );
    }

    const clientFile = await prisma.clientFile.findUnique({
      where: {
        id: clientFileId,
      },
      select: {
        id: true,
        fileNumber: true,
        client: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!clientFile) {
      return NextResponse.json(
        {
          success: false,
          message: "Client file not found.",
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    const description = String(
      body.description ?? ""
    ).trim();

    const quantity = parsePositiveInteger(body.quantity);
    const unitAmount = parseMoney(body.unitAmount);

    if (!description) {
      return NextResponse.json(
        {
          success: false,
          message: "Charge description is required.",
        },
        { status: 400 }
      );
    }

    if (quantity === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Quantity must be a positive whole number.",
        },
        { status: 400 }
      );
    }

    if (unitAmount === null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unit amount must be a valid non-negative amount with up to 2 decimal places.",
        },
        { status: 400 }
      );
    }

    const unitCents = Math.round(Number(unitAmount) * 100);

    if (
      !Number.isSafeInteger(unitCents) ||
      unitCents < 0 ||
      unitCents > Math.floor(Number.MAX_SAFE_INTEGER / quantity)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Charge amount is too large.",
        },
        { status: 400 }
      );
    }

    const totalCents = unitCents * quantity;
    const totalAmount = (totalCents / 100).toFixed(2);

    const charge = await prisma.fileCharge.create({
      data: {
        clientFileId,
        description,
        quantity,
        unitAmount,
        totalAmount,
      },
    });

    await writeAuditLog({
      module: "FILES",
      action: "CREATE",
      entity: "FILE_CHARGE",
      entityId: charge.id,
      description: `Extra charge of ${totalAmount} added to file ${clientFile.fileNumber}.`,
      metadata: {
        chargeId: charge.id,
        clientFileId,
        fileNumber: clientFile.fileNumber,
        clientName: clientFile.client.name,
        description,
        quantity,
        unitAmount,
        totalAmount,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Extra charge added successfully.",
        charge,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create file charge error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to add extra charge.",
      },
      { status: 500 }
    );
  }
}
