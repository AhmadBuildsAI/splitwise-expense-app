import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchDashboard } from "../api/misc";
import { Spinner, EmptyState, ErrorBanner, BalancePill } from "../components/Common";
import { formatCurrency } from "../utils/currency";
import { getApiErrorMessage } from "../api/client";

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner message={getApiErrorMessage(error)} />;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">You are owed</p>
          <p className="mt-1 text-2xl font-bold text-brand-600">
            {formatCurrency(data.summary.totalOwedToUser)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">You owe</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {formatCurrency(data.summary.totalUserOwes)}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Your groups</h2>
          <Link to="/groups/new" className="text-sm font-medium text-brand-600 hover:underline">
            + New group
          </Link>
        </div>
        {data.groups.length === 0 ? (
          <EmptyState message="You're not in any groups yet. Create one to get started." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.groups.map((g) => (
              <Link
                key={g.id}
                to={`/groups/${g.id}`}
                className="rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <p className="font-semibold text-gray-900">{g.name}</p>
                <p className="mb-3 text-sm text-gray-400">
                  {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                </p>
                <BalancePill amount={g.yourBalance} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Recent activity</h2>
        {data.recentActivity.length === 0 ? (
          <EmptyState message="No recent activity." />
        ) : (
          <div className="divide-y rounded-xl bg-white shadow-sm">
            {data.recentActivity.map((a) => (
              <div key={`${a.type}-${a.id}`} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{a.description}</p>
                  <p className="text-gray-400">
                    {a.groupName} · {new Date(a.date).toLocaleDateString()}
                  </p>
                </div>
                <p className="font-semibold text-gray-700">{formatCurrency(a.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
