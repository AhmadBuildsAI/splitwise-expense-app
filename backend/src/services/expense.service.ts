import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { toCents, splitEqual, validateExactSplit } from "../utils/money";
import { recordActivity } from "./activity.service";
import { CreateExpenseInput } from "../validators/expense.validators";
import { isGroupMember } from "./group.service";

async function assertAllParticipantsAreMembers(groupId: string, userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds));
  const members = await prisma.groupMember.findMany({
    where: { groupId, userId: { in: uniqueIds } },
  });
  if (members.length !== uniqueIds.length) {
    throw new AppError(400, "All participants must be members of the group.");
  }
}

function buildSplits(input: CreateExpenseInput, totalCents: number) {
  if (input.splitType === "EQUAL") {
    return splitEqual(totalCents, input.participantUserIds!);
  }
  // EXACT
  const splits = input.exactSplits!.map((s) => ({
    userId: s.userId,
    amountOwed: toCents(s.amount),
  }));
  validateExactSplit(totalCents, splits);
  return splits;
}

export async function createExpense(groupId: string, actorUserId: string, input: CreateExpenseInput) {
  const totalCents = toCents(input.totalAmount);
  if (totalCents <= 0) {
    throw new AppError(400, "Expense total must be greater than zero.");
  }

  if (!(await isGroupMember(groupId, input.paidByUserId))) {
    throw new AppError(400, "The payer must be a member of the group.");
  }

  const splits = buildSplits(input, totalCents);
  await assertAllParticipantsAreMembers(
    groupId,
    splits.map((s) => s.userId)
  );

  return prisma.$transaction(async (tx: any) => {
    const expense = await tx.expense.create({
      data: {
        groupId,
        description: input.description,
        totalAmount: totalCents,
        paidByUserId: input.paidByUserId,
        splitType: input.splitType,
        date: new Date(input.date),
        createdBy: actorUserId,
        splits: {
          create: splits.map((s) => ({ userId: s.userId, amountOwed: s.amountOwed })),
        },
      },
      include: { splits: true },
    });

    await recordActivity(tx, {
      groupId,
      actorUserId,
      eventType: "EXPENSE_CREATED",
      entityId: expense.id,
      metadata: {
        description: expense.description,
        totalAmount: expense.totalAmount,
        paidByUserId: expense.paidByUserId,
      },
    });

    return expense;
  });
}

export async function getExpenseById(expenseId: string) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { splits: { include: { user: { select: { id: true, username: true } } } }, payer: true },
  });
  if (!expense || expense.deletedAt) throw new AppError(404, "Expense not found.");
  return expense;
}

export async function listGroupExpenses(groupId: string) {
  return prisma.expense.findMany({
    where: { groupId, deletedAt: null },
    include: { splits: true, payer: { select: { id: true, username: true } } },
    orderBy: { date: "desc" },
  });
}

/**
 * Editing an expense replaces its splits atomically: delete the old
 * splits and insert the newly-validated ones inside a single
 * transaction, so a failure partway through never leaves inconsistent
 * split data. Because balances are always derived (never cached),
 * updating the underlying records is sufficient to correct balances.
 */
export async function updateExpense(
  expenseId: string,
  actorUserId: string,
  input: CreateExpenseInput
) {
  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing || existing.deletedAt) throw new AppError(404, "Expense not found.");

  const totalCents = toCents(input.totalAmount);
  if (totalCents <= 0) {
    throw new AppError(400, "Expense total must be greater than zero.");
  }

  if (!(await isGroupMember(existing.groupId, input.paidByUserId))) {
    throw new AppError(400, "The payer must be a member of the group.");
  }

  const splits = buildSplits(input, totalCents);
  await assertAllParticipantsAreMembers(
    existing.groupId,
    splits.map((s) => s.userId)
  );

  return prisma.$transaction(async (tx: any) => {
    await tx.expenseSplit.deleteMany({ where: { expenseId } });

    const expense = await tx.expense.update({
      where: { id: expenseId },
      data: {
        description: input.description,
        totalAmount: totalCents,
        paidByUserId: input.paidByUserId,
        splitType: input.splitType,
        date: new Date(input.date),
        splits: {
          create: splits.map((s) => ({ userId: s.userId, amountOwed: s.amountOwed })),
        },
      },
      include: { splits: true },
    });

    await recordActivity(tx, {
      groupId: existing.groupId,
      actorUserId,
      eventType: "EXPENSE_EDITED",
      entityId: expense.id,
      metadata: { description: expense.description, totalAmount: expense.totalAmount },
    });

    return expense;
  });
}

/** Soft-delete: preserves the historical record for audit purposes while excluding it from balances. */
export async function deleteExpense(expenseId: string, actorUserId: string) {
  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing || existing.deletedAt) throw new AppError(404, "Expense not found.");

  return prisma.$transaction(async (tx: any) => {
    const expense = await tx.expense.update({
      where: { id: expenseId },
      data: { deletedAt: new Date() },
    });

    await recordActivity(tx, {
      groupId: existing.groupId,
      actorUserId,
      eventType: "EXPENSE_DELETED",
      entityId: expense.id,
      metadata: { description: existing.description },
    });

    return expense;
  });
}
