import { useLocale, t as tr } from "@/i18n";

import { useUrlState, usePageSize } from "@/routing/query";
import type { ComponentProps } from "react";
import { TeamFilter } from "./team-filter";
import { useEntity, useList } from "@/api/context";
import { Choice, Pager, QueryState } from "./shared";
import { Input } from "./ui/input";
import { useCompactFilters } from "./filter-context";
import { FilterPopover, FilterOptions } from "./filter-controls";
/** A searchable, paginated selector: options beyond the first page remain reachable. */
function PaginatedEntityFilter({
  resource,
  label,
  value,
  onChange,
  scopeId = "Executor",
}: {
  resource: "agents" | "teams";
  label: string;
  value: string;
  onChange: (id: string) => void;
  scopeId?: string;
}) {
  useLocale();
  const compact = useCompactFilters();
  // Preserve the historical query key while keeping translated labels out of URLs.
  const scope = `selector-${resource}-${scopeId}`;
  const [name, setName] = useUrlState<string>(`${scope}.name`, ""),
    [offset, setOffset] = useUrlState<number>(`${scope}.offset`, 0);
  const limit = usePageSize(scope, 25);
  const q = useList(resource, "", {
    name: name || undefined,
    offset,
    limit,
    sortBy: "name",
  });
  const selected = useEntity(resource, value);
  const options =
    q.data?.items.map((i) => ({ value: i.id, label: i.name })) ?? [];
  if (value && !options.some((o) => o.value === value))
    options.unshift({
      value,
      label: selected.data?.name ?? tr("common.selected"),
    });
  const Options = compact ? FilterOptions : Choice;
  const content = (
    <div className="entity-filter">
      <Input
        aria-label={tr("common.searchOptions", { label: label })}
        value={name}
        autoFocus={compact}
        onChange={(e) => {
          setName(e.target.value);
          setOffset(0);
        }}
        onKeyDown={(e) => {
          if (compact && e.key === "ArrowDown") {
            e.preventDefault();
            e.currentTarget.parentElement
              ?.querySelector<HTMLElement>('[role="radio"]')
              ?.focus();
          }
        }}
        placeholder={tr("common.filterOptions")}
      />
      <Options
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        all={tr("common.all")}
      />
      {(q.data?.hasMore || offset > 0 || name) && (
        <div className="selector-pages">
          <QueryState query={q}>
            {q.data && <Pager page={q.data} onOffset={setOffset} />}
          </QueryState>
        </div>
      )}
      {q.error && <QueryState query={q}>{null}</QueryState>}
    </div>
  );
  return compact ? (
    <FilterPopover
      label={label}
      onClear={() => onChange("")}
      active={!!value}
      summary={
        options.find((option) => option.value === value)?.label ||
        tr("common.all")
      }
    >
      {content}
    </FilterPopover>
  ) : (
    content
  );
}
export function EntityFilter(
  props: ComponentProps<typeof PaginatedEntityFilter>,
) {
  useLocale();
  return props.resource === "teams" ? (
    <TeamFilter {...props} />
  ) : (
    <PaginatedEntityFilter {...props} />
  );
}
