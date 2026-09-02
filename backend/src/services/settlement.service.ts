import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { toCents } from "../utils/money";
import { recordActivity } from "./activity.service";
import { isGroupMember } from "./group.service";
import { CreateSettlementInput } from "../validators/settlement.validators";

export async function createSettlement(
  groupId: string,
  actorUserId: string,
  input: CreateSettlementInput
) {
  const amountCents = toCents(input.amount);
  if (amountCents <= 0) {
    throw new AppError(400, "Settlement amount must be greater than zero.");
  }

  if (input.paidByUserId === input.paidToUserId) {
    throw new AppError(400, "A user cannot pay themselves.");
  }

  const [payerIsMember, payeeIsMember] = await Promise.all([
    isGroupMember(groupId, input.paidByUserId),
    isGroupMember(groupId, input.paidToUserId),
  ]);
  if (!payerIsMember || !payeeIsMember) {
    throw new AppError(400, "Both users must belong to the group.");
  }

  return prisma.$transaction(async (tx: any) => {
    const settlement = await tx.settlement.create({
      data: {
        groupId,
        paidByUserId: input.paidByUserId,
        paidToUserId: input.paidToUserId,
        amount: amountCents,
        date: new Date(input.date),
      },
    });

    await recordActivity(tx, {
      groupId,
      actorUserId,
      eventType: "SETTLEMENT_RECORDED",
      entityId: settlement.id,
      metadata: {
        paidByUserId: settlement.paidByUserId,
        paidToUserId: settlement.paidToUserId,
        amount: settlement.amount,
      },
    });

    return settlement;
  });
}

export async function listGroupSettlements(groupId: string) {
  return prisma.settlement.findMany({
    where: { groupId },
    include: {
      payer: { select: { id: true, username: true } },
      payee: { select: { id: true, username: true } },
    },
    orderBy: { date: "desc" },
  });
}
