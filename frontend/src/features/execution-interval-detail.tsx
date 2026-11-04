import { formatNumber, useLocale, t as tr } from "@/i18n";

import type { TaskExecutionInterval } from "@/api/generated/kanban/TaskExecutionInterval";
import { formatDate } from "@/components/shared";
import { AgentName } from "@/components/names";
import { observedDuration } from "./interval-format";
import { tokenCount, tokenAmount } from "./usage-format";
import { SessionSnapshot } from "./session-snapshots";
import { TokenComponents } from "./summary-usage";
import { RecordedSummary } from "./recorded-summary";
export const intervalState = (state: string) =>
  ({
    open: tr("execution.open"),
    closed: tr("execution.closed"),
    incomplete: tr("execution.incomplete"),
    invalid: tr("usage.invalid"),
    complete: tr("execution.complete"),
  })[state] ?? state;
export function ExecutionIntervalDetail({
  interval: i,
}: {
  interval: TaskExecutionInterval;
}) {
  useLocale();
  return (
    <div className="execution-interval-detail">
      <h4>
        {tr("usage.interval")} {intervalState(i.state)} {tr("usage.revision")}{" "}
        {formatNumber(i.revision)}
      </h4>
      <p>
        <AgentName id={i.agentId} /> ·{" "}
        {i.models.join(" · ") || tr("usage.modelsNotProvided")}
      </p>
      <p>
        {tr("usage.intervalTokens")} {tokenCount(i.totalTokens)}{" "}
        {tr("usage.partial")} {tokenCount(i.partialTokens)}
      </p>
      <p>
        {tr("usage.observedDuration")} {observedDuration(i.observedDurationMs)}
      </p>
      <p>
        {tr("usage.coverage")} {intervalState(i.coverage)}
        {i.coverageLost ? tr("usage.declaredCoverageLoss") : ""}
      </p>
      {i.reason && <p>{i.reason}</p>}
      <p className="small-note">
        {tr("execution.source")} {i.source} {tr("execution.session")}{" "}
        {i.sessionId} ·{" "}
        {i.scope === "session_tree"
          ? tr("usage.sessionAndDescendants")
          : tr("usage.session")}
      </p>
      <p className="small-note">
        {i.counterMode === "global"
          ? tr("usage.globalCounterInvolvedModelsDoNotIndicateAnExactBreakdown")
          : tr("usage.perModelCountersDeclaredDisjoint")}
      </p>
      <dl className="usage-totals">
        <div>
          <dt>{tr("usage.observedStart")}</dt>
          <dd>{formatDate(i.startObservedAt)}</dd>
        </div>
        <div>
          <dt>{tr("usage.observedEnd")}</dt>
          <dd>
            {i.endObservedAt
              ? formatDate(i.endObservedAt)
              : tr("usage.noObservedClosure")}
          </dd>
        </div>
        <div>
          <dt>{tr("usage.lastCollection")}</dt>
          <dd>{formatDate(i.latestObservedAt)}</dd>
        </div>
        <div>
          <dt>{tr("usage.startReceived")}</dt>
          <dd>{formatDate(i.startReceivedAt)}</dd>
        </div>
        <div>
          <dt>{tr("usage.endReceived")}</dt>
          <dd>
            {i.endReceivedAt
              ? formatDate(i.endReceivedAt)
              : tr("usage.notReceived")}
          </dd>
        </div>
      </dl>
      <div>
        <h5>{tr("usage.startingSummary")}</h5>
        <RecordedSummary taskId={i.taskId} summaryId={i.startSummaryId} />
      </div>
      {i.endSummaryId && (
        <div>
          <h5>{tr("usage.closingSummary")}</h5>
          <RecordedSummary taskId={i.taskId} summaryId={i.endSummaryId} />
        </div>
      )}
      {!i.endSummaryId && (
        <p className="small-note">
          {tr("usage.noClosingSummaryCheckpointsDoNotCloseTheInterval")}
        </p>
      )}
      <details>
        <summary>{tr("usage.counterBoundariesAndDifferences")}</summary>
        {!i.counters.length && <p>{tr("usage.usageBoundariesUnavailable")}</p>}
        {i.counters.map((counter) => (
          <section key={counter.counterKey} className="execution-counter">
            <h5>
              {tr("usage.counter")} {counter.counterKey}
            </h5>
            {counter.incomplete && <p>{tr("usage.incompleteCoverage")}</p>}
            {counter.segments.map((segment, index) => (
              <div key={`${segment.start.id}-${index}`}>
                <strong>
                  {tr("usage.segment")} {formatNumber(index + 1)} ·{" "}
                  {segment.complete
                    ? tr("usage.comparable")
                    : tr("execution.incomplete")}
                </strong>
                {segment.reason && <p>{segment.reason}</p>}
                <h5>{tr("usage.initialBoundary")}</h5>
                <SessionSnapshot observation={segment.start.observation} />
                <p className="small-note">
                  {tr("usage.evidence")} {segment.start.observation.evidenceId}{" "}
                  {tr("usage.epoch")} {segment.start.observation.epoch}
                </p>
                <RecordedSummary
                  taskId={i.taskId}
                  summaryId={segment.startSummaryId}
                />
                <h5>{tr("usage.lastRecordedBoundary")}</h5>
                <SessionSnapshot observation={segment.latest.observation} />
                <p className="small-note">
                  {tr("usage.evidence")} {segment.latest.observation.evidenceId}{" "}
                  {tr("usage.epoch")} {segment.latest.observation.epoch}
                </p>
                <RecordedSummary
                  taskId={i.taskId}
                  summaryId={segment.latestSummaryId}
                />
                <p>
                  {tr("usage.differenceCalculatedByTheApi")}{" "}
                  {tokenAmount(segment.delta?.totalTokens)}
                </p>
                {segment.delta && <TokenComponents value={segment.delta} />}
              </div>
            ))}
          </section>
        ))}
      </details>
      <p className="small-note">
        {tr("usage.explicitBoundariesOnlyAbsenceIsNotZeroDoNotAdd")}
      </p>
    </div>
  );
}
