import { useLocale, t as tr } from "@/i18n";

import { ChartPointPopover } from "./chart-point-popover";
import { SessionSnapshots } from "./session-snapshots";
import type { SummaryUsageTimelineItem } from "@/api/generated/kanban/SummaryUsageTimelineItem";
import { OverviewAttribution } from "./overview-artifacts";
import { tokenCount } from "./summary-usage";
import { formatDate } from "@/components/shared";

export function UsageCheckpointPoint({
  point,
  position,
  selected,
  detailId,
  onSelect,
}: {
  point: SummaryUsageTimelineItem;
  position: { x: number; y: number };
  selected: boolean;
  detailId: string;
  onSelect: () => void;
}) {
  useLocale();
  const usage = point.recordedSessionUsage;
  const measured = usage?.measuredTotalTokens;
  return (
    <ChartPointPopover
      pointId={point.summaryId}
      position={position}
      selected={selected}
      detailId={detailId}
      onSelect={onSelect}
      className="usage-chart-point"
      missing={measured == null}
      label={tr("usage.checkpointDescription", {
        date: formatDate(point.reportedAt),
        delta:
          measured == null
            ? tr("usage.noMeasuredDelta")
            : tokenCount(measured) + tr("usage.tokens2"),
        status: point.statusObserved?.name ?? tr("tasks.notRecorded"),
      })}
      dialogLabel={tr("usage.summaryDetailsAtThisPoint")}
    >
      <strong>{tr("usage.recordedSummary")}</strong>
      <span className="small-note">{tr("tasks.author")}</span>
      <OverviewAttribution
        actor={point.reportingActor}
        date={point.reportedAt}
      />
      <p>
        {tr("execution.statusWhenTheSummaryWasRecorded")}{" "}
        {point.statusObserved?.name ?? tr("execution.notRecorded")}
      </p>
      <p>
        {tr("usage.measuredSessionDelta")} {tokenCount(measured)}{" "}
        {tr("usage.tokens")}
      </p>
      <p>
        {tr("usage.estimatedSessionDelta")}{" "}
        {tokenCount(usage?.estimatedTotalTokens)} {tr("usage.tokens")}
      </p>
      {!!usage?.coverage.baselineEntries && (
        <p className="small-note">
          {tr("usage.initialReferenceSnapshotNotAddedToDelta")}
        </p>
      )}
      <SessionSnapshots report={point.usageReport} />
    </ChartPointPopover>
  );
}
