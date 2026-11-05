import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { useLocation, currentUrl, demoHref } from "@/routing/location";
import { eventLabels } from "./timeline-labels";
import { useLocale, t as tr } from "@/i18n";
import { RelativeTime } from "@/components/relative-time";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Failure } from "@/components/shared";
import { openCardLink } from "@/routing/card-navigation";

type ActivityPresentation = {
  label: string;
  occurredAt: string;
  taskTitle: string;
  href: string;
};
export function AgentLatestActivityView({
  activity,
  pending,
  error,
  retry,
}: {
  activity: ActivityPresentation | null;
  pending: boolean;
  error: unknown;
  retry: () => void;
}) {
  useLocale();
  return (
    <section aria-label={tr("agents.latestActivity")}>
      <h3>{tr("agents.latestActivity")}</h3>
      {pending ? (
        <LoadingIndicator compact />
      ) : error ? (
        <Failure error={error} retry={retry} />
      ) : activity ? (
        <div className="space-y-1">
          <p className="small-note">
            {activity.label} · <RelativeTime value={activity.occurredAt} />
          </p>
          <a
            href={demoHref(activity.href)}
            onClick={openCardLink}
            className="break-words"
          >
            {activity.taskTitle}
          </a>
        </div>
      ) : (
        <p className="small-note">{tr("agents.noRecordedActivity")}</p>
      )}
    </section>
  );
}

export function AgentLatestActivity({ agentId }: { agentId: string }) {
  useLocale();
  useLocation();
  const api = useApi();
  const query = useQuery({
    queryKey: ["agents", agentId, "latest-activity"],
    queryFn: ({ signal }) => api.agentLatestActivity(agentId, signal),
  });
  const activity = query.data?.activity;
  const params = activity
    ? new URLSearchParams({
        tab: "timeline",
        "timeline.selected": activity.eventId,
        from: currentUrl(),
      })
    : null;
  return (
    <AgentLatestActivityView
      pending={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
      activity={
        activity
          ? {
              label: eventLabels[activity.type] ?? activity.type,
              occurredAt: activity.occurredAt,
              taskTitle: activity.taskTitle,
              href: `/tasks/${encodeURIComponent(activity.taskSlug)}?${params}`,
            }
          : null
      }
    />
  );
}
