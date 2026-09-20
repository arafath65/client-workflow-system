import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type AuditLogInput = {
  userId?: number | null;
  module: string;
  action: string;
  entity?: string | null;
  entityId?: number | null;
  description: string;
  metadata?: Record<string, unknown> | null;
};

export async function getSessionUserId(): Promise<number | null> {
  const sessionUser = (await cookies()).get("session_user");
  if (!sessionUser?.value) return null;

  const userId = Number(sessionUser.value);
  if (!Number.isInteger(userId) || userId <= 0) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  return user?.id ?? null;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const userId = input.userId ?? (await getSessionUserId());
    if (!userId) return;

    const metadata =
      input.metadata === undefined || input.metadata === null
        ? null
        : JSON.stringify(input.metadata);

    await prisma.auditLog.create({
      data: {
        userId,
        module: input.module,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        description: input.description,
        metadata,
      },
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}
