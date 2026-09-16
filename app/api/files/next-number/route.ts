import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // --------------------------------------------------
    // Check existing sequence
    // --------------------------------------------------

    const sequence =
      await prisma.fileNumberSequence.findUnique({
        where: {
          id: 1,
        },
      });

    let nextNumber = 1;

    if (sequence) {
      nextNumber = sequence.nextNumber;
    } else {
      // ------------------------------------------------
      // Sequence does not exist yet.
      // Find the highest existing AIG number.
      // ------------------------------------------------

      const lastFile =
        await prisma.clientFile.findFirst({
          where: {
            fileNumberType: "SYSTEM",
            fileNumber: {
              startsWith: "AIG-",
            },
          },
          orderBy: {
            fileNumber: "desc",
          },
          select: {
            fileNumber: true,
          },
        });

      if (lastFile?.fileNumber) {
        const numberPart =
          lastFile.fileNumber.replace(
            "AIG-",
            ""
          );

        const parsed =
          Number(numberPart);

        if (
          Number.isInteger(parsed) &&
          parsed >= 1
        ) {
          nextNumber = parsed + 1;
        }
      }
    }

    const fileNumber = `AIG-${String(
      nextNumber
    ).padStart(6, "0")}`;

    return NextResponse.json({
      success: true,
      fileNumber,
    });
  } catch (error) {
    console.error(
      "Preview next file number error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to preview File Number.",
      },
      { status: 500 }
    );
  }
}