import {
  formatNumber,
  LocalizedError,
  message,
  useLocale,
  t as tr,
} from "@/i18n";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TaskExecutionInterval } from "@/api/generated/kanban/TaskExecutionInterval";
import { useApi } from "@/api/context";
import { Button } from "@/components/ui/button";
import { Failure } from "@/components/shared";
import { ExecutionPages } from "./execution-pages";
import { ExecutionIntervalDetail } from "./execution-interval-detail";
import { OverviewAttribution } from "./overview-artifacts";
export function ExecutionIntervalRecord({
  interval,
}: {
  interval: TaskExecutionInterval;
}) {
  useLocale();
  const api = useApi();
  const [revisions, setRevisions] = useState(false);
  return (
    <article className="execution-interval-record">
      <ExecutionIntervalDetail interval={interval} />
      <Button
        variant="outline"
        aria-expanded={revisions}
        onClick={() => setRevisions(!revisions)}
      >
        {tr("usage.revisionHistory")}
      </Button>
      {revisions && (
        <ExecutionPages
          queryKey={[
            "execution-interval-revisions",
            interval.taskId,
            interval.id,
            interval.version,
          ]}
          fetchPage={(offset, signal) =>
            api.executionIntervalRevisions(
              interval.taskId,
              interval.id,
              { offset, limit: 20 },
              signal,
            )
          }
          label={tr("usage.revisions")}
          countLabel={(count) => tr("usage.revisionNoun", { count })}
        >
          {(rows, loading, failed) => (
            <>
              {!loading && !failed && !rows.length && (
                <p>{tr("usage.noPreviousRevisionsRecorded")}</p>
              )}
              {rows.map((row) => (
                <details key={row.id}>
                  <summary>
                    {tr("usage.previousRevision")} {formatNumber(row.revision)}{" "}
                    · {row.reason}
                  </summary>
                  <OverviewAttribution
                    actor={row.reportingActor}
                    date={row.createdAt}
                  />
                  <ExecutionIntervalDetail interval={row.interval} />
                </details>
              ))}
            </>
          )}
        </ExecutionPages>
      )}
    </article>
  );
}
export function ExecutionIntervalLookup({
  taskId,
  intervalId,
  version,
}: {
  taskId: string;
  intervalId: string;
  version: number;
}) {
  useLocale();
  const host = useRef<HTMLElement>(null);
  useEffect(() => {
    host.current?.focus();
    host.current?.scrollIntoView?.({ block: "start" });
  }, [intervalId]);
  const api = useApi();
  const q = useQuery({
    queryKey: ["execution-interval-by-id", taskId, intervalId, version],
    queryFn: async ({ signal }) => {
      let offset = 0;
      for (;;) {
        const page = await api.executionIntervals(
          taskId,
          { offset, limit: 100 },
          signal,
        );
        const match = page.items.find((row) => row.id === intervalId);
        if (match) return match;
        if (
          !page.hasMore ||
          page.nextOffset === null ||
          page.nextOffset <= offset
        )
          break;
        offset = page.nextOffset;
      }
      throw new LocalizedError(
        message("usage.referencedIntervalNotFoundInTheAvailableRecords"),
      );
    },
  });
  return (
    <section ref={host} tabIndex={-1} aria-label={tr("usage.selectedInterval")}>
      {q.isPending && <p role="status">{tr("usage.loadingInterval")}</p>}
      {q.error && <Failure error={q.error} retry={() => void q.refetch()} />}
      {q.data && <ExecutionIntervalRecord interval={q.data} />}
    </section>
  );
}
