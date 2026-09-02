import { useEffect, useMemo, useState } from "react";
import { GroupMember, SplitType } from "../types";
import { formatCurrency } from "../utils/currency";

export interface ExpenseFormValue {
  description: string;
  totalAmount: string;
  paidByUserId: string;
  date: string;
  splitType: SplitType;
  participantUserIds: string[];
  exactAmounts: Record<string, string>;
}

interface Props {
  members: GroupMember[];
  initialValue?: Partial<ExpenseFormValue>;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (value: ExpenseFormValue) => void;
  error?: string | null;
}

export function ExpenseForm({ members, initialValue, submitting, submitLabel, onSubmit, error }: Props) {
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [totalAmount, setTotalAmount] = useState(initialValue?.totalAmount ?? "");
  const [paidByUserId, setPaidByUserId] = useState(initialValue?.paidByUserId ?? members[0]?.userId ?? "");
  const [date, setDate] = useState(initialValue?.date ?? new Date().toISOString().slice(0, 10));
  const [splitType, setSplitType] = useState<SplitType>(initialValue?.splitType ?? "EQUAL");
  const [participantUserIds, setParticipantUserIds] = useState<string[]>(
    initialValue?.participantUserIds ?? members.map((m) => m.userId)
  );
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(initialValue?.exactAmounts ?? {});

  // Keep exact-amount inputs in sync with which participants are selected.
  useEffect(() => {
    setExactAmounts((prev) => {
      const next: Record<string, string> = {};
      for (const id of participantUserIds) next[id] = prev[id] ?? "";
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantUserIds.join(",")]);

  function toggleParticipant(userId: string) {
    setParticipantUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  const totalCentsInt = useMemo(() => Math.round(parseFloat(totalAmount || "0") * 100), [totalAmount]);

  const equalShare = useMemo(() => {
    if (participantUserIds.length === 0 || !totalCentsInt) return {};
    const base = Math.floor(totalCentsInt / participantUserIds.length);
    const remainder = totalCentsInt - base * participantUserIds.length;
    const shares: Record<string, number> = {};
    participantUserIds.forEach((id, i) => {
      shares[id] = base + (i < remainder ? 1 : 0);
    });
    return shares;
  }, [totalCentsInt, participantUserIds]);

  const exactTotalCents = useMemo(() => {
    return Object.values(exactAmounts).reduce((sum, v) => sum + Math.round((parseFloat(v || "0") || 0) * 100), 0);
  }, [exactAmounts]);

  const remainingCents = totalCentsInt - exactTotalCents;
  const isExactValid = splitType !== "EXACT" || remainingCents === 0;
  const canSubmit =
    description.trim().length > 0 &&
    totalCentsInt > 0 &&
    paidByUserId &&
    participantUserIds.length > 0 &&
    isExactValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      description,
      totalAmount,
      paidByUserId,
      date,
      splitType,
      participantUserIds,
      exactAmounts,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
        <input
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Total amount</label>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Paid by</label>
        <select
          value={paidByUserId}
          onChange={(e) => setPaidByUserId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.username}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Split type</label>
        <div className="flex gap-2">
          {(["EQUAL", "EXACT"] as SplitType[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setSplitType(t)}
              className={`rounded-md border px-4 py-1.5 text-sm font-medium ${
                splitType === t
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t === "EQUAL" ? "Equal" : "Exact amounts"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Participants</label>
        <div className="space-y-2">
          {members.map((m) => {
            const selected = participantUserIds.includes(m.userId);
            return (
              <div key={m.userId} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleParticipant(m.userId)}
                  />
                  {m.username}
                </label>
                {selected && splitType === "EQUAL" && (
                  <span className="text-sm text-gray-500">
                    {formatCurrency(((equalShare[m.userId] ?? 0) / 100).toFixed(2))}
                  </span>
                )}
                {selected && splitType === "EXACT" && (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={exactAmounts[m.userId] ?? ""}
                    onChange={(e) => setExactAmounts((prev) => ({ ...prev, [m.userId]: e.target.value }))}
                    className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {splitType === "EXACT" && (
        <div className="flex items-center justify-between rounded-md bg-gray-50 px-4 py-2 text-sm">
          <span className="text-gray-500">
            Total: {formatCurrency((totalCentsInt / 100).toFixed(2))} · Split total:{" "}
            {formatCurrency((exactTotalCents / 100).toFixed(2))}
          </span>
          <span className={remainingCents === 0 ? "text-brand-600" : "text-red-600"}>
            {remainingCents === 0
              ? "Balanced"
              : `Remaining: ${formatCurrency((remainingCents / 100).toFixed(2))}`}
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
