import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchExpense, updateExpenseRequest } from "../api/expenses";
import { fetchGroup } from "../api/groups";
import { ExpenseForm, ExpenseFormValue } from "../components/ExpenseForm";
import { Spinner, ErrorBanner } from "../components/Common";
import { getApiErrorMessage } from "../api/client";

export default function EditExpense() {
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expenseQuery = useQuery({ queryKey: ["expense", expenseId], queryFn: () => fetchExpense(expenseId!) });
  const groupId = expenseQuery.data?.groupId;
  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup(groupId!),
    enabled: !!groupId,
  });

  if (expenseQuery.isLoading || groupQuery.isLoading) return <Spinner />;
  if (expenseQuery.error) return <ErrorBanner message={getApiErrorMessage(expenseQuery.error)} />;
  if (groupQuery.error) return <ErrorBanner message={getApiErrorMessage(groupQuery.error)} />;

  const expense = expenseQuery.data!;
  const group = groupQuery.data!;

  const exactAmounts: Record<string, string> = {};
  for (const s of expense.splits) exactAmounts[s.userId] = s.amountOwed;

  async function handleSubmit(value: ExpenseFormValue) {
    setSubmitting(true);
    setError(null);
    try {
      await updateExpenseRequest(expenseId!, {
        description: value.description,
        totalAmount: value.totalAmount,
        paidByUserId: value.paidByUserId,
        date: new Date(value.date).toISOString(),
        splitType: value.splitType,
        participantUserIds: value.splitType === "EQUAL" ? value.participantUserIds : undefined,
        exactSplits:
          value.splitType === "EXACT"
            ? value.participantUserIds.map((id) => ({ userId: id, amount: value.exactAmounts[id] || "0" }))
            : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["expenses", group.id] });
      queryClient.invalidateQueries({ queryKey: ["balances", group.id] });
      queryClient.invalidateQueries({ queryKey: ["activity", group.id] });
      toast.success("Expense updated");
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Edit expense</h1>
      <ExpenseForm
        members={group.members}
        initialValue={{
          description: expense.description,
          totalAmount: expense.totalAmount,
          paidByUserId: expense.paidByUserId,
          date: expense.date.slice(0, 10),
          splitType: expense.splitType,
          participantUserIds: expense.splits.map((s) => s.userId),
          exactAmounts,
        }}
        submitting={submitting}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        error={error}
      />
    </div>
  );
}
