import type { SummaryUsageReport } from "@/api/generated/kanban/SummaryUsageReport";
import { tokenCount } from "./summary-usage";

export function SessionBaseline({
  report,
}: {
  report?: SummaryUsageReport | null;
}) {
  const entries =
    report?.entries.filter(
      ({ observation: o, coverageReason, delta }) =>
        o.scope === "session" &&
        o.reportKind === "cumulative_snapshot" &&
        o.quality !== "unavailable" &&
        coverageReason === "baseline_or_unavailable" &&
        delta === null,
    ) ?? [];
  return (
    <>
      {entries.map(({ id, observation: o }) => (
        <div key={id}>
          <p>
            Acumulado registrado de sessão (
            {o.quality === "estimated" ? "estimado" : "medido"}):{" "}
            {tokenCount(
              o.inputTokens != null && o.outputTokens != null
                ? (BigInt(o.inputTokens) + BigInt(o.outputTokens)).toString()
                : null,
            )}{" "}
            tokens
          </p>
          <p className="small-note">
            Referência inicial da sessão {o.sessionId}. Não atribuído à tarefa
            nem somado ao total ou ao delta. Cache e raciocínio já estão
            incluídos na entrada e saída.
          </p>
        </div>
      ))}
    </>
  );
}
