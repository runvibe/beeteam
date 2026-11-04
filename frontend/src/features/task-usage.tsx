import { formatNumber, useLocale, t as tr } from "@/i18n";

import { UsageCheckpointChart } from "./task-usage-chart";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useApi } from "@/api/context";
import type { TaskUsage } from "@/api/generated/kanban/TaskUsage";
import type { UsageDimensionPage } from "@/api/generated/kanban/UsageDimensionPage";
import { Button } from "@/components/ui/button";
import { Failure } from "@/components/shared";
import { OverviewAttribution } from "./overview-artifacts";
import { SummaryUsage, tokenCount, TokenComponents } from "./summary-usage";

type UsagePage<T> = {
  items: T[];
  offset: number;
  limit: number;
  total: number;
  truncated: boolean;
};
function PagedUsage<T>({
  initial,
  queryKey,
  fetchPage,
  renderItem,
  label,
  countLabel,
  itemKey,
  overview,
  detailsLabel,
}: {
  initial: UsagePage<T>;
  queryKey: (string | number)[];
  fetchPage: (offset: number, signal: AbortSignal) => Promise<UsagePage<T>>;
  renderItem: (item: T) => ReactNode;
  label: string;
  countLabel: (count: number) => string;
  itemKey: (item: T) => string;
  overview?: (items: T[]) => ReactNode;
  detailsLabel?: string;
}) {
  useLocale();
  const q = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    initialData: { pages: [initial], pageParams: [0] },
    getNextPageParam: (page) =>
      page.truncated && page.items.length
        ? page.offset + page.items.length
        : undefined,
  });
  const rows = [
    ...new Map(
      q.data.pages
        .flatMap((page) => page.items)
        .map((item) => [itemKey(item), item]),
    ).values(),
  ];
  const list = (
    <ul className="usage-checkpoints">
      {rows.map((item) => (
        <li key={itemKey(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
  return (
    <div className="usage-page">
      <p className="small-note">
        {tr("common.loadedCollection", {
          shown: rows.length,
          total: q.data.pages[0].total,
          label: countLabel(q.data.pages[0].total),
        })}
      </p>
      {overview && q.hasNextPage && (
        <p className="small-note">
          {tr(
            "usage.partialHistoryTheChartOnlyShowsLoadedCheckpointsTotalsAbove",
          )}
        </p>
      )}
      {overview?.(rows)}
      {detailsLabel ? (
        <details>
          <summary>{detailsLabel}</summary>
          {list}
        </details>
      ) : (
        list
      )}
      {q.error && (
        <Failure
          error={q.error}
          retry={() =>
            void (q.isFetchNextPageError ? q.fetchNextPage() : q.refetch())
          }
        />
      )}
      {q.hasNextPage && (
        <Button
          variant="outline"
          disabled={q.isFetching}
          onClick={() => void q.fetchNextPage()}
        >
          {q.isFetching
            ? tr("common.loading")
            : tr("usage.loadMore", { label: label })}
        </Button>
      )}
    </div>
  );
}
function Dimensions({
  taskId,
  kind,
  initial,
  version,
}: {
  taskId: string;
  kind: "model" | "harness";
  initial: UsageDimensionPage;
  version: number;
}) {
  useLocale();
  const api = useApi();
  return (
    <details>
      <summary>
        {kind === "model"
          ? tr("usage.recordedModels")
          : tr("usage.recordedHarnesses")}{" "}
        ({formatNumber(initial.total)})
      </summary>
      <PagedUsage
        initial={initial}
        queryKey={["task-usage-dimensions", taskId, version, kind]}
        fetchPage={(offset, signal) =>
          api.usageDimensions(taskId, kind, { offset, limit: 100 }, signal)
        }
        label={
          kind === "model"
            ? tr("usage.modelsLower")
            : tr("usage.harnessesLower")
        }
        countLabel={(count) =>
          tr(kind === "model" ? "usage.modelNoun" : "usage.harnessNoun", {
            count,
          })
        }
        itemKey={(item) =>
          JSON.stringify([item.provider, item.modelId, item.harness])
        }
        renderItem={(item) =>
          kind === "model" ? (
            <span>
              {item.modelId || tr("tasks.modelNotProvided")} ·{" "}
              {item.provider || tr("usage.providerNotProvided")}
            </span>
          ) : (
            <span>{item.harness || tr("usage.harnessNotProvided")}</span>
          )
        }
      />
    </details>
  );
}
export function TaskUsagePanel({
  taskId,
  usage,
  version,
}: {
  taskId: string;
  usage?: TaskUsage;
  version: number;
}) {
  useLocale();
  const api = useApi();
  if (!usage)
    return (
      <section className="task-usage" aria-label={tr("usage.recordedUsage")}>
        <h2>{tr("usage.recordedUsage")}</h2>
        <p className="small-note">
          {tr("usage.usageAggregationIsNotAvailableInThisResponseAbsenceDoes")}
        </p>
        <UsageCheckpointChart items={[]} taskId={taskId} />
      </section>
    );
  const c = usage.coverage;
  const coverageDetails: readonly [string, string, number][] = [
    ["entries", tr("usage.coverageLabels.entries"), c.entries],
    [
      "measuredEntries",
      tr("usage.coverageLabels.measuredEntries"),
      c.measuredEntries,
    ],
    [
      "estimatedEntries",
      tr("usage.coverageLabels.estimatedEntries"),
      c.estimatedEntries,
    ],
    [
      "unavailableEntries",
      tr("usage.coverageLabels.unavailableEntries"),
      c.unavailableEntries,
    ],
    [
      "baselineEntries",
      tr("usage.coverageLabels.baselineEntries"),
      c.baselineEntries,
    ],
    [
      "duplicateEntries",
      tr("usage.coverageLabels.duplicateEntries"),
      c.duplicateEntries,
    ],
    [
      "unallocatedEntries",
      tr("usage.coverageLabels.unallocatedEntries"),
      c.unallocatedEntries,
    ],
  ];
  const session = usage.recordedSessionUsage;
  return (
    <section className="task-usage" aria-label={tr("usage.recordedUsage")}>
      <h2>{tr("usage.recordedUsage")}</h2>
      {session && (
        <section aria-label={tr("usage.recordedSessionUsage")}>
          <h3>{tr("usage.recordedSessionUsage")}</h3>
          <dl className="usage-totals">
            <div>
              <dt>{tr("usage.measuredInSessionTokens")}</dt>
              <dd>{tokenCount(session.measuredTotalTokens)}</dd>
            </div>
            <div>
              <dt>{tr("usage.estimatedInSessionTokens")}</dt>
              <dd>{tokenCount(session.estimatedTotalTokens)}</dd>
            </div>
          </dl>
          <p className="small-note">
            {tr("usage.recordedSessionDeltasCalculatedByTheApiMayIncludeOther")}
          </p>
          <p className="small-note">
            {tr("usage.sessionCoverage", {
              sessions: tr("usage.sessionCount", {
                count: session.coverage.sessions,
              }),
              deltas: tr("usage.deltaCount", {
                count: session.coverage.deltaEntries,
              }),
              baselines: tr("usage.baselineCount", {
                count: session.coverage.baselineEntries,
              }),
              duplicates: tr("usage.duplicateCount", {
                count: session.coverage.duplicateEntries,
              }),
            })}
          </p>
        </section>
      )}
      <h3>{tr("usage.attributedToTask")}</h3>
      <dl className="usage-totals">
        <div>
          <dt>{tr("usage.knownCumulativeTotalTokens")}</dt>
          <dd>{tokenCount(usage.knownTotalTokens)}</dd>
        </div>
        <div>
          <dt>{tr("usage.separateEstimatedTotalTokens")}</dt>
          <dd>{tokenCount(usage.estimatedTotalTokens)}</dd>
        </div>
      </dl>
      <p className="small-note">
        {tr(
          "usage.knownTotalMeasuredDeltasWithExactAttributionAggregatedByThe",
        )}
      </p>
      <TokenComponents value={usage.measuredComponents} />
      <p className="small-note">
        {tr(
          "usage.cacheAndReasoningAreSubsetsNotAdditionalTokensUnreportedComponents",
        )}
      </p>
      <p>
        {tr("usage.summaryCoverage", {
          reported: tr("usage.reportedSummaryCount", {
            reported: c.reportedSummaries,
            count: c.totalSummaries,
          }),
          missing: tr("usage.missingSummaryCount", {
            count: c.missingSummaries,
          }),
        })}
      </p>
      {c.measuredEntries > 0 && c.estimatedEntries > 0 && (
        <p className="small-note">
          {tr("usage.mixedQualityMeasuredAndEstimatedObservationsPresent")}
        </p>
      )}
      <details>
        <summary>{tr("usage.coverageAndGaps")}</summary>
        <dl className="usage-components">
          {coverageDetails.map(([key, label, value]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{formatNumber(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="small-note">
          {tr(
            "usage.coverageCategoriesMayOverlapAbsenceInitialReferencesAndSharedAttribution",
          )}
        </p>
      </details>
      <div className="usage-dimension-grid">
        <Dimensions
          taskId={taskId}
          kind="model"
          initial={usage.models}
          version={version}
        />
        <Dimensions
          taskId={taskId}
          kind="harness"
          initial={usage.harnesses}
          version={version}
        />
      </div>
      <section aria-label={tr("usage.summaryUsageHistory")}>
        <p className="small-note">
          {tr("usage.reportTimeAndObservedStatusForEachSummaryDoesNot")}
        </p>
        <PagedUsage
          initial={usage.timeline}
          detailsLabel={tr("usage.summaryCheckpoints", {
            count: usage.timeline.total,
          })}
          overview={(items) => (
            <UsageCheckpointChart items={items} taskId={taskId} />
          )}
          queryKey={["task-usage-timeline", taskId, version]}
          fetchPage={async (offset, signal) =>
            (await api.usage(taskId, { offset, limit: 20 }, signal)).timeline
          }
          label={tr("usage.checkpoints")}
          countLabel={(count) => tr("usage.checkpointNoun", { count })}
          itemKey={(item) => item.summaryId}
          renderItem={(item) => (
            <>
              <OverviewAttribution
                actor={item.reportingActor}
                date={item.reportedAt}
              />
              <p className="small-note">
                {tr("usage.observedStatus")}{" "}
                {item.statusObserved
                  ? item.statusObserved.name || item.statusObserved.id
                  : tr("execution.notRecorded")}
              </p>
              <SummaryUsage report={item.usageReport} />
            </>
          )}
        />
      </section>
    </section>
  );
}
