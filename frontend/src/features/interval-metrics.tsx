import { tokenCount } from "./usage-format";
import { observedDuration } from "./interval-format";
export type IntervalMetricsData = {
  tokens: string | null;
  observedMs: string | number | null;
  elapsedMs: string | number | null;
  coverage: { label: string; count: number }[];
};
function MissingMetric() {
  return <span role="img" aria-label="Não informado" title="Não informado">—</span>;
}
export function IntervalMetrics({ data }: { data?: IntervalMetricsData }) {
  return (
    <section aria-label="Consumo por intervalos da tarefa">
      <h2>Consumo por intervalos da tarefa</h2>
      <dl className="usage-totals">
        <div><dt>Tokens válidos</dt><dd>{data?.tokens == null ? <MissingMetric /> : tokenCount(data.tokens)}</dd></div>
        <div><dt>Duração somada</dt><dd>{data?.observedMs == null ? <MissingMetric /> : observedDuration(data.observedMs)}</dd></div>
        <div><dt>Tempo decorrido</dt><dd>{data?.elapsedMs == null ? <MissingMetric /> : observedDuration(data.elapsedMs)}</dd></div>
      </dl>
      {!!data?.coverage.length && <ul className="interval-coverage" aria-label="Cobertura dos intervalos">
        {data.coverage.map(item => <li key={item.label}><strong>{item.count}</strong> {item.label}</li>)}
      </ul>}
    </section>
  );
}
