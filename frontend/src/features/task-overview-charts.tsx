import {
  formatPercent,
  formatNumber,
  locale,
  useLocale,
  t as tr,
} from "@/i18n";

import { SubtaskStatusPie } from "./subtask-status-pie";
import { currentUrl, navigate } from "@/routing/location";
import { ChartPointPopover } from "./chart-point-popover";
import { OverviewAttribution } from "./overview-artifacts";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Filters } from "@/api/types";
import type { TaskOverviewData } from "@/api/task-overview";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/components/shared";

const chartColor = (index: number) => `var(--chart-${(index % 5) + 1})`;
export function SubtaskCharts({
  data,
  onFilter,
}: {
  data: TaskOverviewData["directSubtasks"];
  onFilter: (filter: Filters) => void;
}) {
  useLocale();
  const multipleBoards =
    new Set(data.byStatus.map((status) => status.boardId)).size > 1;
  return (
    <>
      <section
        className="overview-chart"
        aria-label={tr("tasks.subtasksByStatus")}
      >
        <h2>{tr("tasks.subtasksByStatus")}</h2>
        <p className="small-note">
          {tr("tasks.directChildren")}
          {data.archivedIncluded ? tr("tasks.includingArchived") : ""} ·{" "}
          {formatNumber(data.total)} {tr("common.inTotal")}
        </p>
        <SubtaskStatusPie
          data={data}
          onSelect={(statusId) => onFilter({ statusId })}
        />
        {!data.total ? (
          <>
            <p className="small-note">{tr("tasks.noDirectSubtasksRecorded")}</p>
          </>
        ) : (
          <>
            <ul className="overview-legend">
              {data.byStatus.map((status, index) => (
                <li key={status.statusId}>
                  <Button
                    variant="ghost"
                    className="overview-legend-button"
                    onClick={() => onFilter({ statusId: status.statusId })}
                    aria-label={tr("tasks.subtaskStatusCount", {
                      status: status.statusName,
                      board: multipleBoards
                        ? ` (${status.boardName || status.boardId})`
                        : "",
                      count: status.total,
                    })}
                    title={
                      status.boardName ||
                      tr("tasks.namedBoard", { id: status.boardId })
                    }
                  >
                    <span
                      className="overview-swatch"
                      style={{ background: chartColor(index) }}
                      aria-hidden="true"
                    />
                    <span>
                      {status.statusName}
                      {multipleBoards && (
                        <small className="overview-status-board">
                          {status.boardName || status.boardId}
                        </small>
                      )}
                    </span>
                    <strong>
                      {formatNumber(status.total)} ·{" "}
                      {((status.total / data.total) * 100).toLocaleString(
                        locale(),
                        { maximumFractionDigits: 1 },
                      )}
                      %
                    </strong>
                  </Button>
                </li>
              ))}
            </ul>
            <p className="small-note">
              {tr("tasks.completionCounts", {
                completed: tr("tasks.doneCount", { count: data.done }),
                remaining: tr("tasks.remainingCount", {
                  count: data.remaining,
                }),
              })}
            </p>
            {data.blocked > 0 && (
              <div className="overview-blocked-count">
                <Button
                  variant="outline"
                  onClick={() => onFilter({ blocked: true })}
                >
                  {tr("tasks.blockedCount", { count: data.blocked })}
                </Button>
                <p className="small-note">
                  {tr(
                    "tasks.blockedSubtasksAreAlreadyIncludedInTheStatusesAbove",
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </section>
      <section
        className="overview-chart"
        aria-label={tr("tasks.subtasksByAssignee")}
      >
        <h2>{tr("tasks.distributionByAssignee")}</h2>
        <p className="small-note">
          {tr(
            "tasks.countOfDirectSubtasksDoesNotRepresentProductivityOrEstimated",
          )}
        </p>
        {!data.byExecutor.length ? (
          <>
            <div
              className="overview-assignee-bar overview-empty-track"
              aria-hidden="true"
            />
            <p className="small-note">{tr("tasks.noSubtasksToDistribute")}</p>
          </>
        ) : (
          <>
            <p className="overview-bar-key">
              <span>
                <i
                  className="overview-swatch overview-done"
                  aria-hidden="true"
                />
                {tr("tasks.completed3")}
              </span>
              <span>
                <i
                  className="overview-swatch overview-remaining"
                  aria-hidden="true"
                />
                {tr("tasks.remaining2")}
              </span>
            </p>
            <ul className="overview-assignees">
              {data.byExecutor.map((item) => (
                <li key={item.executorAgentId}>
                  <Button
                    variant="ghost"
                    className="overview-assignee-name"
                    onClick={() =>
                      onFilter({ executorAgentId: item.executorAgentId })
                    }
                  >
                    {item.agentName ||
                      tr("agents.unnamedAgent", { id: item.executorAgentId })}
                  </Button>
                  <div
                    className="overview-assignee-bar"
                    aria-hidden="true"
                    style={
                      {
                        width: `${(100 * item.total) / Math.max(...data.byExecutor.map((row) => row.total), 1)}%`,
                      } as CSSProperties
                    }
                  >
                    <span
                      className="overview-done"
                      style={{ flex: item.done }}
                    />
                    <span
                      className="overview-remaining"
                      style={{ flex: item.remaining }}
                    />
                  </div>
                  <p className="small-note">
                    {tr("tasks.assigneeCounts", {
                      completed: tr("tasks.doneCount", { count: item.done }),
                      remaining: tr("tasks.remainingCount", {
                        count: item.remaining,
                      }),
                      total: item.total,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

export function ProgressHistory({
  data,
  taskId,
  mode = "all",
}: {
  data: TaskOverviewData["progressHistory"];
  taskId?: string;
  mode?: "all" | "chart" | "table";
}) {
  useLocale();
  const title = useId(),
    description = useId();
  const points = data.items;
  const [selectedId, setSelected] = useState<string>();
  const selected =
    points.find((point) => point.eventId === selectedId) ?? points.at(-1);
  const chart = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);
  const hasPoints = points.length > 0;
  useLayoutEffect(() => {
    const node = chart.current;
    if (!node) return;
    const measure = () => {
      const measured = node.getBoundingClientRect().width;
      if (measured > 0) setWidth(Math.max(240, measured));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [hasPoints]);
  const times = points.map((point) => Date.parse(point.occurredAt));
  const min = Math.min(...times),
    max = Math.max(...times);
  const positions = points.map((point, index) => ({
    x:
      max === min
        ? width / 2
        : 40 + ((times[index] - min) / (max - min)) * (width - 72),
    y: 180 - point.percent * 1.5,
  }));
  return (
    <section
      className={`overview-chart overview-progress-history progress-mode-${mode}`}
    >
      {mode !== "table" && <h2>{tr("tasks.recordedProgressOverTime")}</h2>}
      {mode !== "table" && (
        <p className="small-note">
          {tr("tasks.explicitTaskRecordsIndependentOfSubtaskCompletion")}
        </p>
      )}
      {mode !== "table" && !points.length && (
        <p className="small-note">
          {tr(
            "tasks.noExplicitProgressHistoryAvailableTheCurrentPercentageCannotReconstruct",
          )}
        </p>
      )}
      <>
        <div className="overview-progress-layout">
          {mode !== "table" && (
            <div className="overview-progress-plot">
              <svg
                className="overview-progress-svg"
                ref={chart}
                viewBox={`0 0 ${width} 215`}
                role="img"
                aria-labelledby={`${title} ${description}`}
              >
                <title id={title}>
                  {tr("tasks.progressHistoryTitle", { count: points.length })}
                </title>
                <desc id={description}>
                  {tr("tasks.eachPointIsARecordedUpdateTheLineConnectsRecords")}
                </desc>
                {[0, 50, 100].map((value) => (
                  <g key={value}>
                    <line
                      x1="40"
                      x2={width - 32}
                      y1={180 - value * 1.5}
                      y2={180 - value * 1.5}
                      className="overview-gridline"
                    />
                    <text x="4" y={184 - value * 1.5}>
                      {formatNumber(value)}
                    </text>
                  </g>
                ))}
                {positions.length > 1 && (
                  <polyline
                    points={positions.map((p) => `${p.x},${p.y}`).join(" ")}
                    className="overview-progress-line"
                  />
                )}
                {positions.map((position, index) => (
                  <circle
                    key={points[index].eventId}
                    cx={position.x}
                    cy={position.y}
                    r="4"
                    className="overview-progress-point"
                  >
                    <title>
                      {formatDate(points[index].occurredAt)}:{" "}
                      {formatNumber(points[index].percent)}%
                    </title>
                  </circle>
                ))}
                <text x="40" y="208">
                  {points.length
                    ? new Date(points[0].occurredAt).toLocaleDateString(
                        locale(),
                      )
                    : tr("tasks.recordDate")}
                </text>
                {points.length > 1 && (
                  <text x={width - 32} y="208" textAnchor="end">
                    {new Date(points.at(-1)!.occurredAt).toLocaleDateString(
                      locale(),
                    )}
                  </text>
                )}
              </svg>
              {positions.map((position, index) => (
                <ChartPointPopover
                  key={points[index].eventId}
                  pointId={points[index].eventId}
                  showClose={false}
                  position={position}
                  hitWidth={Math.max(
                    1,
                    Math.min(
                      44,
                      index > 0
                        ? Math.abs(position.x - positions[index - 1].x)
                        : 44,
                      index < positions.length - 1
                        ? Math.abs(positions[index + 1].x - position.x)
                        : 44,
                    ),
                  )}
                  className="overview-progress-hit"
                  label={`${formatDate(points[index].occurredAt)}: ${points[index].percent}%`}
                  dialogLabel={tr("tasks.progressDetailsAtThisPoint")}
                  selected={selected?.eventId === points[index].eventId}
                  detailId={`${description}-detail`}
                  onSelect={() => setSelected(points[index].eventId)}
                >
                  <strong>
                    {tr("tasks.recordedProgress")}{" "}
                    {formatNumber(points[index].percent)}%
                  </strong>
                  <OverviewAttribution
                    actor={points[index]}
                    date={points[index].occurredAt}
                  />
                  {taskId && points[index].summaryId ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const [path, search] = currentUrl().split("?");
                        const query = new URLSearchParams(search);
                        query.set("tab", "summaries");
                        query.set(
                          "summaries.selected",
                          points[index].summaryId!,
                        );
                        navigate(`${path}?${query}`);
                      }}
                    >
                      {tr("tasks.viewSummary")}
                    </Button>
                  ) : (
                    <p>{tr("tasks.noLinkedSummary")}</p>
                  )}
                </ChartPointPopover>
              ))}
            </div>
          )}
          {mode !== "chart" && (
            <section
              className="overview-history-table"
              aria-label={tr("tasks.progressRecords")}
            >
              <h3>
                {data.truncated
                  ? tr("tasks.loadedRecords", {
                      shown: points.length,
                      count: data.total,
                    })
                  : tr("tasks.recordCount", { count: points.length })}
              </h3>
              <div
                className="overview-table-scroll"
                tabIndex={0}
                role="region"
                aria-label={tr("tasks.progressRecordsTable")}
              >
                <table>
                  <caption className="sr-only">
                    {tr("tasks.recordedProgressValues")}
                  </caption>
                  <thead>
                    <tr>
                      <th>{tr("tasks.date")}</th>
                      <th>{tr("tasks.progress")}</th>
                      <th>{tr("tasks.recordedNote")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!points.length && (
                      <tr>
                        <td colSpan={3}>{tr("tasks.noProgressRecords")}</td>
                      </tr>
                    )}
                    {points.map((point) => (
                      <tr key={point.eventId}>
                        <td>
                          <time dateTime={point.occurredAt}>
                            {formatDate(point.occurredAt)}
                          </time>
                        </td>
                        <td>
                          {point.summaryId ? (
                            <button
                              type="button"
                              className="underline"
                              onClick={() => {
                                const target = document.getElementById(
                                  `summaries-${point.summaryId}`,
                                );
                                if (target) {
                                  target.scrollIntoView({
                                    block: "center",
                                    behavior: "instant",
                                  });
                                  target.focus({ preventScroll: true });
                                }
                                const [path, search] = currentUrl().split("?");
                                const query = new URLSearchParams(search);
                                query.set("tab", "summaries");
                                query.set(
                                  "summaries.selected",
                                  point.summaryId!,
                                );
                                navigate(`${path}?${query}`);
                              }}
                              aria-label={tr("tasks.openProgressSummary", {
                                percent: point.percent,
                              })}
                            >
                              {formatNumber(point.percent)}%
                            </button>
                          ) : (
                            formatPercent(point.percent)
                          )}
                        </td>
                        <td>{point.note || tr("tasks.noNote")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </>
    </section>
  );
}
