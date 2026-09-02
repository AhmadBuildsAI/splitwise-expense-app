import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchGroup } from "../api/groups";
import { createExpenseRequest } from "../api/expenses";
import { ExpenseForm, ExpenseFormValue } from "../components/ExpenseForm";
import { Spinner, ErrorBanner } from "../components/Common";
import { getApiErrorMessage } from "../api/client";

export default function AddExpense() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupQuery = useQuery({ queryKey: ["group", groupId], queryFn: () => fetchGroup(groupId!) });

  if (groupQuery.isLoading) return <Spinner />;
  if (groupQuery.error) return <ErrorBanner message={getApiErrorMessage(groupQuery.error)} />;
  const group = groupQuery.data!;

  async function handleSubmit(value: ExpenseFormValue) {
    setSubmitting(true);
    setError(null);
    try {
      await createExpenseRequest(groupId!, {
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
      queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
      queryClient.invalidateQueries({ queryKey: ["activity", groupId] });
      toast.success("Expense added");
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Add expense to {group.name}</h1>
      <ExpenseForm
        members={group.members}
        submitting={submitting}
        submitLabel="Add expense"
        onSubmit={handleSubmit}
        error={error}
      />
    </div>
  );
}
