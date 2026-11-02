import { useId, useState, useRef, useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SummaryUsageTimelineItem } from "@/api/generated/kanban/SummaryUsageTimelineItem";
import { useApi } from "@/api/context";
import { Button } from "@/components/ui/button";
import { Failure, formatDate } from "@/components/shared";
import { Markdown } from "@/components/markdown";
import { OverviewAttribution } from "./overview-artifacts";
import { SummaryUsage, tokenCount } from "./summary-usage";
import "./task-usage-chart.css";

function CheckpointSummary({
  taskId,
  item,
}: {
  taskId: string;
  item: SummaryUsageTimelineItem;
}) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["usage-checkpoint-summary", taskId, item.summaryId],
    enabled: open,
    queryFn: async ({ signal }) => {
      let offset = 0;
      // Same timestamp may contain several summaries; resolve by immutable ID.
      for (;;) {
        const page = await api.list(
          "summaries",
          taskId,
          {
            createdFrom: item.reportedAt,
            sortBy: "createdAt",
            sortOrder: "asc",
            limit: 100,
            offset,
          },
          signal,
        );
        const match = page.items.find((row) => row.id === item.summaryId);
        if (match) return match;
        if (
          !page.hasMore ||
          page.nextOffset === null ||
          page.nextOffset <= offset
        )
          break;
        offset = page.nextOffset;
      }
      throw new Error("Resumo não encontrado nos registros disponíveis.");
    },
  });
  return (
    <div>
      <Button
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Fechar resumo" : "Abrir resumo"}
      </Button>
      {open && (
        <section aria-label="Resumo selecionado">
          {query.isPending && <p role="status">Carregando resumo…</p>}
          {query.error && (
            <Failure error={query.error} retry={() => void query.refetch()} />
          )}
          {query.data && (
            <>
              <Markdown headingOffset={2}>{query.data.summary}</Markdown>
              <SummaryUsage report={query.data.usageReport} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

export function UsageCheckpointChart({
  items,
  taskId,
}: {
  items: SummaryUsageTimelineItem[];
  taskId: string;
}) {
  const id = useId();
  const host = useRef<HTMLElement>(null);
  const [availableWidth, setAvailableWidth] = useState(480);
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => setAvailableWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [items.length]);
  const [selectedId, setSelected] = useState<string>();
  const points = [...items].sort(
    (a, b) =>
      Date.parse(a.reportedAt) - Date.parse(b.reportedAt) ||
      a.summaryId.localeCompare(b.summaryId),
  );
  const selected =
    points.find((p) => p.summaryId === selectedId) ?? points.at(-1);
  const values = points.map(
    (p) => p.recordedSessionUsage?.measuredTotalTokens ?? null,
  );
  const maxValue = values.reduce(
    (max, value) =>
      value !== null && BigInt(value) > max ? BigInt(value) : max,
    0n,
  );
  const times = points.map((p) => Date.parse(p.reportedAt));
  const minTime = Math.min(...times),
    maxTime = Math.max(...times);
  const width = Math.max(480, availableWidth, points.length * 44);
  const positions = points.map((_, index) => ({
    x:
      maxTime === minTime
        ? width / 2
        : 50 + ((times[index] - minTime) / (maxTime - minTime)) * (width - 100),
    y:
      values[index] === null
        ? 215
        : 175 -
          (maxValue === 0n
            ? 0
            : Number((BigInt(values[index]!) * 10000n) / maxValue) / 10000) *
            130,
  }));
  const session = selected?.recordedSessionUsage;
  const hasValues = values.some((value) => value !== null);
  return (
    <section ref={host} className="usage-chart" aria-labelledby={id}>
      <h3 id={id}>Evolução dos resumos</h3>
      <p className="small-note">
        Um ponto por resumo, no horário em que foi registrado. Altura: delta
        medido de sessão (tokens), não progresso nem valor numérico de status. O
        detalhe mostra o status histórico daquele resumo. Lacunas e referências
        iniciais não são zero; a linha conecta apenas pontos consecutivos com
        valor.
      </p>
      {points.length > 0 &&
        points.every((point) => !point.recordedSessionUsage) && (
          <p className="small-note">
            Delta de sessão por resumo não disponível nesta resposta.
          </p>
        )}
      <div
        className="usage-chart-scroll"
        role="group"
        aria-label="Pontos dos resumos; selecione para consultar"
      >
        <div className="usage-chart-plot" style={{ width }}>
          <svg viewBox={`0 0 ${width} 270`} aria-hidden="true">
            {[45, 175].map((y) => (
              <line
                key={y}
                x1="50"
                x2={width - 50}
                y1={y}
                y2={y}
                className="overview-gridline"
              />
            ))}
            <text x="8" y="28">
              {hasValues ? tokenCount(maxValue.toString()) : "Tokens"}
            </text>
            {hasValues && (
              <text x="8" y="179">
                0
              </text>
            )}
            <text x="8" y="240">
              Sem delta
            </text>
            {positions.map((p, i) =>
              i > 0 && values[i] !== null && values[i - 1] !== null ? (
                <line
                  key={points[i].summaryId}
                  x1={positions[i - 1].x}
                  y1={positions[i - 1].y}
                  x2={p.x}
                  y2={p.y}
                  className="overview-progress-line"
                />
              ) : null,
            )}
            <text x="50" y="264">
              {points.length
                ? formatDate(points[0].reportedAt)
                : "Horário do resumo"}
            </text>
            {points.length > 1 && (
              <text x={width - 50} y="264" textAnchor="end">
                {formatDate(points.at(-1)!.reportedAt)}
              </text>
            )}
          </svg>
          {!points.length && (
            <p className="usage-chart-empty">Sem resumos disponíveis</p>
          )}
          {points.map((point, i) => (
            <button
              key={point.summaryId}
              type="button"
              className="usage-chart-point"
              data-missing={values[i] === null}
              aria-pressed={selected?.summaryId === point.summaryId}
              aria-label={`Resumo ${formatDate(point.reportedAt)}: ${values[i] === null ? "sem delta medido" : tokenCount(values[i]) + " tokens"}; status ${point.statusObserved?.name ?? "não registrado"}`}
              style={{ left: positions[i].x, top: positions[i].y }}
              aria-controls={`${id}-detail`}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setSelected(point.summaryId);
              }}
              onFocus={() => setSelected(point.summaryId)}
              onClick={() => setSelected(point.summaryId)}
            />
          ))}
        </div>
      </div>
      {selected && (
        <>
          <label className="usage-chart-selection">
            Checkpoint
            <select
              aria-label="Checkpoint"
              value={selected.summaryId}
              onChange={(e) => setSelected(e.target.value)}
            >
              {points.map((p, i) => (
                <option key={p.summaryId} value={p.summaryId}>
                  {i + 1}. {formatDate(p.reportedAt)} ·{" "}
                  {tokenCount(
                    p.recordedSessionUsage?.measuredTotalTokens ?? null,
                  )}
                </option>
              ))}
            </select>
          </label>
          <div
            id={`${id}-detail`}
            className="usage-chart-detail"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="small-note">Autor do resumo</span>
            <OverviewAttribution
              actor={selected.reportingActor}
              date={selected.reportedAt}
            />
            <p>
              Status no momento do resumo:{" "}
              {selected.statusObserved?.name ?? "Não registrado"}
            </p>
            <p>
              Delta medido: {tokenCount(session?.measuredTotalTokens ?? null)} ·
              Estimado: {tokenCount(session?.estimatedTotalTokens ?? null)}{" "}
              tokens
            </p>
            {!!session?.coverage.baselineEntries && (
              <p className="small-note">
                Referência inicial presente: snapshot informacional, excluído do
                delta.
              </p>
            )}
            <p className="small-note">
              Executor histórico da tarefa: não registrado.
            </p>
            {[
              ...new Set(
                selected.usageReport?.entries.map(
                  (entry) =>
                    `${entry.observation.modelId || "Modelo não informado"} · ${entry.observation.harness || "Harness não informado"}`,
                ) ?? [],
              ),
            ].map((label) => (
              <p key={label} className="small-note">
                {label}
              </p>
            ))}
          </div>
          <details>
            <summary>Evidências deste checkpoint</summary>
            <SummaryUsage report={selected.usageReport} />
          </details>
          <CheckpointSummary
            key={selected.summaryId}
            taskId={taskId}
            item={selected}
          />
        </>
      )}
    </section>
  );
}
