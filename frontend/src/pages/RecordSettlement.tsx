import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchGroup } from "../api/groups";
import { createSettlementRequest } from "../api/misc";
import { Spinner, ErrorBanner } from "../components/Common";
import { getApiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function RecordSettlement() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup(groupId!),
    enabled: Boolean(groupId),
  });

  const [paidByUserId, setPaidByUserId] = useState("");
  const [paidToUserId, setPaidToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Set the authenticated user as the default payer once auth is available.
  useEffect(() => {
    if (user?.id && !paidByUserId) {
      setPaidByUserId(user.id);
    }
  }, [user?.id, paidByUserId]);

  // If the selected payer changes and is now the selected recipient,
  // clear the recipient because a settlement cannot be self-directed.
  useEffect(() => {
    if (paidByUserId && paidToUserId === paidByUserId) {
      setPaidToUserId("");
    }
  }, [paidByUserId, paidToUserId]);

  if (!groupId) {
    return <ErrorBanner message="Invalid group ID." />;
  }

  if (groupQuery.isLoading) {
    return <Spinner />;
  }

  if (groupQuery.error) {
    return (
      <ErrorBanner message={getApiErrorMessage(groupQuery.error)} />
    );
  }

  const group = groupQuery.data;

  if (!group) {
    return <ErrorBanner message="Group not found." />;
  }

  const trimmedAmount = amount.trim();

  // Accept only positive monetary values with at most two decimal places.
  const isValidAmount = /^\d+(\.\d{1,2})?$/.test(trimmedAmount) &&
    Number(trimmedAmount) > 0;

  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(new Date(`${date}T00:00:00`).getTime());

  const isValidSettlement =
    Boolean(paidByUserId) &&
    Boolean(paidToUserId) &&
    paidByUserId !== paidToUserId &&
    isValidAmount &&
    isValidDate;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!paidByUserId) {
      setError("Please select who paid.");
      return;
    }

    if (!paidToUserId) {
      setError("Please select who was paid.");
      return;
    }

    if (paidByUserId === paidToUserId) {
      setError("Paid by and paid to must be different people.");
      return;
    }

    if (!isValidAmount) {
      setError("Please enter a valid positive amount with at most 2 decimal places.");
      return;
    }

    if (!isValidDate) {
      setError("Please enter a valid settlement date.");
      return;
    }

    setSubmitting(true);

    try {
      await createSettlementRequest(groupId, {
        paidByUserId,
        paidToUserId,
        amount: trimmedAmount,
        date: new Date(`${date}T00:00:00`).toISOString(),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["settlements", groupId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["balances", groupId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["activity", groupId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["group", groupId],
        }),
      ]);

      toast.success("Settlement recorded");
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const recipientMembers = group.members.filter(
    (member) => member.userId !== paidByUserId,
  );

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Record a settlement
      </h1>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl bg-white p-6 shadow-sm"
      >
        <div>
          <label
            htmlFor="paid-by"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Paid by
          </label>

          <select
            id="paid-by"
            required
            value={paidByUserId}
            onChange={(e) => setPaidByUserId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">Select...</option>

            {group.members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.username}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="paid-to"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Paid to
          </label>

          <select
            id="paid-to"
            required
            value={paidToUserId}
            onChange={(e) => setPaidToUserId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">Select...</option>

            {recipientMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.username}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="settlement-amount"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Amount
          </label>

          <input
            id="settlement-amount"
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label
            htmlFor="settlement-date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Date
          </label>

          <input
            id="settlement-date"
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !isValidSettlement}
          className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Record settlement"}
        </button>
      </form>
    </div>
  );
}