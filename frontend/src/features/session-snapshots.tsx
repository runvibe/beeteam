import type { SummaryUsageReport } from "@/api/generated/kanban/SummaryUsageReport";
import type { UsageObservation } from "@/api/generated/kanban/UsageObservation";
import { OverviewAttribution } from "./overview-artifacts";
import { tokenCount } from "./usage-format";

export function SessionSnapshot({
  observation: o,
}: {
  observation: UsageObservation;
}) {
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
        Acumulado registrado de{" "}
        {o.scope === "session_tree" ? "sessão e descendentes" : "sessão"} (
        {o.quality === "estimated" ? "estimado" : "medido"}):{" "}
        {tokenCount(total)} tokens
      </p>
      <p className="small-note">
        {o.modelId || "Modelo não informado"} · Sessão {o.sessionId}
      </p>
      <span className="small-note">Ator da observação · acumulado até</span>
      <OverviewAttribution
        actor={{ actorKind: o.actor.kind, actorId: o.actor.id }}
        date={o.observedAt}
      />
      {o.totalTokens == null && total !== null && (
        <p className="small-note">
          Registro legado: acumulado calculado pela entrada + saída.
        </p>
      )}
      <p className="small-note">
        Não atribuído à tarefa nem somado ao total ou ao delta. Não somar
        checkpoints nem sessão e descendentes com subagentes. Cache e raciocínio
        já estão incluídos na entrada e saída.
      </p>
    </div>
  );
}
export function SessionSnapshots({
  report,
}: {
  report?: SummaryUsageReport | null;
}) {
  return (
    <>
      {report?.entries.map(({ id, observation }) => (
        <SessionSnapshot key={id} observation={observation} />
      ))}
    </>
  );
}
