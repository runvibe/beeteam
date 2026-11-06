import { t as tr, useLocale } from "@/i18n";

import { AnimatePresence } from "motion/react";
import { AnimatedFilterContent } from "./filter-motion";
import { useFilterRemoval } from "./use-filter-removal";
import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { FilterSummaryContext } from "./filter-context";
import { Popover, RadioGroup, Tooltip } from "radix-ui";
import {
  Search,
  TerminalSquare,
  CircleDot,
  Ban,
  Users,
  UserRound,
  Archive,
  LockKeyhole,
  CalendarDays,
  Briefcase,
  GitBranch,
  ListFilter,
  FileType,
  Trash2,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./ui/button";
const icons: readonly (readonly [string, LucideIcon])[] = [
  ["agents.chatHarness", TerminalSquare],
  ["agents.chatRegistry", Archive],
  ["agents.chatCreatedPeriod", CalendarDays],
  ["files.fileType", FileType],
  ["files.removedFiles", Trash2],
  ["tasks.subtaskStatus", CircleDot],
  ["tasks.subtaskAssignee", UserRound],
  ["tasks.subtaskBlocking", Ban],
  ["tasks.archivedSubtasks", Archive],
  ["boards.managingTeam", Users],
  ["agents.team", Users],
  ["boards.executor", UserRound],
  ["tasks.speaker", UserRound],
  ["agents.registry", Archive],
  ["agents.role", Briefcase],
  ["boards.block", LockKeyhole],
  ["boards.updatedSince", CalendarDays],
  ["agents.relationship", GitBranch],
  ["tasks.events2", GitBranch],
];
export function FilterPopover({
  label,
  active = false,
  children,
  search = false,
  summary,
  onClear,
  triggerRef,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
  search?: boolean;
  summary?: string;
  onClear?: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  useLocale();
  const [open, setOpen] = useState(false);
  const ownTrigger = useRef<HTMLButtonElement>(null);
  const trigger = triggerRef ?? ownTrigger;
  const remove = useFilterRemoval(onClear);
  const Icon = search
    ? Search
    : icons.find(([key]) => tr(key) === label)?.[1] || ListFilter;
  const heading = useId();
  const register = useContext(FilterSummaryContext);
  useEffect(() => {
    register?.(
      heading,
      active ? { label, value: summary || label, onRemove: remove } : undefined,
    );
    return () => register?.(heading);
  }, [register, heading, active, label, summary, remove]);
  const hint = summary ? `${label}: ${summary}` : label;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Popover.Trigger asChild>
            <Button
              ref={trigger}
              variant={active ? "secondary" : "ghost"}
              size="icon"
              className="filter-icon"
              aria-label={label}
              data-active={active || undefined}
            >
              <Icon aria-hidden="true" />
              {active && (
                <span className="filter-active-dot" aria-hidden="true" />
              )}
            </Button>
          </Popover.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="navigation-tooltip" sideOffset={6}>
            {hint}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Popover.Portal forceMount>
        <AnimatePresence>
          {open && (
            <AnimatedFilterContent
              key="content"
              heading={heading}
              trigger={trigger}
            >
              <h2 id={heading} className="filter-popover-title">
                {label}
              </h2>
              {children}
            </AnimatedFilterContent>
          )}
        </AnimatePresence>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function FilterOptions({
  label,
  value,
  onChange,
  options,
  all,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  all?: string;
}) {
  useLocale();
  const items = all ? [{ value: "", label: all }, ...options] : options;
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value || "__all"}
      onValueChange={(v) => onChange(v === "__all" ? "" : v)}
      className="filter-options-list"
    >
      {items.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value || "__all"}
          className="filter-option"
        >
          <span className="filter-option-check">
            <RadioGroup.Indicator>
              <Check aria-hidden="true" />
            </RadioGroup.Indicator>
          </span>
          <span>{option.label}</span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
