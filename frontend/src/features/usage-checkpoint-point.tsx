import { ChartPointPopover } from "./chart-point-popover";
import { SessionSnapshots } from "./session-snapshots";
import type { SummaryUsageTimelineItem } from "@/api/generated/kanban/SummaryUsageTimelineItem";
import { OverviewAttribution } from "./overview-artifacts";
import { tokenCount } from "./summary-usage";
import { formatDate } from "@/components/shared";

export function UsageCheckpointPoint({
  point,
  position,
  selected,
  detailId,
  onSelect,
}: {
  point: SummaryUsageTimelineItem;
  position: { x: number; y: number };
  selected: boolean;
  detailId: string;
  onSelect: () => void;
}) {
  const usage = point.recordedSessionUsage;
  const measured = usage?.measuredTotalTokens;
  return (
    <ChartPointPopover
      pointId={point.summaryId}
      position={position}
      selected={selected}
      detailId={detailId}
      onSelect={onSelect}
      className="usage-chart-point"
      missing={measured == null}
      label={`Resumo ${formatDate(point.reportedAt)}: ${measured == null ? "sem delta medido" : tokenCount(measured) + " tokens"}; status ${point.statusObserved?.name ?? "não registrado"}`}
      dialogLabel="Detalhes do resumo neste ponto"
    >
      <strong>Resumo registrado</strong>
      <span className="small-note">Autor</span>
      <OverviewAttribution
        actor={point.reportingActor}
        date={point.reportedAt}
      />
      <p>
        Status no momento do resumo:{" "}
        {point.statusObserved?.name ?? "Não registrado"}
      </p>
      <p>Delta medido de sessão: {tokenCount(measured)} tokens</p>
      <p>
        Estimado de sessão: {tokenCount(usage?.estimatedTotalTokens)} tokens
      </p>
      {!!usage?.coverage.baselineEntries && (
        <p className="small-note">
          Referência inicial: snapshot não somado ao delta.
        </p>
      )}
      <SessionSnapshots report={point.usageReport} />
    </ChartPointPopover>
  );
}
