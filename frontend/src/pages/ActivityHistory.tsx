import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchActivity } from "../api/misc";
import { fetchGroup } from "../api/groups";
import { Spinner, EmptyState, ErrorBanner } from "../components/Common";
import { getApiErrorMessage } from "../api/client";

export default function ActivityHistory() {
  const { groupId } = useParams<{ groupId: string }>();
  const groupQuery = useQuery({ queryKey: ["group", groupId], queryFn: () => fetchGroup(groupId!) });
  const activityQuery = useQuery({
    queryKey: ["activity-full", groupId],
    queryFn: () => fetchActivity(groupId!, 100),
  });

  if (groupQuery.isLoading || activityQuery.isLoading) return <Spinner />;
  if (groupQuery.error) return <ErrorBanner message={getApiErrorMessage(groupQuery.error)} />;
  if (activityQuery.error) return <ErrorBanner message={getApiErrorMessage(activityQuery.error)} />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Activity — {groupQuery.data?.name}</h1>
      {activityQuery.data?.length === 0 ? (
        <EmptyState message="No activity yet." />
      ) : (
        <div className="divide-y rounded-xl bg-white shadow-sm">
          {activityQuery.data?.map((a) => (
            <div key={a.id} className="px-5 py-3 text-sm">
              <p className="text-gray-800">
                <span className="font-medium">{a.actorUsername}</span> · {a.eventType.replace(/_/g, " ").toLowerCase()}
              </p>
              <p className="text-gray-400">{new Date(a.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
