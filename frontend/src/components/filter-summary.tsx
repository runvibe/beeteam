import { formatNumber, useLocale, t as tr } from "@/i18n";

import {
  useId,
  useState,
  useRef,
  useLayoutEffect,
  useContext,
  type MouseEvent,
} from "react";
import type { ActiveFilter } from "./filter-context";
import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { FilterDirectionContext } from "./filter-context";
import { filterSpring, motionCssVariables } from "./motion-presets";

function RemoveFilter({
  filter,
  onRemove,
}: {
  filter: ActiveFilter;
  onRemove: (
    filter: ActiveFilter,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
}) {
  useLocale();
  if (!filter.onRemove) return null;
  return (
    <button
      type="button"
      className="filter-remove"
      aria-label={tr("common.removeFilter", {
        label: filter.label,
        value: filter.value,
      })}
      onClick={(event) => {
        event.stopPropagation();
        onRemove(filter, event);
      }}
    >
      <X aria-hidden="true" />
    </button>
  );
}

export function FilterSummary({ filters }: { filters: ActiveFilter[] }) {
  useLocale();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const direction = useContext(FilterDirectionContext);
  const pendingFocus = useRef<number | null>(null);
  const [area, setArea] = useState<{
    width: number;
    height: number;
    head: number;
  } | null>(null);
  const expanded = pinned || hovered || focused;
  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    const buttons =
      root.current?.querySelectorAll<HTMLButtonElement>(".filter-remove");
    buttons?.[Math.min(pendingFocus.current, buttons.length - 1)]?.focus();
    pendingFocus.current = null;
  }, [filters]);
  const remove = (
    filter: ActiveFilter,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    const node = root.current;
    if (filters.length === 1) {
      node
        ?.closest(".compact-filter-bar")
        ?.querySelector<HTMLButtonElement>(
          "button:not(.filter-remove):not(.filter-summary-toggle)",
        )
        ?.focus();
    } else {
      if (expanded && node) {
        const bounds = node.getBoundingClientRect();
        const head = node
          .querySelector(".filter-summary-head")!
          .getBoundingClientRect();
        const list = node
          .querySelector(".filter-summary-list")!
          .getBoundingClientRect();
        setArea({
          width: bounds.width,
          height: Math.max(bounds.height, list.bottom - bounds.top),
          head: head.height,
        });
      }
      if (event.detail === 0) {
        pendingFocus.current = filters.indexOf(filter);
        setFocused(true);
      }
    }
    filter.onRemove?.();
  };
  return (
    <div
      ref={root}
      className="filter-summary"
      style={{
        ...motionCssVariables,
        ...(area
          ? {
              width: area.width,
              minHeight: area.height,
              pointerEvents: "auto" as const,
            }
          : {}),
      }}
      data-expanded={expanded}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
        setPinned(false);
        setArea(null);
      }}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) setFocused(true);
      }}
      onBlurCapture={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          pendingFocus.current === null
        ) {
          setFocused(false);
          if (!hovered) setArea(null);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          // Focus must leave the list before it becomes inert during collapse.
          toggle.current?.focus({ preventScroll: true });
          setPinned(false);
          setFocused(false);
          setHovered(false);
          setArea(null);
        }
      }}
    >
      <div className="filter-summary-head">
        <button
          ref={toggle}
          type="button"
          className="filter-summary-toggle"
          aria-label={tr("common.activeFilterCount", {
            action: expanded ? tr("tasks.collapse") : tr("tasks.expand"),
            count: filters.length,
          })}
          aria-expanded={expanded}
          aria-controls={id}
          aria-describedby={`${id}-first`}
          onClick={(event) => {
            setPinned(!pinned);
            // Pointer activation toggles on touch without trapping the focus-open state.
            if (event.detail > 0) setFocused(false);
          }}
        >
          <span id={`${id}-first`}>
            {filters[0].label}: {filters[0].value}
          </span>
          {filters.length > 1 && (
            <span className="filter-summary-count">
              +{formatNumber(filters.length - 1)}
            </span>
          )}
        </button>
        <RemoveFilter filter={filters[0]} onRemove={remove} />
      </div>
      <ul
        id={id}
        className="filter-summary-list"
        style={area ? { top: area.head } : undefined}
        aria-label={tr("tasks.activeFilters")}
        inert={!expanded}
        aria-hidden={!expanded}
      >
        {filters.slice(1).map((filter) => (
          <motion.li
            key={filter.id ?? filter.label}
            className="filter-summary-tag"
            initial={false}
            animate={{
              x: !reduced && !expanded && direction === "right" ? -4 : 0,
              y: !reduced && !expanded && direction !== "right" ? -4 : 0,
            }}
            transition={reduced ? { duration: 0 } : filterSpring}
          >
            {filter.label}: {filter.value}
            <RemoveFilter filter={filter} onRemove={remove} />
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
