import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export type WorkflowActivityActor = {
  actorUserId: number | null;
  actorUsername: string | null;
};

/** Resolves the login account that made the change. Staff assignment is stored separately. */
export async function resolveWorkflowActivityActor(
  request: NextRequest
): Promise<WorkflowActivityActor> {
  const rawId = request.cookies.get("session_user")?.value;
  const id = Number(rawId);

  if (!rawId || !Number.isInteger(id) || id <= 0) {
    return { actorUserId: null, actorUsername: null };
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true },
  });

  return user
    ? { actorUserId: user.id, actorUsername: user.username }
    : { actorUserId: null, actorUsername: null };
}

export type WorkflowActivityInput = {
  clientFileId: number;
  fileWorkflowId: number;
  workflowTaskId?: number | null;
  fileWorkflowSubTaskId?: number | null;
  fileWorkflowDocumentId?: number | null;
  staffId?: number | null;
  actorUserId?: number | null;
  staffName?: string | null;
  actorUsername?: string | null;
  activityType: "WORKFLOW_STEP" | "SUBTASK";
  action: "COMPLETED" | "REOPENED" | "RESET";
  fileNumber: string;
  clientName: string;
  workflowName: string;
  stepNumber: number;
  stepTitle: string;
  subTaskNumber?: number | null;
  subTaskTitle?: string | null;
  remarks?: string | null;
  createdAt?: Date;
};

export function makeWorkflowActivityData(input: WorkflowActivityInput) {
  return {
    clientFileId: input.clientFileId,
    fileWorkflowId: input.fileWorkflowId,
    workflowTaskId: input.workflowTaskId ?? null,
    fileWorkflowSubTaskId: input.fileWorkflowSubTaskId ?? null,
    fileWorkflowDocumentId: input.fileWorkflowDocumentId ?? null,
    staffId: input.staffId ?? null,
    actorUserId: input.actorUserId ?? null,
    staffName: input.staffName ?? null,
    actorUsername: input.actorUsername ?? null,
    activityType: input.activityType,
    action: input.action,
    fileNumber: input.fileNumber,
    clientName: input.clientName,
    workflowName: input.workflowName,
    stepNumber: input.stepNumber,
    stepTitle: input.stepTitle,
    subTaskNumber: input.subTaskNumber ?? null,
    subTaskTitle: input.subTaskTitle ?? null,
    remarks: input.remarks ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
}
