import { formatNumber, useLocale, t as tr } from "@/i18n";

import { SessionSnapshot } from "./session-snapshots";
import { tokenCount } from "./usage-format";
export { tokenCount } from "./usage-format";
import type { SummaryUsageReport } from "@/api/generated/kanban/SummaryUsageReport";
import type { UsageEntry } from "@/api/generated/kanban/UsageEntry";
import type { UsageDelta } from "@/api/generated/kanban/UsageDelta";
import { AgentName } from "@/components/names";
import { formatDate } from "@/components/shared";
import { OverviewAttribution } from "./overview-artifacts";
import "./task-usage.css";

export function TokenComponents({ value }: { value: Partial<UsageDelta> }) {
  useLocale();
  return (
    <dl className="usage-components">
      <div>
        <dt>{tr("usage.input")}</dt>
        <dd>{tokenCount(value.inputTokens)}</dd>
      </div>
      <div>
        <dt>{tr("usage.output")}</dt>
        <dd>{tokenCount(value.outputTokens)}</dd>
      </div>
      <div>
        <dt>{tr("usage.cachePartOfInput")}</dt>
        <dd>{tokenCount(value.cachedInputTokens)}</dd>
      </div>
      <div>
        <dt>{tr("usage.reasoningPartOfOutput")}</dt>
        <dd>{tokenCount(value.reasoningOutputTokens)}</dd>
      </div>
    </dl>
  );
}
const quality = {
  get measured() {
    return tr("usage.measured");
  },
  get estimated() {
    return tr("usage.estimated");
  },
  get unavailable() {
    return tr("usage.unavailable");
  },
};
const attribution = {
  get exact() {
    return tr("usage.exact");
  },
  get shared() {
    return tr("usage.shared");
  },
  get unallocated() {
    return tr("usage.notAttributed");
  },
};
const kinds = {
  get cumulative_snapshot() {
    return tr("usage.cumulativeSnapshot");
  },
  get period_delta() {
    return tr("usage.periodDelta");
  },
  get unavailable() {
    return tr("usage.unavailable");
  },
};
const reasons = {
  get baseline_or_unavailable() {
    return tr("usage.initialReferenceOrUnavailableData");
  },
  get duplicate_reference() {
    return tr("usage.duplicateReferenceNotAddedAgain");
  },
  get attributed() {
    return tr("usage.attributed");
  },
  get shared_or_unallocated() {
    return tr("usage.sharedOrWithoutExactAttribution");
  },
};
function UsageEntryDetails({ entry }: { entry: UsageEntry }) {
  useLocale();
  const o = entry.observation;
  return (
    <li className="usage-entry">
      <p>
        <strong>{o.modelId || tr("tasks.modelNotProvided")}</strong> ·{" "}
        {o.provider || tr("usage.providerNotProvided")} · {o.harness}
        {o.harnessVersion ? ` ${o.harnessVersion}` : ""}
      </p>
      <p className="small-note">
        {quality[o.quality]} {tr("usage.attribution")}{" "}
        {attribution[o.attribution]} · {kinds[o.reportKind]}
      </p>
      <p className="small-note">
        {tr("usage.observationActor")}{" "}
        {o.actor.kind === "agent" && o.actor.id ? (
          <AgentName id={o.actor.id} />
        ) : o.actor.kind === "human" ? (
          tr("common.personIdentityNotProvided")
        ) : (
          tr("common.unidentifiedAgent")
        )}{" "}
        ·{" "}
        {
          {
            leader: tr("common.leader"),
            worker: tr("common.worker"),
            human: tr("tasks.person"),
            unknown: tr("usage.roleNotProvided"),
          }[o.actorRole]
        }
      </p>
      <SessionSnapshot observation={o} />
      <p>
        {tr("usage.derivedDelta")}{" "}
        <strong>{tokenCount(entry.delta?.totalTokens)}</strong>
        {entry.counted
          ? tr("usage.includedInAggregationAccordingToQuality")
          : tr("usage.notIncludedInTotal")}
      </p>
      <p className="small-note">{reasons[entry.coverageReason]}</p>
      {entry.delta && <TokenComponents value={entry.delta} />}
      <details>
        <summary>{tr("usage.originalObservationAndProvenance")}</summary>
        <p className="small-note">
          {kinds[o.reportKind]}
          {tr(
            "usage.snapshotsAreNotAddedDirectlyCacheAndReasoningAreAlready",
          )}
        </p>
        <TokenComponents value={o} />
        <dl className="usage-provenance">
          <div>
            <dt>{tr("usage.source")}</dt>
            <dd>{o.source}</dd>
          </div>
          <div>
            <dt>{tr("usage.surface")}</dt>
            <dd>{o.surface}</dd>
          </div>
          <div>
            <dt>{tr("usage.scope")}</dt>
            <dd>
              {
                {
                  request: tr("usage.request"),
                  session: tr("usage.session"),
                  session_tree: tr("usage.sessionAndDescendants"),
                }[o.scope]
              }
            </dd>
          </div>
          <div>
            <dt>{tr("usage.observationCollectedAt")}</dt>
            <dd>{formatDate(o.observedAt)}</dd>
          </div>
          <div>
            <dt>{tr("usage.reportedPeriod")}</dt>
            <dd>
              {o.periodStart
                ? formatDate(o.periodStart)
                : tr("usage.startNotProvided")}{" "}
              ·{" "}
              {o.periodEnd
                ? formatDate(o.periodEnd)
                : tr("usage.endNotProvided")}
            </dd>
          </div>
          <div>
            <dt>{tr("usage.sessionEpoch")}</dt>
            <dd>
              {o.sessionId} / {o.epoch}
            </dd>
          </div>
          <div>
            <dt>{tr("usage.evidence2")}</dt>
            <dd>{o.evidenceId}</dd>
          </div>
          <div>
            <dt>{tr("usage.previousEvidence")}</dt>
            <dd>{o.previousEvidenceId || tr("usage.notProvided")}</dd>
          </div>
          <div>
            <dt>{tr("usage.canonicalSummary")}</dt>
            <dd>{entry.canonicalSummaryId}</dd>
          </div>
        </dl>
        <p className="small-note">
          {tr("usage.entryReportRevision")}{" "}
          {formatNumber(entry.reportRevision)}
        </p>
        <OverviewAttribution
          actor={entry.reportingActor}
          date={entry.reportedAt}
        />
        {o.discovery && (
          <div>
            <p>{o.discovery.reason}</p>
            <ul>
              {o.discovery.attempts.map((attempt, i) => (
                <li key={i}>{attempt}</li>
              ))}
            </ul>
          </div>
        )}
      </details>
    </li>
  );
}
export function SummaryUsage({
  report,
}: {
  report?: SummaryUsageReport | null;
}) {
  useLocale();
  return (
    <section
      className="summary-usage"
      aria-label={tr("usage.modelsHarnessesAndTokens")}
    >
      <h3>{tr("usage.modelsHarnessesAndTokens")}</h3>
      {!report ? (
        <p className="small-note">
          {tr("tasks.metricsNotProvidedInThisSummaryAbsenceDoesNotMean")}
        </p>
      ) : (
        <>
          <p className="small-note">
            {tr("usage.summaryReportRevision")}{" "}
            {formatNumber(report.revision)}
            {tr("usage.reportTimeNotUsageTime")}
          </p>
          <OverviewAttribution
            actor={report.reportingActor}
            date={report.reportedAt}
          />
          <p className="small-note">
            {tr("usage.observedStatus")}{" "}
            {report.statusObserved.name || report.statusObserved.id}
          </p>
          {report.reconciledAt && (
            <p className="small-note">
              {tr("usage.reconciledAt")} {formatDate(report.reconciledAt)}
              {tr("usage.laterEntriesPreserveTheOriginalRecord")}
            </p>
          )}
          <ul className="usage-entries">
            {report.entries.map((entry) => (
              <UsageEntryDetails key={entry.id} entry={entry} />
            ))}
          </ul>
          {!report.entries.length && (
            <p className="small-note">
              {tr("usage.noMetricEntriesAvailable")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
