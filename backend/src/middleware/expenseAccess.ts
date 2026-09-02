import { NextFunction, Response } from "express";
import { AuthedRequest } from "./auth";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";

/**
 * For routes keyed by :expenseId (rather than :groupId), resolve the
 * expense's group and verify the requester is a member of it.
 */
export async function requireExpenseGroupMember(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.expenseId } });
    if (!expense || expense.deletedAt) {
      throw new AppError(404, "Expense not found.");
    }
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: expense.groupId, userId: req.userId! } },
    });
    if (!membership) {
      throw new AppError(403, "You must be a member of this group.");
    }
    next();
  } catch (err) {
    next(err);
  }
}
