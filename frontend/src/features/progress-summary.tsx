import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { Failure } from "@/components/shared";
import { SessionSnapshots } from "./session-snapshots";
import { tokenCount } from "./usage-format";

/** Mounted only inside the open point popover; no timestamp matching or history preload. */
export function ProgressSummary({
  taskId,
  summaryId,
}: {
  taskId: string;
  summaryId: string;
}) {
  const api = useApi();
  const query = useQuery({
    queryKey: ["summaries", taskId, { id: summaryId, limit: 1 }],
    queryFn: ({ signal }) =>
      api.list("summaries", taskId, { id: summaryId, limit: 1 }, signal),
  });
  if (query.isPending) return <p role="status">Carregando resumo vinculado…</p>;
  if (query.error)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  const summary = query.data.items.find(
    (item) => item.id === summaryId && item.taskId === taskId,
  );
  if (!summary) return <p>Resumo vinculado indisponível.</p>;
  const report = summary.usageReport;
  const status = summary.statusObserved ?? report?.statusObserved;
  return (
    <>
      <p>Status no momento do registro: {status?.name ?? "não registrado"}</p>
      {!report?.entries.length ? (
        <p>
          Métricas não informadas neste resumo. Ausência não significa zero.
        </p>
      ) : (
        <>
          <SessionSnapshots report={report} />
          {report.entries.map((entry) => (
            <div key={entry.id}>
              <p>
                {entry.observation.modelId || "Modelo não informado"} ·{" "}
                {entry.observation.harness}
              </p>
              <p>
                Delta registrado (
                {entry.observation.quality === "measured"
                  ? "medido"
                  : entry.observation.quality === "estimated"
                    ? "estimado"
                    : "indisponível"}
                ): {tokenCount(entry.delta?.totalTokens)} tokens
              </p>
              <p className="small-note">
                {entry.counted
                  ? "Incluído no total atribuído conforme o reporte."
                  : "Não incluído no total atribuído à tarefa."}
              </p>
            </div>
          ))}
        </>
      )}
    </>
  );
}
