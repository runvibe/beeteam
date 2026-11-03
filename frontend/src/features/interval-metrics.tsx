import { tokenCount } from "./usage-format";
import { observedDuration } from "./interval-format";
export type IntervalMetricsData = {
  tokens: string | null;
  partialTokens: string | null;
  observedMs: string | number | null;
  elapsedMs: string | number | null;
  coverage: { label: string; count: number }[];
};
export function IntervalMetrics({ data }: { data?: IntervalMetricsData }) {
  return (
    <section aria-label="Consumo por intervalos da tarefa">
      <h2>Consumo por intervalos da tarefa</h2>
      {!data ? (
        <p className="small-note">
          Métricas de intervalos não disponíveis. Resumos antigos não permitem
          reconstruir fronteiras.
        </p>
      ) : (
        <>
          <dl className="usage-totals">
            <div>
              <dt>Tokens de intervalos válidos</dt>
              <dd>{tokenCount(data.tokens)}</dd>
            </div>
            <div>
              <dt>Tokens parciais (abertos ou incompletos)</dt>
              <dd>{tokenCount(data.partialTokens)}</dd>
            </div>
            <div>
              <dt>Duração observada somada</dt>
              <dd>{observedDuration(data.observedMs)}</dd>
            </div>
            <div>
              <dt>Tempo decorrido observado</dt>
              <dd>{observedDuration(data.elapsedMs)}</dd>
            </div>
          </dl>
          <p className="small-note">
            Cobertura:{" "}
            {data.coverage
              .map((item) => `${item.count} ${item.label}`)
              .join(" · ") || "Não informada"}
          </p>
        </>
      )}
      <p className="small-note">
        Totais calculados pela API sobre intervalos declarados; não somar ao
        acumulado da sessão ou a checkpoints. A exclusividade é declarada pelo
        agente.
      </p>
      <p className="small-note">
        Duração somada e tempo decorrido são métricas distintas; o tempo
        decorrido usa a união dos períodos observados, sem duplicar
        sobreposições. Essas métricas não representam tempo de CPU, raciocínio
        ativo ou produtividade. A cobertura termina na coleta final registrada.
      </p>
    </section>
  );
}
