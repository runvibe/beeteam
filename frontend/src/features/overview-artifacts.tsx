import { useLocale, t as tr } from "@/i18n";

import { RelativeTime } from "@/components/relative-time";
import { useState } from "react";
import { Download, ExternalLink, UserRound } from "lucide-react";
import { useApi } from "@/api/context";
import type { TaskOverviewData, OverviewActor } from "@/api/task-overview";
import { AgentName } from "@/components/names";
import { Button } from "@/components/ui/button";
import { Failure, formatDate, safeUrl } from "@/components/shared";

export function OverviewAttribution({
  actor,
  date,
  relative = false,
  showActorIcon = false,
}: {
  actor: OverviewActor;
  date: string;
  relative?: boolean;
  showActorIcon?: boolean;
}) {
  useLocale();
  return (
    <p className="small-note">
      {showActorIcon && (
        <UserRound className="summary-author-icon" aria-hidden="true" />
      )}
      {showActorIcon && actor.actorKind === "agent" && (
        <span className="sr-only">{tr("common.agent")} </span>
      )}
      {actor.actorKind === "human" ? (
        tr("common.personIdentityNotProvided")
      ) : actor.actorId ? (
        <AgentName id={actor.actorId} />
      ) : (
        tr("common.unidentifiedAgent")
      )}{" "}
      ·{" "}
      {relative ? (
        <RelativeTime value={date} />
      ) : (
        <time dateTime={date}>{formatDate(date)}</time>
      )}
    </p>
  );
}
export function OverviewArtifacts({
  data,
  onTab,
}: {
  data: TaskOverviewData;
  onTab: (tab: string) => void;
}) {
  useLocale();
  const api = useApi();
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<unknown>(null);
  async function download(id: string, name: string) {
    setBusy(id);
    setError(null);
    try {
      const blob = await api.download(data.task.id, id),
        url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="overview-artifacts">
      <h2>{tr("common.recentDeliverablesAndFiles")}</h2>
      {!!data.latestDeliverables.items.length && (
        <ul className="overview-feed">
          {data.latestDeliverables.items.slice(0, 5).map((item, index) => (
            <li key={`${item.summaryId}-${index}`}>
              <div>
                {safeUrl(item.deliverable.url) ? (
                  <a
                    className="overview-artifact-link"
                    href={safeUrl(item.deliverable.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.deliverable.label}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                ) : (
                  <span>{item.deliverable.label}</span>
                )}
                {item.deliverable.attachmentId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!busy}
                    onClick={() =>
                      void download(
                        item.deliverable.attachmentId!,
                        item.deliverable.label,
                      )
                    }
                    aria-label={tr("tasks.downloadDeliverable", {
                      label: item.deliverable.label,
                    })}
                  >
                    <Download size={14} />
                    {tr("common.download")}
                  </Button>
                )}
              </div>
              <OverviewAttribution actor={item} date={item.createdAt} />
            </li>
          ))}
        </ul>
      )}
      {!!data.latestAttachments.items.length && (
        <ul className="overview-feed">
          {data.latestAttachments.items.slice(0, 5).map((item) => (
            <li key={item.id}>
              <Button
                variant="link"
                disabled={!!busy}
                className="overview-file-link"
                onClick={() => void download(item.id, item.originalName)}
              >
                <Download size={14} aria-hidden="true" />
                {item.originalName}
              </Button>
              <OverviewAttribution actor={item} date={item.createdAt} />
            </li>
          ))}
        </ul>
      )}
      {!data.latestDeliverables.total && !data.latestAttachments.total && (
        <p className="small-note">
          {tr("common.noDeliverablesOrFilesRecorded")}
        </p>
      )}
      {(data.latestDeliverables.total > 5 ||
        data.latestAttachments.total > 5) && (
        <p className="small-note">
          {tr("common.upTo5MostRecentDeliverablesAnd5Files")}
        </p>
      )}
      <div className="overview-feed-actions">
        <Button variant="ghost" size="sm" onClick={() => onTab("summaries")}>
          {tr("common.viewDeliverablesInSummaries")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onTab("attachments")}>
          {tr("tasks.viewFileCount", { count: data.latestAttachments.total })}
        </Button>
      </div>
      {error != null && <Failure error={error} />}
    </section>
  );
}

const eventNames: Record<string, string> = {
  get "task.created"() {
    return tr("common.taskCreated");
  },
  get "task.updated"() {
    return tr("common.taskUpdated");
  },
  get "assignment.changed"() {
    return tr("common.assigneeChanged");
  },
  get "block.changed"() {
    return tr("common.blockUpdated");
  },
  get "plan.created"() {
    return tr("common.planRecorded");
  },
  get "plan.revised"() {
    return tr("common.planRevised");
  },
  get "comment.created"() {
    return tr("common.commentRecorded");
  },
  get "attachment.added"() {
    return tr("common.fileAttached");
  },
  get "attachment.removed"() {
    return tr("common.fileSoftDeleted");
  },
  get "execution.recorded"() {
    return tr("common.executionRecorded");
  },
  get "task.archived"() {
    return tr("common.taskArchived");
  },
  get "task.restored"() {
    return tr("common.taskRestored");
  },
  get "subtask.created"() {
    return tr("common.subtaskCreated");
  },
  get "position.changed"() {
    return tr("common.positionChanged");
  },
};
export function OverviewActivity({
  data,
  onTab,
}: {
  data: TaskOverviewData;
  onTab: (tab: string) => void;
}) {
  useLocale();
  return (
    <section>
      <h2>{tr("common.recentActivity")}</h2>
      {data.recentEvents.items.length ? (
        <ol className="overview-feed">
          {data.recentEvents.items.slice(0, 5).map((event) => (
            <li key={event.id}>
              <span>{eventNames[event.type] || event.type}</span>
              <OverviewAttribution actor={event} date={event.occurredAt} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="small-note">{tr("common.noActivityRecorded")}</p>
      )}
      <Button variant="ghost" size="sm" onClick={() => onTab("timeline")}>
        {tr("tasks.viewTimelineCount", { count: data.recentEvents.total })}
      </Button>
    </section>
  );
}
