import { apiClient } from "./client";
import { Expense, SplitType } from "../types";

export interface ExpensePayload {
  description: string;
  totalAmount: string;
  paidByUserId: string;
  date: string;
  splitType: SplitType;
  participantUserIds?: string[];
  exactSplits?: { userId: string; amount: string }[];
}

export async function fetchGroupExpenses(groupId: string) {
  const res = await apiClient.get<{ data: { expenses: Expense[] } }>(`/groups/${groupId}/expenses`);
  return res.data.data.expenses;
}

export async function fetchExpense(expenseId: string) {
  const res = await apiClient.get<{ data: { expense: Expense } }>(`/expenses/${expenseId}`);
  return res.data.data.expense;
}

export async function createExpenseRequest(groupId: string, payload: ExpensePayload) {
  const res = await apiClient.post<{ data: { expense: Expense } }>(`/groups/${groupId}/expenses`, payload);
  return res.data.data.expense;
}

export async function updateExpenseRequest(expenseId: string, payload: ExpensePayload) {
  const res = await apiClient.put<{ data: { expense: Expense } }>(`/expenses/${expenseId}`, payload);
  return res.data.data.expense;
}

export async function deleteExpenseRequest(expenseId: string) {
  await apiClient.delete(`/expenses/${expenseId}`);
}
