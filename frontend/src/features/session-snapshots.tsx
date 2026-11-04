import { useLocale, t as tr } from "@/i18n";

import type { SummaryUsageReport } from "@/api/generated/kanban/SummaryUsageReport";
import type { UsageObservation } from "@/api/generated/kanban/UsageObservation";
import { OverviewAttribution } from "./overview-artifacts";
import { tokenCount } from "./usage-format";

export function SessionSnapshot({
  observation: o,
}: {
  observation: UsageObservation;
}) {
  useLocale();
  if (
    o.reportKind !== "cumulative_snapshot" ||
    !["session", "session_tree"].includes(o.scope) ||
    o.quality === "unavailable"
  )
    return null;
  const total =
    o.totalTokens ??
    (o.inputTokens != null && o.outputTokens != null
      ? (BigInt(o.inputTokens) + BigInt(o.outputTokens)).toString()
      : null);
  return (
    <div>
      <p>
        {tr("common.recordedCumulativeUsageOf")}{" "}
        {o.scope === "session_tree"
          ? tr("common.sessionAndDescendants")
          : tr("common.session")}{" "}
        (
        {o.quality === "estimated"
          ? tr("usage.estimatedLower")
          : tr("usage.measuredLower")}
        ): {tokenCount(total)} {tr("usage.tokens")}
      </p>
      <p className="small-note">
        {o.modelId || tr("tasks.modelNotProvided")} {tr("common.session2")}{" "}
        {o.sessionId}
      </p>
      <span className="small-note">
        {tr("common.observationActorCumulativeThrough")}
      </span>
      <OverviewAttribution
        actor={{ actorKind: o.actor.kind, actorId: o.actor.id }}
        date={o.observedAt}
      />
      {o.totalTokens == null && total !== null && (
        <p className="small-note">
          {tr("common.legacyRecordCumulativeUsageCalculatedFromInputOutput")}
        </p>
      )}
      <p className="small-note">
        {tr("common.notAttributedToTheTaskOrAddedToTheTotal")}
      </p>
    </div>
  );
}
export function SessionSnapshots({
  report,
}: {
  report?: SummaryUsageReport | null;
}) {
  useLocale();
  return (
    <>
      {report?.entries.map(({ id, observation }) => (
        <SessionSnapshot key={id} observation={observation} />
      ))}
    </>
  );
}
