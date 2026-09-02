import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchGroup, addMemberRequest, removeMemberRequest } from "../api/groups";
import { fetchGroupExpenses, deleteExpenseRequest } from "../api/expenses";
import { fetchBalances, fetchSettlements, fetchActivity } from "../api/misc";
import { useAuth } from "../context/AuthContext";
import { Spinner, EmptyState, ErrorBanner, BalancePill } from "../components/Common";
import { formatCurrency } from "../utils/currency";
import { getApiErrorMessage } from "../api/client";

export default function GroupDetails() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [memberInput, setMemberInput] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);

  const groupQuery = useQuery({ queryKey: ["group", groupId], queryFn: () => fetchGroup(groupId!) });
  const balancesQuery = useQuery({ queryKey: ["balances", groupId], queryFn: () => fetchBalances(groupId!) });
  const expensesQuery = useQuery({ queryKey: ["expenses", groupId], queryFn: () => fetchGroupExpenses(groupId!) });
  const settlementsQuery = useQuery({
    queryKey: ["settlements", groupId],
    queryFn: () => fetchSettlements(groupId!),
  });
  const activityQuery = useQuery({ queryKey: ["activity", groupId], queryFn: () => fetchActivity(groupId!) });

  const addMemberMutation = useMutation({
    mutationFn: (usernameOrEmail: string) => addMemberRequest(groupId!, usernameOrEmail),
    onSuccess: () => {
      setMemberInput("");
      setMemberError(null);
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      toast.success("Member added");
    },
    onError: (err) => setMemberError(getApiErrorMessage(err)),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => removeMemberRequest(groupId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      toast.success("Member removed");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => deleteExpenseRequest(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
      queryClient.invalidateQueries({ queryKey: ["activity", groupId] });
      toast.success("Expense deleted");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  if (groupQuery.isLoading) return <Spinner />;
  if (groupQuery.error) return <ErrorBanner message={getApiErrorMessage(groupQuery.error)} />;
  const group = groupQuery.data!;

  const myBalance = balancesQuery.data?.balances.find((b) => b.userId === user?.id)?.netBalance ?? "0.00";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          <p className="text-sm text-gray-400">{group.members.length} members</p>
        </div>
        <div className="flex items-center gap-3">
          <BalancePill amount={myBalance} />
          <Link
            to={`/groups/${groupId}/expenses/new`}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Add expense
          </Link>
          <Link
            to={`/groups/${groupId}/settlements/new`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Record settlement
          </Link>
        </div>
      </header>

      {/* Members */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Members</h2>
        <ul className="mb-4 divide-y">
          {group.members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-700">
                {m.username} {m.userId === group.createdBy && <span className="text-xs text-gray-400">(creator)</span>}
              </span>
              {(m.userId === user?.id || user?.id === group.createdBy) && (
                <button
                  onClick={() => removeMemberMutation.mutate(m.userId)}
                  className="text-xs text-red-500 hover:underline"
                >
                  {m.userId === user?.id ? "Leave" : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addMemberMutation.mutate(memberInput);
          }}
          className="flex gap-2"
        >
          <input
            value={memberInput}
            onChange={(e) => setMemberInput(e.target.value)}
            placeholder="Username or email"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Invite
          </button>
        </form>
        {memberError && (
          <div className="mt-2">
            <ErrorBanner message={memberError} />
          </div>
        )}
      </section>

      {/* Balances & simplified debts */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Balances</h2>
          {balancesQuery.isLoading ? (
            <Spinner />
          ) : (
            <ul className="space-y-2 text-sm">
              {balancesQuery.data?.balances.map((b) => (
                <li key={b.userId} className="flex items-center justify-between">
                  <span className="text-gray-700">{b.username}</span>
                  <BalancePill amount={b.netBalance} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Who owes whom</h2>
          {balancesQuery.isLoading ? (
            <Spinner />
          ) : balancesQuery.data?.simplifiedDebts.length === 0 ? (
            <EmptyState message="Everyone is settled up." />
          ) : (
            <ul className="space-y-2 text-sm">
              {balancesQuery.data?.simplifiedDebts.map((d, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-gray-700">
                    {d.fromUsername} → {d.toUsername}
                  </span>
                  <span className="font-semibold text-gray-900">{formatCurrency(d.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Expenses */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Expenses</h2>
        {expensesQuery.isLoading ? (
          <Spinner />
        ) : expensesQuery.data?.length === 0 ? (
          <EmptyState message="No expenses yet." />
        ) : (
          <ul className="divide-y">
            {expensesQuery.data?.map((e) => {
              const payer = group.members.find((m) => m.userId === e.paidByUserId);
              return (
                <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{e.description}</p>
                    <p className="text-gray-400">
                      Paid by {payer?.username ?? "someone"} · {new Date(e.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{formatCurrency(e.totalAmount)}</span>
                    <Link to={`/expenses/${e.id}/edit`} className="text-xs text-brand-600 hover:underline">
                      Edit
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${e.description}"?`)) deleteExpenseMutation.mutate(e.id);
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Settlements */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Settlements</h2>
        {settlementsQuery.isLoading ? (
          <Spinner />
        ) : settlementsQuery.data?.length === 0 ? (
          <EmptyState message="No settlements recorded yet." />
        ) : (
          <ul className="divide-y">
            {settlementsQuery.data?.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-gray-700">
                  {s.paidByUsername} paid {s.paidToUsername}
                </span>
                <span className="font-semibold text-gray-900">{formatCurrency(s.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent activity */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent activity</h2>
          <Link to={`/groups/${groupId}/activity`} className="text-sm text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        {activityQuery.isLoading ? (
          <Spinner />
        ) : activityQuery.data?.length === 0 ? (
          <EmptyState message="No activity yet." />
        ) : (
          <ul className="divide-y text-sm">
            {activityQuery.data?.map((a) => (
              <li key={a.id} className="py-2 text-gray-600">
                <span className="font-medium text-gray-800">{a.actorUsername}</span>{" "}
                {describeActivity(a.eventType)} · {new Date(a.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function describeActivity(eventType: string): string {
  switch (eventType) {
    case "EXPENSE_CREATED":
      return "added an expense";
    case "EXPENSE_EDITED":
      return "edited an expense";
    case "EXPENSE_DELETED":
      return "deleted an expense";
    case "SETTLEMENT_RECORDED":
      return "recorded a settlement";
    case "MEMBER_JOINED":
      return "joined the group";
    case "MEMBER_LEFT":
      return "left the group";
    case "GROUP_CREATED":
      return "created the group";
    default:
      return eventType;
  }
}
