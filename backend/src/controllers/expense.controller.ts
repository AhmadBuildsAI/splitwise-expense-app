import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { createExpenseSchema, updateExpenseSchema } from "../validators/expense.validators";
import * as expenseService from "../services/expense.service";
import { toDecimalString } from "../utils/money";

function serializeExpense(expense: any) {
  return {
    id: expense.id,
    groupId: expense.groupId,
    description: expense.description,
    totalAmount: toDecimalString(expense.totalAmount),
    paidByUserId: expense.paidByUserId,
    splitType: expense.splitType,
    date: expense.date,
    splits: expense.splits.map((s: any) => ({
      userId: s.userId,
      amountOwed: toDecimalString(s.amountOwed),
    })),
  };
}

export async function createExpense(req: AuthedRequest, res: Response) {
  const input = createExpenseSchema.parse(req.body);
  const expense = await expenseService.createExpense(req.params.groupId, req.userId!, input);
  res.status(201).json({ success: true, data: { expense: serializeExpense(expense) } });
}

export async function listExpenses(req: AuthedRequest, res: Response) {
  const expenses = await expenseService.listGroupExpenses(req.params.groupId);
  res.status(200).json({ success: true, data: { expenses: expenses.map(serializeExpense) } });
}

export async function getExpense(req: AuthedRequest, res: Response) {
  const expense = await expenseService.getExpenseById(req.params.expenseId);
  res.status(200).json({ success: true, data: { expense: serializeExpense(expense) } });
}

export async function updateExpense(req: AuthedRequest, res: Response) {
  const input = updateExpenseSchema.parse(req.body);
  const expense = await expenseService.updateExpense(req.params.expenseId, req.userId!, input);
  res.status(200).json({ success: true, data: { expense: serializeExpense(expense) } });
}

export async function deleteExpense(req: AuthedRequest, res: Response) {
  await expenseService.deleteExpense(req.params.expenseId, req.userId!);
  res.status(200).json({ success: true, data: { message: "Expense deleted." } });
}
