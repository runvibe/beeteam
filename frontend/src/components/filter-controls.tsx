import { useContext, useEffect, useId, type ReactNode } from "react";
import { FilterSummaryContext } from "./filter-context";
import { Popover, RadioGroup, Tooltip } from "radix-ui";
import {
  Search,
  Users,
  UserRound,
  Archive,
  LockKeyhole,
  CalendarDays,
  Briefcase,
  GitBranch,
  ListFilter,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./ui/button";
const icons: Record<string, LucideIcon> = {
  "Time gestor": Users,
  Time: Users,
  Executor: UserRound,
  Cadastro: Archive,
  Papel: Briefcase,
  Bloqueio: LockKeyhole,
  "Atualizadas desde": CalendarDays,
  Relação: GitBranch,
  Eventos: GitBranch,
};
export function FilterPopover({
  label,
  active = false,
  children,
  search = false,
  summary,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
  search?: boolean;
  summary?: string;
}) {
  const Icon = search ? Search : icons[label] || ListFilter;
  const heading = useId();
  const register = useContext(FilterSummaryContext);
  useEffect(() => {
    register?.(
      heading,
      active ? { label, value: summary || label } : undefined,
    );
    return () => register?.(heading);
  }, [register, heading, active, label, summary]);
  const hint = summary ? `${label}: ${summary}` : label;
  return (
    <Popover.Root>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Popover.Trigger asChild>
            <Button
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
      <Popover.Portal>
        <Popover.Content
          className="filter-popover"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-labelledby={heading}
        >
          <h2 id={heading} className="filter-popover-title">
            {label}
          </h2>
          {children}
        </Popover.Content>
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
