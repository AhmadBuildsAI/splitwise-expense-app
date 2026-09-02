import { prisma } from "../lib/prisma";

export type ActivityEventType =
  | "EXPENSE_CREATED"
  | "EXPENSE_EDITED"
  | "EXPENSE_DELETED"
  | "SETTLEMENT_RECORDED"
  | "MEMBER_JOINED"
  | "MEMBER_LEFT"
  | "GROUP_CREATED";

/**
 * Record an activity/audit-log entry. Accepts an optional Prisma
 * transaction client (typed loosely here since the generated Prisma
 * namespace types are only available after `prisma generate` has run
 * against a reachable engine) so it can participate in the same
 * transaction as the financial mutation that triggered it (e.g.
 * expense creation).
 */
export async function recordActivity(
  tx: any,
  params: {
    groupId: string;
    actorUserId: string;
    eventType: ActivityEventType;
    entityId: string;
    metadata?: Record<string, unknown>;
  }
) {
  return tx.activity.create({
    data: {
      groupId: params.groupId,
      actorUserId: params.actorUserId,
      eventType: params.eventType,
      entityId: params.entityId,
      metadata: params.metadata ?? {},
    },
  });
}

export async function getGroupActivity(groupId: string, limit = 10) {
  return prisma.activity.findMany({
    where: { groupId },
    include: { actor: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
