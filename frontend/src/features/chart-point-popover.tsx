import { useEffect, useRef, useState, type ReactNode } from "react";
import { Popover } from "radix-ui";
import "./task-usage-chart.css";

export function ChartPointPopover({
  pointId,
  position,
  hitWidth,
  selected,
  detailId,
  onSelect,
  className,
  missing,
  label,
  dialogLabel,
  children,
}: {
  pointId: string;
  position: { x: number; y: number };
  hitWidth?: number;
  selected: boolean;
  detailId: string;
  onSelect: () => void;
  className: string;
  missing?: boolean;
  label: string;
  dialogLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const anchor = useRef<HTMLButtonElement>(null);
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
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <button
          ref={anchor}
          type="button"
          className={className}
          data-missing={missing}
          aria-pressed={selected}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? `${detailId}-popover-${pointId}` : undefined}
          aria-label={label}
          style={{ left: position.x, top: position.y, width: hitWidth }}
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
          id={`${detailId}-popover-${pointId}`}
          className="usage-point-popover"
          aria-label={dialogLabel}
          side="top"
          sideOffset={4}
          collisionPadding={16}
          onInteractOutside={(event) => {
            if (anchor.current?.contains(event.target as Node))
              event.preventDefault();
          }}
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
          {children}
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
