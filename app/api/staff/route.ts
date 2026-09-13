import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim();
    const position = String(body.position ?? "").trim();

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Staff name is required.",
        },
        { status: 400 }
      );
    }

    const staff = await prisma.staff.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        position: position || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Staff member created successfully.",
      staff,
    });
  } catch (error) {
    console.error("Create staff error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create staff member.",
      },
      { status: 500 }
    );
  }
}