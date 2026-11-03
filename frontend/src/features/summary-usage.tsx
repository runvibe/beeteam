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
  return (
    <dl className="usage-components">
      <div>
        <dt>Entrada</dt>
        <dd>{tokenCount(value.inputTokens)}</dd>
      </div>
      <div>
        <dt>Saída</dt>
        <dd>{tokenCount(value.outputTokens)}</dd>
      </div>
      <div>
        <dt>Cache (parte da entrada)</dt>
        <dd>{tokenCount(value.cachedInputTokens)}</dd>
      </div>
      <div>
        <dt>Raciocínio (parte da saída)</dt>
        <dd>{tokenCount(value.reasoningOutputTokens)}</dd>
      </div>
    </dl>
  );
}
const quality = {
  measured: "Medido",
  estimated: "Estimado",
  unavailable: "Indisponível",
};
const attribution = {
  exact: "Exata",
  shared: "Compartilhada",
  unallocated: "Não atribuída",
};
const kinds = {
  cumulative_snapshot: "Snapshot acumulado",
  period_delta: "Delta de período",
  unavailable: "Indisponível",
};
const reasons = {
  baseline_or_unavailable: "Referência inicial ou dados indisponíveis",
  duplicate_reference: "Referência duplicada; não somada novamente",
  attributed: "Atribuído",
  shared_or_unallocated: "Compartilhado ou sem atribuição exata",
};
function UsageEntryDetails({ entry }: { entry: UsageEntry }) {
  const o = entry.observation;
  return (
    <li className="usage-entry">
      <p>
        <strong>{o.modelId || "Modelo não informado"}</strong> ·{" "}
        {o.provider || "Provedor não informado"} · {o.harness}
        {o.harnessVersion ? ` ${o.harnessVersion}` : ""}
      </p>
      <p className="small-note">
        {quality[o.quality]} · Atribuição: {attribution[o.attribution]} ·{" "}
        {kinds[o.reportKind]}
      </p>
      <p className="small-note">
        Ator da observação:{" "}
        {o.actor.kind === "agent" && o.actor.id ? (
          <AgentName id={o.actor.id} />
        ) : o.actor.kind === "human" ? (
          "Pessoa · identidade não informada"
        ) : (
          "Agente não identificado"
        )}{" "}
        ·{" "}
        {
          {
            leader: "Líder",
            collaborator: "Colaborador",
            human: "Pessoa",
            unknown: "Papel não informado",
          }[o.actorRole]
        }
      </p>
      <SessionSnapshot observation={o} />
      <p>
        Delta derivado: <strong>{tokenCount(entry.delta?.totalTokens)}</strong>
        {entry.counted
          ? " · Incluído na agregação conforme qualidade"
          : " · Não incluído no total"}
      </p>
      <p className="small-note">{reasons[entry.coverageReason]}</p>
      {entry.delta && <TokenComponents value={entry.delta} />}
      <details>
        <summary>Observação original e proveniência</summary>
        <p className="small-note">
          {kinds[o.reportKind]}. Snapshots não são somados diretamente. Cache e
          raciocínio já fazem parte de entrada e saída.
        </p>
        <TokenComponents value={o} />
        <dl className="usage-provenance">
          <div>
            <dt>Fonte</dt>
            <dd>{o.source}</dd>
          </div>
          <div>
            <dt>Superfície</dt>
            <dd>{o.surface}</dd>
          </div>
          <div>
            <dt>Escopo</dt>
            <dd>
              {
                {
                  request: "Requisição",
                  session: "Sessão",
                  session_tree: "Sessão e descendentes",
                }[o.scope]
              }
            </dd>
          </div>
          <div>
            <dt>Observação coletada em</dt>
            <dd>{formatDate(o.observedAt)}</dd>
          </div>
          <div>
            <dt>Período informado</dt>
            <dd>
              {o.periodStart
                ? formatDate(o.periodStart)
                : "Início não informado"}{" "}
              · {o.periodEnd ? formatDate(o.periodEnd) : "Fim não informado"}
            </dd>
          </div>
          <div>
            <dt>Sessão / época</dt>
            <dd>
              {o.sessionId} / {o.epoch}
            </dd>
          </div>
          <div>
            <dt>Evidência</dt>
            <dd>{o.evidenceId}</dd>
          </div>
          <div>
            <dt>Evidência anterior</dt>
            <dd>{o.previousEvidenceId || "Não informada"}</dd>
          </div>
          <div>
            <dt>Resumo canônico</dt>
            <dd>{entry.canonicalSummaryId}</dd>
          </div>
        </dl>
        <p className="small-note">
          Reporte da entrada · revisão {entry.reportRevision}
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
  return (
    <section className="summary-usage" aria-label="Modelos, harnesses e tokens">
      <h3>Modelos, harnesses e tokens</h3>
      {!report ? (
        <p className="small-note">
          Métricas não informadas neste resumo. Ausência não significa zero.
        </p>
      ) : (
        <>
          <p className="small-note">
            Reporte do resumo · revisão {report.revision}. Horário de reporte,
            não de consumo.
          </p>
          <OverviewAttribution
            actor={report.reportingActor}
            date={report.reportedAt}
          />
          <p className="small-note">
            Status observado:{" "}
            {report.statusObserved.name || report.statusObserved.id}
          </p>
          {report.reconciledAt && (
            <p className="small-note">
              Reconciliado em {formatDate(report.reconciledAt)}. Entradas
              posteriores preservam o registro original.
            </p>
          )}
          <ul className="usage-entries">
            {report.entries.map((entry) => (
              <UsageEntryDetails key={entry.id} entry={entry} />
            ))}
          </ul>
          {!report.entries.length && (
            <p className="small-note">
              Nenhuma entrada de métricas disponível.
            </p>
          )}
        </>
      )}
    </section>
  );
}
