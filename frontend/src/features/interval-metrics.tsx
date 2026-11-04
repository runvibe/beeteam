import { formatNumber, useLocale, t as tr } from "@/i18n";

import { tokenCount } from "./usage-format";
import { observedDuration } from "./interval-format";
export type IntervalMetricsData = {
  tokens: string | null;
  observedMs: string | number | null;
  elapsedMs: string | number | null;
  coverage: { label: string; count: number }[];
};
function MissingMetric() {
  useLocale();
  return (
    <span
      role="img"
      aria-label={tr("usage.notProvided2")}
      title={tr("usage.notProvided2")}
    >
      —
    </span>
  );
}
export function IntervalMetrics({ data }: { data?: IntervalMetricsData }) {
  useLocale();
  return (
    <section aria-label={tr("usage.taskIntervalUsage")}>
      <h2>{tr("usage.taskIntervalUsage")}</h2>
      <dl className="usage-totals">
        <div>
          <dt>{tr("usage.validTokens")}</dt>
          <dd>
            {data?.tokens == null ? <MissingMetric /> : tokenCount(data.tokens)}
          </dd>
        </div>
        <div>
          <dt>{tr("usage.totalDuration")}</dt>
          <dd>
            {data?.observedMs == null ? (
              <MissingMetric />
            ) : (
              observedDuration(data.observedMs)
            )}
          </dd>
        </div>
        <div>
          <dt>{tr("usage.elapsedTime")}</dt>
          <dd>
            {data?.elapsedMs == null ? (
              <MissingMetric />
            ) : (
              observedDuration(data.elapsedMs)
            )}
          </dd>
        </div>
      </dl>
      {!!data?.coverage.length && (
        <ul
          className="interval-coverage"
          aria-label={tr("usage.intervalCoverage")}
        >
          {data.coverage.map((item) => (
            <li key={item.label}>
              <strong>{formatNumber(item.count)}</strong> {item.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
