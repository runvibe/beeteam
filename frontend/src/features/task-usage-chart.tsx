import { formatNumber, useLocale, t as tr } from "@/i18n";

import { RecordedSummary } from "./recorded-summary";
import { SessionSnapshots } from "./session-snapshots";
import { UsageCheckpointPoint } from "./usage-checkpoint-point";
import { useId, useState, useRef, useLayoutEffect } from "react";
import type { SummaryUsageTimelineItem } from "@/api/generated/kanban/SummaryUsageTimelineItem";
import { formatDate } from "@/components/shared";
import { OverviewAttribution } from "./overview-artifacts";
import { SummaryUsage, tokenCount } from "./summary-usage";
import "./task-usage-chart.css";

export function UsageCheckpointChart({
  items,
  taskId,
}: {
  items: SummaryUsageTimelineItem[];
  taskId: string;
}) {
  useLocale();
  const id = useId();
  const host = useRef<HTMLElement>(null);
  const [availableWidth, setAvailableWidth] = useState(480);
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => setAvailableWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [items.length]);
  const [selectedId, setSelected] = useState<string>();
  const points = [...items].sort(
    (a, b) =>
      Date.parse(a.reportedAt) - Date.parse(b.reportedAt) ||
      a.summaryId.localeCompare(b.summaryId),
  );
  const selected =
    points.find((p) => p.summaryId === selectedId) ?? points.at(-1);
  const values = points.map(
    (p) => p.recordedSessionUsage?.measuredTotalTokens ?? null,
  );
  const maxValue = values.reduce(
    (max, value) =>
      value !== null && BigInt(value) > max ? BigInt(value) : max,
    0n,
  );
  const times = points.map((p) => Date.parse(p.reportedAt));
  const minTime = Math.min(...times),
    maxTime = Math.max(...times);
  const width = Math.max(480, availableWidth, points.length * 44);
  const positions = points.map((_, index) => ({
    x:
      maxTime === minTime
        ? width / 2
        : 50 + ((times[index] - minTime) / (maxTime - minTime)) * (width - 100),
    y:
      values[index] === null
        ? 215
        : 175 -
          (maxValue === 0n
            ? 0
            : Number((BigInt(values[index]!) * 10000n) / maxValue) / 10000) *
            130,
  }));
  const session = selected?.recordedSessionUsage;
  const hasValues = values.some((value) => value !== null);
  return (
    <section ref={host} className="usage-chart" aria-labelledby={id}>
      <h3 id={id}>{tr("usage.summariesOverTime")}</h3>
      <p className="small-note">
        {tr("usage.onePointPerSummaryAtTheTimeItWasRecorded")}
      </p>
      {points.length > 0 &&
        points.every((point) => !point.recordedSessionUsage) && (
          <p className="small-note">
            {tr("usage.sessionDeltaPerSummaryIsNotAvailableInThisResponse")}
          </p>
        )}
      <div
        className="usage-chart-scroll"
        role="group"
        aria-label={tr("usage.summaryPointsSelectToInspect")}
      >
        <div className="usage-chart-plot" style={{ width }}>
          <svg viewBox={`0 0 ${width} 270`} aria-hidden="true">
            {[45, 175].map((y) => (
              <line
                key={y}
                x1="50"
                x2={width - 50}
                y1={y}
                y2={y}
                className="overview-gridline"
              />
            ))}
            <text x="8" y="28">
              {hasValues
                ? tokenCount(maxValue.toString())
                : tr("usage.tokensTitle")}
            </text>
            {hasValues && (
              <text x="8" y="179">
                0
              </text>
            )}
            <text x="8" y="240">
              {tr("usage.noDelta")}
            </text>
            {positions.map((p, i) =>
              i > 0 && values[i] !== null && values[i - 1] !== null ? (
                <line
                  key={points[i].summaryId}
                  x1={positions[i - 1].x}
                  y1={positions[i - 1].y}
                  x2={p.x}
                  y2={p.y}
                  className="overview-progress-line"
                />
              ) : null,
            )}
            <text x="50" y="264">
              {points.length
                ? formatDate(points[0].reportedAt)
                : tr("usage.summaryTime")}
            </text>
            {points.length > 1 && (
              <text x={width - 50} y="264" textAnchor="end">
                {formatDate(points.at(-1)!.reportedAt)}
              </text>
            )}
          </svg>
          {!points.length && (
            <p className="usage-chart-empty">
              {tr("usage.noSummariesAvailable")}
            </p>
          )}
          {points.map((point, i) => (
            <UsageCheckpointPoint
              key={point.summaryId}
              point={point}
              position={positions[i]}
              selected={selected?.summaryId === point.summaryId}
              detailId={`${id}-detail`}
              onSelect={() => setSelected(point.summaryId)}
            />
          ))}
        </div>
      </div>
      {selected && (
        <>
          <label className="usage-chart-selection">
            {tr("execution.checkpoint")}
            <select
              aria-label={tr("execution.checkpoint")}
              value={selected.summaryId}
              onChange={(e) => setSelected(e.target.value)}
            >
              {points.map((p, i) => (
                <option key={p.summaryId} value={p.summaryId}>
                  {formatNumber(i + 1)}. {formatDate(p.reportedAt)} ·{" "}
                  {tokenCount(
                    p.recordedSessionUsage?.measuredTotalTokens ?? null,
                  )}
                </option>
              ))}
            </select>
          </label>
          <div
            id={`${id}-detail`}
            className="usage-chart-detail"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="small-note">{tr("execution.summaryAuthor")}</span>
            <OverviewAttribution
              actor={selected.reportingActor}
              date={selected.reportedAt}
            />
            <p>
              {tr("execution.statusWhenTheSummaryWasRecorded")}{" "}
              {selected.statusObserved?.name ?? tr("execution.notRecorded")}
            </p>
            <p>
              {tr("usage.measuredDelta")}{" "}
              {tokenCount(session?.measuredTotalTokens ?? null)}{" "}
              {tr("usage.estimated2")}{" "}
              {tokenCount(session?.estimatedTotalTokens ?? null)}{" "}
              {tr("usage.tokens")}
            </p>
            {!!session?.coverage.baselineEntries && (
              <p className="small-note">
                {tr(
                  "usage.initialReferencePresentInformationalSnapshotExcludedFromDelta",
                )}
              </p>
            )}
            <SessionSnapshots report={selected.usageReport} />
            <p className="small-note">
              {tr("usage.historicalTaskExecutorNotRecorded")}
            </p>
            {[
              ...new Set(
                selected.usageReport?.entries.map(
                  (entry) =>
                    `${entry.observation.modelId || tr("tasks.modelNotProvided")} · ${entry.observation.harness || tr("usage.harnessNotProvided")}`,
                ) ?? [],
              ),
            ].map((label) => (
              <p key={label} className="small-note">
                {label}
              </p>
            ))}
          </div>
          <details>
            <summary>{tr("usage.evidenceForThisCheckpoint")}</summary>
            <SummaryUsage report={selected.usageReport} />
          </details>
          <RecordedSummary
            key={selected.summaryId}
            taskId={taskId}
            summaryId={selected.summaryId}
            reportedAt={selected.reportedAt}
          />
        </>
      )}
    </section>
  );
}
