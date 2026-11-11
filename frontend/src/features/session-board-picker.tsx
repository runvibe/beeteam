import { useId, useState } from "react";
import { Check, KanbanSquare } from "lucide-react";
import { Popover, RadioGroup } from "radix-ui";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

type Board = { id: string; name: string };

export function SessionBoardPicker({
  value,
  boards,
  historicalBoard,
  disabled,
  hasMore,
  loading,
  onMore,
  onChange,
}: {
  value: string;
  boards: Board[];
  historicalBoard?: Board;
  disabled: boolean;
  hasMore: boolean;
  loading: boolean;
  onMore?: () => void;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const current = boards.find((board) => board.id === value) ?? historicalBoard;
  const label = value ? current?.name ?? t("sessions.unknown") : t("managed.noBoard");
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="assistant-board-trigger"
          aria-label={t("managed.sessionBoard")}
          aria-describedby={descriptionId}
          title={`${t("managed.sessionBoard")}: ${label}`}
          disabled={disabled}
        >
          <KanbanSquare data-icon="inline-start" aria-hidden="true" />
          <span id={descriptionId}>{label}</span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="assistant-board-popover"
          side="bottom"
          align="end"
          sideOffset={6}
          aria-label={t("managed.sessionBoard")}
        >
          <h2>{t("managed.sessionBoard")}</h2>
          <RadioGroup.Root
            aria-label={t("managed.sessionBoard")}
            value={value || "__none"}
            disabled={disabled}
            onValueChange={(next) => {
              onChange(next === "__none" ? "" : next);
              setOpen(false);
            }}
            className="assistant-board-options"
          >
            {[
              { id: "__none", name: t("managed.noBoard") },
              ...(historicalBoard ? [historicalBoard] : []),
              ...boards,
            ].map((board) => (
              <RadioGroup.Item
                key={board.id}
                value={board.id}
                disabled={board.id === historicalBoard?.id}
                className="assistant-board-option"
              >
                <span className="assistant-board-check">
                  <RadioGroup.Indicator><Check aria-hidden="true" /></RadioGroup.Indicator>
                </span>
                <span>{board.name}</span>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
          {hasMore && onMore && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || loading} onClick={onMore}>
              {t("managed.moreBoards")}
            </Button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
