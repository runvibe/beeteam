import { useContext, useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Tooltip } from "radix-ui";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { FilterSummaryContext } from "./filter-context";

export function InlineFilterSearch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const register = useContext(FilterSummaryContext);
  useEffect(() => {
    register?.(id, value ? { label, value } : undefined);
    return () => register?.(id);
  }, [register, id, label, value]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="inline-filter-search" data-open={open}>
      <Input
        ref={input}
        id={id}
        type="search"
        aria-label={label}
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        inert={!open}
        maxLength={200}
        placeholder="Digite para filtrar…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
              event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      />
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Button
            ref={trigger}
            variant={value ? "secondary" : "ghost"}
            size="icon"
            className="filter-icon"
            aria-label={open ? `Fechar ${label.toLowerCase()}` : label}
            aria-expanded={open}
            aria-controls={open ? id : undefined}
            data-active={!!value || undefined}
            onClick={() => (open ? close() : setOpen(true))}
          >
            {open ? <X aria-hidden="true" /> : <Search aria-hidden="true" />}
            {!!value && !open && (
              <span className="filter-active-dot" aria-hidden="true" />
            )}
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="navigation-tooltip" sideOffset={6}>
            {open ? "Recolher busca" : label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </div>
  );
}
