import { useLocale, t as tr } from "@/i18n";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { Failure } from "@/components/shared";
import { SessionSnapshots } from "./session-snapshots";
import { tokenAmount } from "./usage-format";

/** Mounted only inside the open point popover; no timestamp matching or history preload. */
export function ProgressSummary({
  taskId,
  summaryId,
}: {
  taskId: string;
  summaryId: string;
}) {
  useLocale();
  const api = useApi();
  const query = useQuery({
    queryKey: ["summaries", taskId, { id: summaryId, limit: 1 }],
    queryFn: ({ signal }) =>
      api.list("summaries", taskId, { id: summaryId, limit: 1 }, signal),
  });
  if (query.isPending)
    return <p role="status">{tr("tasks.loadingLinkedSummary")}</p>;
  if (query.error)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  const summary = query.data.items.find(
    (item) => item.id === summaryId && item.taskId === taskId,
  );
  if (!summary) return <p>{tr("tasks.linkedSummaryUnavailable")}</p>;
  const report = summary.usageReport;
  const status = summary.statusObserved ?? report?.statusObserved;
  return (
    <>
      <p>
        {tr("tasks.statusWhenRecorded")}{" "}
        {status?.name ?? tr("tasks.notRecorded")}
      </p>
      {!report?.entries.length ? (
        <p>{tr("tasks.metricsNotProvidedInThisSummaryAbsenceDoesNotMean")}</p>
      ) : (
        <>
          <SessionSnapshots report={report} />
          {report.entries.map((entry) => (
            <div key={entry.id}>
              <p>
                {entry.observation.modelId || tr("tasks.modelNotProvided")} ·{" "}
                {entry.observation.harness}
              </p>
              <p>
                {tr("tasks.recordedDelta")}
                {entry.observation.quality === "measured"
                  ? tr("usage.measuredLower")
                  : entry.observation.quality === "estimated"
                    ? tr("usage.estimatedLower")
                    : tr("tasks.unavailable")}
                ): {tokenAmount(entry.delta?.totalTokens)}
              </p>
              <p className="small-note">
                {entry.counted
                  ? tr("tasks.includedInTheAttributedTotalAsReported")
                  : tr("tasks.notIncludedInTheTaskAttributedTotal")}
              </p>
            </div>
          ))}
        </>
      )}
    </>
  );
}
