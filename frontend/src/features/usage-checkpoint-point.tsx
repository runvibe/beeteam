import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
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
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const content = useRef<HTMLDivElement>(null);
  const clear = () => {
    clearTimeout(timer.current);
  };
  const show = () => {
    clear();
    onSelect();
    setOpen(true);
  };
  const leave = () => {
    clear();
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  const usage = point.recordedSessionUsage;
  const measured = usage?.measuredTotalTokens;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <button
          type="button"
          className="usage-chart-point"
          data-missing={measured == null}
          aria-pressed={selected}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={
            open ? `${detailId}-popover-${point.summaryId}` : detailId
          }
          aria-label={`Resumo ${formatDate(point.reportedAt)}: ${measured == null ? "sem delta medido" : tokenCount(measured) + " tokens"}; status ${point.statusObserved?.name ?? "não registrado"}`}
          style={{ left: position.x, top: position.y }}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") show();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") leave();
          }}
          onFocus={show}
          onBlur={(event) => {
            if (!content.current?.contains(event.relatedTarget as Node))
              leave();
          }}
          onClick={show}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              clear();
              setOpen(false);
            }
          }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          ref={content}
          id={`${detailId}-popover-${point.summaryId}`}
          className="usage-point-popover"
          aria-label="Detalhes do resumo neste ponto"
          side="top"
          sideOffset={4}
          collisionPadding={16}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onPointerEnter={clear}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") leave();
          }}
          onEscapeKeyDown={() => {
            clear();
            setOpen(false);
          }}
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
          <Popover.Close
            className="usage-point-close"
            aria-label="Fechar detalhes do ponto"
          >
            Fechar
          </Popover.Close>
          <Popover.Arrow className="usage-point-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
