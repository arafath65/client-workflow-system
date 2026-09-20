import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const sessionUser = (await cookies()).get("session_user");

    if (!sessionUser?.value) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const userId = Number(sessionUser.value);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Current password and new password are required.",
        },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "New password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User account not found.",
        },
        { status: 404 }
      );
    }

    const currentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!currentPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Current password is incorrect.",
        },
        { status: 400 }
      );
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      user.passwordHash
    );

    if (samePassword) {
      return NextResponse.json(
        {
          success: false,
          message:
            "New password must be different from the current password.",
        },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 6);

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
      },
    });

    // Audit log: successful password change only.
    // Never include passwords or password hashes in audit metadata.
    await writeAuditLog({
      userId: user.id,
      module: "AUTH",
      action: "CHANGE_PASSWORD",
      entity: "USER",
      entityId: user.id,
      description: "User changed their password successfully.",
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to change password.",
      },
      { status: 500 }
    );
  }
}