import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { recordActivity } from "./activity.service";
import { getUserBalanceInGroup } from "./balance.service";
import { CreateGroupInput } from "../validators/group.validators";

export async function createGroup(userId: string, input: CreateGroupInput) {
  return prisma.$transaction(async (tx: any) => {
    const group = await tx.group.create({
      data: { name: input.name, createdBy: userId },
    });
    await tx.groupMember.create({
      data: { groupId: group.id, userId },
    });
    await recordActivity(tx, {
      groupId: group.id,
      actorUserId: userId,
      eventType: "GROUP_CREATED",
      entityId: group.id,
      metadata: { name: group.name },
    });
    return group;
  });
}

export async function listUserGroups(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: { include: { _count: { select: { members: true } } } },
    },
    orderBy: { joinedAt: "desc" },
  });
  return memberships.map((m: any) => m.group);
}

export async function getGroupDetails(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: { select: { id: true, username: true, email: true } } } },
    },
  });
  if (!group) throw new AppError(404, "Group not found.");
  return group;
}

export async function addMember(groupId: string, actorUserId: string, usernameOrEmail: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    },
  });
  if (!user) {
    throw new AppError(404, "No user found with that username or email.");
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (existing) {
    throw new AppError(409, "This user is already a member of the group.");
  }

  return prisma.$transaction(async (tx: any) => {
    const member = await tx.groupMember.create({
      data: { groupId, userId: user.id },
    });
    await recordActivity(tx, {
      groupId,
      actorUserId,
      eventType: "MEMBER_JOINED",
      entityId: user.id,
      metadata: { username: user.username },
    });
    return member;
  });
}

/**
 * A member may only leave a group once their net balance is exactly
 * zero. This enforces that all obligations are settled before someone
 * exits, preserving the correctness of remaining balances.
 */
export async function removeMember(groupId: string, requestingUserId: string, targetUserId: string) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });
  if (!membership) {
    throw new AppError(404, "This user is not a member of the group.");
  }

  // Only the user themself (leaving) or the group creator (removing
  // someone) may perform this action.
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError(404, "Group not found.");

  const isSelf = requestingUserId === targetUserId;
  const isCreator = requestingUserId === group.createdBy;
  if (!isSelf && !isCreator) {
    throw new AppError(403, "You do not have permission to perform this action.");
  }

  const balance = await getUserBalanceInGroup(groupId, targetUserId);
  if (balance !== 0) {
    throw new AppError(
      400,
      "You cannot leave this group until your outstanding balance is settled."
    );
  }

  return prisma.$transaction(async (tx: any) => {
    await tx.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    await recordActivity(tx, {
      groupId,
      actorUserId: requestingUserId,
      eventType: "MEMBER_LEFT",
      entityId: targetUserId,
      metadata: {},
    });
  });
}

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return !!m;
}
