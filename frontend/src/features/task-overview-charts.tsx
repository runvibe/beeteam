import { currentUrl, navigate } from "@/routing/location";
import { ChartPointPopover } from "./chart-point-popover";
import { OverviewAttribution } from "./overview-artifacts";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Filters } from "@/api/types";
import type { TaskOverviewData } from "@/api/task-overview";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/components/shared";

const chartColor = (index: number) => `var(--chart-${(index % 5) + 1})`;
export function SubtaskCharts({
  data,
  onFilter,
}: {
  data: TaskOverviewData["directSubtasks"];
  onFilter: (filter: Filters) => void;
}) {
  const multipleBoards =
    new Set(data.byStatus.map((status) => status.boardId)).size > 1;
  return (
    <>
      <section className="overview-chart" aria-label="Subtarefas por status">
        <h2>Subtarefas por status</h2>
        <p className="small-note">
          Filhas diretas{data.archivedIncluded ? ", incluindo arquivadas" : ""}{" "}
          · {data.total} no total
        </p>
        {!data.total ? (
          <>
            <div
              className="overview-segments overview-empty-track"
              aria-hidden="true"
            />
            <p className="small-note">Nenhuma subtarefa direta registrada.</p>
          </>
        ) : (
          <>
            <div className="overview-segments" aria-hidden="true">
              {data.byStatus.map((status, index) => (
                <span
                  key={status.statusId}
                  style={{ flex: status.total, background: chartColor(index) }}
                />
              ))}
            </div>
            <ul className="overview-legend">
              {data.byStatus.map((status, index) => (
                <li key={status.statusId}>
                  <Button
                    variant="ghost"
                    className="overview-legend-button"
                    onClick={() => onFilter({ statusId: status.statusId })}
                    aria-label={`${status.statusName}${multipleBoards ? ` (${status.boardName || status.boardId})` : ""}: ${status.total} subtarefas`}
                    title={status.boardName || `Board ${status.boardId}`}
                  >
                    <span
                      className="overview-swatch"
                      style={{ background: chartColor(index) }}
                      aria-hidden="true"
                    />
                    <span>
                      {status.statusName}
                      {multipleBoards && (
                        <small className="overview-status-board">
                          {status.boardName || status.boardId}
                        </small>
                      )}
                    </span>
                    <strong>{status.total}</strong>
                  </Button>
                </li>
              ))}
            </ul>
            <p className="small-note">
              {data.done} concluídas · {data.remaining} restantes
            </p>
            {data.blocked > 0 && (
              <div className="overview-blocked-count">
                <Button
                  variant="outline"
                  onClick={() => onFilter({ blocked: true })}
                >
                  {data.blocked}{" "}
                  {data.blocked === 1 ? "bloqueada" : "bloqueadas"}
                </Button>
                <p className="small-note">
                  Bloqueadas já estão incluídas nos status acima.
                </p>
              </div>
            )}
          </>
        )}
      </section>
      <section
        className="overview-chart"
        aria-label="Subtarefas por responsável"
      >
        <h2>Distribuição por responsável</h2>
        <p className="small-note">
          Contagem de subtarefas diretas. Não representa produtividade ou carga
          estimada.
        </p>
        {!data.byExecutor.length ? (
          <>
            <div
              className="overview-assignee-bar overview-empty-track"
              aria-hidden="true"
            />
            <p className="small-note">Sem subtarefas para distribuir.</p>
          </>
        ) : (
          <>
            <p className="overview-bar-key">
              <span>
                <i
                  className="overview-swatch overview-done"
                  aria-hidden="true"
                />
                Concluídas
              </span>
              <span>
                <i
                  className="overview-swatch overview-remaining"
                  aria-hidden="true"
                />
                Restantes
              </span>
            </p>
            <ul className="overview-assignees">
              {data.byExecutor.map((item) => (
                <li key={item.executorAgentId}>
                  <Button
                    variant="ghost"
                    className="overview-assignee-name"
                    onClick={() =>
                      onFilter({ executorAgentId: item.executorAgentId })
                    }
                  >
                    {item.agentName || `Agente ${item.executorAgentId}`}
                  </Button>
                  <div
                    className="overview-assignee-bar"
                    aria-hidden="true"
                    style={
                      {
                        width: `${(100 * item.total) / Math.max(...data.byExecutor.map((row) => row.total), 1)}%`,
                      } as CSSProperties
                    }
                  >
                    <span
                      className="overview-done"
                      style={{ flex: item.done }}
                    />
                    <span
                      className="overview-remaining"
                      style={{ flex: item.remaining }}
                    />
                  </div>
                  <p className="small-note">
                    {item.done} concluídas · {item.remaining} restantes ·{" "}
                    {item.total} total
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

export function ProgressHistory({
  data,
}: {
  data: TaskOverviewData["progressHistory"];
}) {
  const title = useId(),
    description = useId();
  const points = data.items;
  const [selectedId, setSelected] = useState<string>();
  const selected =
    points.find((point) => point.eventId === selectedId) ?? points.at(-1);
  const chart = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);
  const hasPoints = points.length > 0;
  useLayoutEffect(() => {
    const node = chart.current;
    if (!node) return;
    const measure = () => {
      const measured = node.getBoundingClientRect().width;
      if (measured > 0) setWidth(Math.max(240, measured));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [hasPoints]);
  const times = points.map((point) => Date.parse(point.occurredAt));
  const min = Math.min(...times),
    max = Math.max(...times);
  const positions = points.map((point, index) => ({
    x:
      max === min
        ? width / 2
        : 40 + ((times[index] - min) / (max - min)) * (width - 72),
    y: 180 - point.percent * 1.5,
  }));
  return (
    <section className="overview-chart overview-progress-history">
      <h2>Evolução do progresso registrado</h2>
      <p className="small-note">
        Registros explícitos da tarefa; independente da conclusão das
        subtarefas.
      </p>
      {!points.length && (
        <p className="small-note">
          Sem histórico explícito de progresso disponível. O percentual atual
          não permite reconstruir o passado.
        </p>
      )}
      <>
        <div className="overview-progress-plot">
          <svg
            className="overview-progress-svg"
            ref={chart}
            viewBox={`0 0 ${width} 215`}
            role="img"
            aria-labelledby={`${title} ${description}`}
          >
            <title id={title}>
              Evolução do progresso registrado: {points.length} registros
            </title>
            <desc id={description}>
              Cada ponto é uma atualização registrada. A linha conecta
              registros, sem estimar trabalho entre eles. Valores disponíveis na
              tabela abaixo.
            </desc>
            {[0, 50, 100].map((value) => (
              <g key={value}>
                <line
                  x1="40"
                  x2={width - 32}
                  y1={180 - value * 1.5}
                  y2={180 - value * 1.5}
                  className="overview-gridline"
                />
                <text x="4" y={184 - value * 1.5}>
                  {value}
                </text>
              </g>
            ))}
            {positions.length > 1 && (
              <polyline
                points={positions.map((p) => `${p.x},${p.y}`).join(" ")}
                className="overview-progress-line"
              />
            )}
            {positions.map((position, index) => (
              <circle
                key={points[index].eventId}
                cx={position.x}
                cy={position.y}
                r="4"
                className="overview-progress-point"
              >
                <title>
                  {formatDate(points[index].occurredAt)}:{" "}
                  {points[index].percent}%
                </title>
              </circle>
            ))}
            <text x="40" y="208">
              {points.length
                ? new Date(points[0].occurredAt).toLocaleDateString("pt-BR")
                : "Data do registro"}
            </text>
            {points.length > 1 && (
              <text x={width - 32} y="208" textAnchor="end">
                {new Date(points.at(-1)!.occurredAt).toLocaleDateString(
                  "pt-BR",
                )}
              </text>
            )}
          </svg>
          {positions.map((position, index) => (
            <ChartPointPopover
              key={points[index].eventId}
              pointId={points[index].eventId}
              position={position}
              hitWidth={Math.max(
                1,
                Math.min(
                  44,
                  index > 0
                    ? Math.abs(position.x - positions[index - 1].x)
                    : 44,
                  index < positions.length - 1
                    ? Math.abs(positions[index + 1].x - position.x)
                    : 44,
                ),
              )}
              className="overview-progress-hit"
              label={`${formatDate(points[index].occurredAt)}: ${points[index].percent}%`}
              dialogLabel="Detalhes do progresso neste ponto"
              selected={selected?.eventId === points[index].eventId}
              detailId={`${description}-detail`}
              onSelect={() => setSelected(points[index].eventId)}
            >
              <strong>Progresso registrado: {points[index].percent}%</strong>
              <OverviewAttribution
                actor={points[index]}
                date={points[index].occurredAt}
              />
              <p>Status no momento do registro: não registrado.</p>
              <p>Tokens neste ponto: não informados.</p>
              <p className="small-note">
                {points[index].summaryId
                  ? "Resumo vinculado disponível na tabela abaixo."
                  : "Este evento de progresso não tem vínculo explícito com um resumo ou evidência de consumo."}
              </p>
              {points[index].note && <p>{points[index].note}</p>}
            </ChartPointPopover>
          ))}
        </div>
        {selected && (
          <div
            id={`${description}-detail`}
            className="overview-progress-detail"
            aria-live="polite"
          >
            <OverviewAttribution actor={selected} date={selected.occurredAt} />
            <p>Progresso registrado: {selected.percent}%</p>
            <p className="small-note">
              Tokens neste ponto: não informados. Sem vínculo explícito com uma
              evidência de consumo.
            </p>
          </div>
        )}
        {points.length > 0 && (
          <>
            <p className="small-note">
              A linha apenas conecta registros; não estima trabalho nos
              intervalos.
              {data.truncated
                ? ` Exibindo os ${points.length} registros mais recentes de ${data.total}.`
                : ""}
            </p>
            <details className="overview-history-table">
              <summary>Ver {points.length} registros em tabela</summary>
              <div className="overview-table-scroll">
                <table>
                  <caption className="sr-only">
                    Valores de progresso registrados
                  </caption>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Progresso</th>
                      <th>Nota registrada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((point) => (
                      <tr key={point.eventId}>
                        <td>
                          <time dateTime={point.occurredAt}>
                            {formatDate(point.occurredAt)}
                          </time>
                        </td>
                        <td>
                          {point.summaryId ? (
                            <button
                              type="button"
                              className="underline"
                              onClick={() => {
                                const [path, search] = currentUrl().split("?");
                                const query = new URLSearchParams(search);
                                query.set("tab", "summaries");
                                query.set(
                                  "summaries.selected",
                                  point.summaryId!,
                                );
                                navigate(`${path}?${query}`);
                              }}
                              aria-label={`Abrir resumo do progresso ${point.percent}%`}
                            >
                              {point.percent}%
                            </button>
                          ) : (
                            `${point.percent}%`
                          )}
                        </td>
                        <td>{point.note || "Sem nota"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </>
    </section>
  );
}
