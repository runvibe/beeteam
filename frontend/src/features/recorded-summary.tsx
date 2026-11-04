import { LocalizedError, message, useLocale, t as tr } from "@/i18n";

import { SummaryCommits } from "./summary-commits";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { Button } from "@/components/ui/button";
import { Failure, safeUrl } from "@/components/shared";
import { Markdown } from "@/components/markdown";
import { SummaryUsage } from "./summary-usage";
export function RecordedSummary({
  taskId,
  summaryId,
  expanded = false,
}: {
  taskId: string;
  summaryId: string;
  reportedAt?: string;
  expanded?: boolean;
}) {
  useLocale();
  const api = useApi();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["usage-checkpoint-summary", taskId, summaryId],
    enabled: open || expanded,
    queryFn: async ({ signal }) => {
      const page = await api.list(
        "summaries",
        taskId,
        {
          id: summaryId,
          limit: 1,
        },
        signal,
      );
      const match = page.items.find(
        (row) => row.id === summaryId && row.taskId === taskId,
      );
      if (match) return match;
      throw new LocalizedError(
        message("tasks.summaryNotFoundInTheAvailableRecords"),
      );
    },
  });
  return (
    <div>
      {!expanded && (
        <Button
          variant="outline"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? tr("tasks.closeSummary") : tr("tasks.openSummary")}
        </Button>
      )}
      {(open || expanded) && (
        <section aria-label={tr("tasks.selectedSummary")}>
          {query.isPending && <p role="status">{tr("tasks.loadingSummary")}</p>}
          {query.error && (
            <Failure error={query.error} retry={() => void query.refetch()} />
          )}
          {query.data && (
            <>
              <p className="small-note">
                {
                  {
                    progress: tr("tasks.updates"),
                    completed: tr("tasks.recordedDeliverable"),
                    blocked: tr("tasks.recordedImpediment"),
                  }[query.data.outcome]
                }
              </p>
              <Markdown headingOffset={2}>{query.data.summary}</Markdown>
              {!!query.data.deliverables.length && (
                <section aria-label={tr("tasks.summaryDeliverables")}>
                  <h4>{tr("tasks.deliverables")}</h4>
                  <ul>
                    {query.data.deliverables.map((item, index) => (
                      <li key={index}>
                        {safeUrl(item.url) ? (
                          <a
                            href={safeUrl(item.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.label}
                          </a>
                        ) : (
                          item.label
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {!!query.data.pending.length && (
                <section aria-label={tr("tasks.summaryPendingWork")}>
                  <h4>{tr("tasks.pendingWork")}</h4>
                  {query.data.pending.map((item, index) => (
                    <Markdown headingOffset={2} key={index}>
                      {item}
                    </Markdown>
                  ))}
                </section>
              )}
              <SummaryCommits report={query.data.commitReport} />
              <SummaryUsage report={query.data.usageReport} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
