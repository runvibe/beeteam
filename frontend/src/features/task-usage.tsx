import { useInfiniteQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useApi } from "@/api/context";
import type { TaskUsage } from "@/api/generated/kanban/TaskUsage";
import type { UsageDimensionPage } from "@/api/generated/kanban/UsageDimensionPage";
import { Button } from "@/components/ui/button";
import { Failure } from "@/components/shared";
import { OverviewAttribution } from "./overview-artifacts";
import { SummaryUsage, tokenCount, TokenComponents } from "./summary-usage";

type UsagePage<T> = {
  items: T[];
  offset: number;
  limit: number;
  total: number;
  truncated: boolean;
};
function PagedUsage<T>({
  initial,
  queryKey,
  fetchPage,
  renderItem,
  label,
  itemKey,
}: {
  initial: UsagePage<T>;
  queryKey: (string | number)[];
  fetchPage: (offset: number, signal: AbortSignal) => Promise<UsagePage<T>>;
  renderItem: (item: T) => ReactNode;
  label: string;
  itemKey: (item: T) => string;
}) {
  const q = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    initialData: { pages: [initial], pageParams: [0] },
    getNextPageParam: (page) =>
      page.truncated && page.items.length
        ? page.offset + page.items.length
        : undefined,
  });
  const rows = [
    ...new Map(
      q.data.pages
        .flatMap((page) => page.items)
        .map((item) => [itemKey(item), item]),
    ).values(),
  ];
  return (
    <div className="usage-page">
      <p className="small-note">
        {rows.length} de {q.data.pages[0].total} {label}
      </p>
      <ul className="usage-checkpoints">
        {rows.map((item) => (
          <li key={itemKey(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      {q.error && (
        <Failure
          error={q.error}
          retry={() =>
            void (q.isFetchNextPageError ? q.fetchNextPage() : q.refetch())
          }
        />
      )}
      {q.hasNextPage && (
        <Button
          variant="outline"
          disabled={q.isFetching}
          onClick={() => void q.fetchNextPage()}
        >
          {q.isFetching ? "Carregando…" : `Carregar mais ${label}`}
        </Button>
      )}
    </div>
  );
}
function Dimensions({
  taskId,
  kind,
  initial,
  version,
}: {
  taskId: string;
  kind: "model" | "harness";
  initial: UsageDimensionPage;
  version: number;
}) {
  const api = useApi();
  return (
    <details>
      <summary>
        {kind === "model" ? "Modelos registrados" : "Harnesses registrados"} (
        {initial.total})
      </summary>
      <PagedUsage
        initial={initial}
        queryKey={["task-usage-dimensions", taskId, version, kind]}
        fetchPage={(offset, signal) =>
          api.usageDimensions(taskId, kind, { offset, limit: 100 }, signal)
        }
        label={kind === "model" ? "modelos" : "harnesses"}
        itemKey={(item) =>
          JSON.stringify([item.provider, item.modelId, item.harness])
        }
        renderItem={(item) =>
          kind === "model" ? (
            <span>
              {item.modelId || "Modelo não informado"} ·{" "}
              {item.provider || "Provedor não informado"}
            </span>
          ) : (
            <span>{item.harness || "Harness não informado"}</span>
          )
        }
      />
    </details>
  );
}
export function TaskUsagePanel({
  taskId,
  usage,
  version,
}: {
  taskId: string;
  usage?: TaskUsage;
  version: number;
}) {
  const api = useApi();
  if (!usage)
    return (
      <section className="task-usage" aria-label="Uso registrado">
        <h2>Uso registrado</h2>
        <p className="small-note">
          Agregação de uso não disponível nesta resposta. Ausência não significa
          zero.
        </p>
      </section>
    );
  const c = usage.coverage;
  return (
    <section className="task-usage" aria-label="Uso registrado">
      <h2>Uso registrado</h2>
      <dl className="usage-totals">
        <div>
          <dt>Total acumulado conhecido (tokens)</dt>
          <dd>{tokenCount(usage.knownTotalTokens)}</dd>
        </div>
        <div>
          <dt>Total estimado separado (tokens)</dt>
          <dd>{tokenCount(usage.estimatedTotalTokens)}</dd>
        </div>
      </dl>
      <p className="small-note">
        Total conhecido: deltas medidos com atribuição exata, agregados pela
        API. Estimativas são separadas; snapshots e referências duplicadas não
        são somados diretamente.
      </p>
      <TokenComponents value={usage.measuredComponents} />
      <p className="small-note">
        Cache e raciocínio são subconjuntos, não tokens adicionais. Componentes
        não informados não equivalem a zero.
      </p>
      <p>
        {c.reportedSummaries} de {c.totalSummaries} resumos com reporte ·{" "}
        {c.missingSummaries} sem métricas.
      </p>
      {c.measuredEntries > 0 && c.estimatedEntries > 0 && (
        <p className="small-note">
          Qualidade mista: há observações medidas e estimadas.
        </p>
      )}
      <details>
        <summary>Cobertura e lacunas</summary>
        <dl className="usage-components">
          {Object.entries({
            Entradas: c.entries,
            Medidas: c.measuredEntries,
            Estimadas: c.estimatedEntries,
            Indisponíveis: c.unavailableEntries,
            "Referências iniciais": c.baselineEntries,
            Duplicadas: c.duplicateEntries,
            "Compartilhadas ou não atribuídas": c.unallocatedEntries,
          }).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="small-note">
          Categorias de cobertura podem se sobrepor. Ausência, referência
          inicial e atribuição compartilhada limitam o total conhecido.
        </p>
      </details>
      <div className="usage-dimension-grid">
        <Dimensions
          taskId={taskId}
          kind="model"
          initial={usage.models}
          version={version}
        />
        <Dimensions
          taskId={taskId}
          kind="harness"
          initial={usage.harnesses}
          version={version}
        />
      </div>
      <details>
        <summary>Checkpoints dos resumos ({usage.timeline.total})</summary>
        <p className="small-note">
          Momento de reporte e status observado em cada resumo. Não representa
          horário de consumo nem mudança inferida de status. Inclui resumos sem
          métricas.
        </p>
        <PagedUsage
          initial={usage.timeline}
          queryKey={["task-usage-timeline", taskId, version]}
          fetchPage={async (offset, signal) =>
            (await api.usage(taskId, { offset, limit: 20 }, signal)).timeline
          }
          label="checkpoints"
          itemKey={(item) => item.summaryId}
          renderItem={(item) => (
            <>
              <OverviewAttribution
                actor={item.reportingActor}
                date={item.reportedAt}
              />
              <p className="small-note">
                Status observado:{" "}
                {item.statusObserved
                  ? item.statusObserved.name || item.statusObserved.id
                  : "Não registrado"}
              </p>
              <SummaryUsage report={item.usageReport} />
            </>
          )}
        />
      </details>
    </section>
  );
}
