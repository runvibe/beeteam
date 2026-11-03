import type { TaskExecutionInterval } from "@/api/generated/kanban/TaskExecutionInterval";
import { formatDate } from "@/components/shared";
import { AgentName } from "@/components/names";
import { observedDuration } from "./interval-format";
import { tokenCount } from "./usage-format";
import { SessionSnapshot } from "./session-snapshots";
import { TokenComponents } from "./summary-usage";
import { RecordedSummary } from "./recorded-summary";
export const intervalState = (state: string) =>
  ({
    open: "Aberto",
    closed: "Encerrado",
    incomplete: "Incompleto",
    invalid: "Inválido",
    complete: "Completa",
  })[state] ?? state;
export function ExecutionIntervalDetail({
  interval: i,
}: {
  interval: TaskExecutionInterval;
}) {
  return (
    <div className="execution-interval-detail">
      <h4>
        Intervalo {intervalState(i.state)} · revisão {i.revision}
      </h4>
      <p>
        <AgentName id={i.agentId} /> ·{" "}
        {i.models.join(" · ") || "Modelos não informados"}
      </p>
      <p>
        Tokens do intervalo: {tokenCount(i.totalTokens)} · Parcial:{" "}
        {tokenCount(i.partialTokens)}
      </p>
      <p>Duração observada: {observedDuration(i.observedDurationMs)}</p>
      <p>
        Cobertura: {intervalState(i.coverage)}
        {i.coverageLost ? " · Há perda de cobertura declarada" : ""}
      </p>
      {i.reason && <p>{i.reason}</p>}
      <p className="small-note">
        Fonte: {i.source} · Sessão: {i.sessionId} ·{" "}
        {i.scope === "session_tree" ? "Sessão e descendentes" : "Sessão"}
      </p>
      <p className="small-note">
        {i.counterMode === "global"
          ? "Contador global: modelos envolvidos não indicam divisão exata do consumo por modelo."
          : "Contadores por modelo declarados disjuntos."}
      </p>
      <dl className="usage-totals">
        <div>
          <dt>Início observado</dt>
          <dd>{formatDate(i.startObservedAt)}</dd>
        </div>
        <div>
          <dt>Fim observado</dt>
          <dd>
            {i.endObservedAt
              ? formatDate(i.endObservedAt)
              : "Sem encerramento observado"}
          </dd>
        </div>
        <div>
          <dt>Última coleta</dt>
          <dd>{formatDate(i.latestObservedAt)}</dd>
        </div>
        <div>
          <dt>Início recebido</dt>
          <dd>{formatDate(i.startReceivedAt)}</dd>
        </div>
        <div>
          <dt>Fim recebido</dt>
          <dd>
            {i.endReceivedAt ? formatDate(i.endReceivedAt) : "Não recebido"}
          </dd>
        </div>
      </dl>
      <div>
        <h5>Resumo de início</h5>
        <RecordedSummary taskId={i.taskId} summaryId={i.startSummaryId} />
      </div>
      {i.endSummaryId && (
        <div>
          <h5>Resumo de encerramento</h5>
          <RecordedSummary taskId={i.taskId} summaryId={i.endSummaryId} />
        </div>
      )}
      {!i.endSummaryId && (
        <p className="small-note">
          Sem resumo de encerramento. Checkpoints não encerram o intervalo.
        </p>
      )}
      <details>
        <summary>Fronteiras e diferenças dos contadores</summary>
        {!i.counters.length && <p>Fronteiras de consumo indisponíveis.</p>}
        {i.counters.map((counter) => (
          <section key={counter.counterKey} className="execution-counter">
            <h5>Contador {counter.counterKey}</h5>
            {counter.incomplete && <p>Cobertura incompleta.</p>}
            {counter.segments.map((segment, index) => (
              <div key={`${segment.start.id}-${index}`}>
                <strong>
                  Segmento {index + 1} ·{" "}
                  {segment.complete ? "Comparável" : "Incompleto"}
                </strong>
                {segment.reason && <p>{segment.reason}</p>}
                <h5>Fronteira inicial</h5>
                <SessionSnapshot observation={segment.start.observation} />
                <p className="small-note">
                  Evidência: {segment.start.observation.evidenceId} · Epoch:{" "}
                  {segment.start.observation.epoch}
                </p>
                <RecordedSummary
                  taskId={i.taskId}
                  summaryId={segment.startSummaryId}
                />
                <h5>Última fronteira registrada</h5>
                <SessionSnapshot observation={segment.latest.observation} />
                <p className="small-note">
                  Evidência: {segment.latest.observation.evidenceId} · Epoch:{" "}
                  {segment.latest.observation.epoch}
                </p>
                <RecordedSummary
                  taskId={i.taskId}
                  summaryId={segment.latestSummaryId}
                />
                <p>
                  Diferença calculada pela API:{" "}
                  {tokenCount(segment.delta?.totalTokens)} tokens
                </p>
                {segment.delta && <TokenComponents value={segment.delta} />}
              </div>
            ))}
          </section>
        ))}
      </details>
      <p className="small-note">
        Somente fronteiras explícitas. Ausência não é zero; não somar deltas
        intermediários ao final nem contadores de árvore aos filhos.
      </p>
    </div>
  );
}
