import { useQuery } from "@tanstack/react-query";
import { Tooltip } from "radix-ui";
import { Terminal } from "lucide-react";
import { useApi } from "@/api/context";
import { ApiError } from "@/api/types";
import { Failure } from "@/components/shared";
import { loadUsagePresence } from "./usage-presence";
import { harnessIcon } from "./harness-catalog";
import "./overview-usage-cards.css";

export function OverviewUsageCards({
  taskId,
  version,
}: {
  taskId: string;
  version: number;
}) {
  const api = useApi();
  const q = useQuery({
    queryKey: ["usage-presence", taskId, version],
    queryFn: ({ signal }) => loadUsagePresence(api, taskId, signal),
  });
  const data = q.error ? undefined : q.data;
  return (
    <div className="overview-usage-cards" aria-busy={q.isPending}>
      <section
        className="usage-presence-card"
        aria-label="Harnesses utilizados"
      >
        <h2>Harnesses utilizados</h2>
        <Tooltip.Provider delayDuration={150}>
          <div className="harness-presence-list">
            {data?.harnesses.map((name) => (
              <Tooltip.Root key={name}>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    className="harness-presence-icon"
                    aria-label={name}
                  >
                    {harnessIcon(name) ? (
                      <img src={harnessIcon(name)} alt="" />
                    ) : (
                      <Terminal size={25} aria-hidden="true" />
                    )}
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="navigation-tooltip"
                    sideOffset={7}
                  >
                    {name}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ))}
            {!data?.harnesses.length && (
              <p className="small-note">
                {q.isPending
                  ? "Carregando registros…"
                  : q.error
                    ? "Leitura indisponível"
                    : "Nenhum harness registrado"}
              </p>
            )}
          </div>
        </Tooltip.Provider>
      </section>
      <section className="usage-presence-card" aria-label="Modelos utilizados">
        <h2>Modelos utilizados</h2>
        <ul className="model-presence-list">
          {data?.models.map((model) => (
            <li key={model.name}>
              <div>
                <span>{model.name}</span>
                <span
                  aria-label={`${model.count} de ${data.summaries} resumos`}
                >
                  {model.count}
                  <small> / {data.summaries}</small>
                </span>
              </div>
              <div
                className="model-presence-track"
                role="meter"
                aria-label={`Presença de ${model.name}`}
                aria-valuenow={model.count}
                aria-valuemin={0}
                aria-valuemax={data.summaries}
                aria-valuetext={`${model.count} de ${data.summaries} resumos`}
              >
                <span
                  style={{ width: `${(100 * model.count) / data.summaries}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        {!data?.models.length && (
          <p className="small-note">
            {q.isPending
              ? "Carregando registros…"
              : q.error
                ? "Leitura indisponível"
                : "Nenhum modelo registrado"}
          </p>
        )}
      </section>
      {q.error && (
        <div className="usage-presence-error">
          {q.error instanceof ApiError && q.error.status === 501 ? (
            <p className="small-note">{q.error.message}</p>
          ) : (
            <Failure error={q.error} retry={() => void q.refetch()} />
          )}
        </div>
      )}
    </div>
  );
}
