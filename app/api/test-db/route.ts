import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const staffCount = await prisma.staff.count();
    const clientCount = await prisma.client.count();

    return Response.json({
      success: true,
      message: "Database connection successful",
      counts: {
        users: userCount,
        staff: staffCount,
        clients: clientCount,
      },
    });
  } catch (error) {
    console.error("Database connection error:", error);

    return Response.json(
      {
        success: false,
        message: "Database connection failed",
      },
      { status: 500 }
    );
  }
}