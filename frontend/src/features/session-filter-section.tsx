import { useState } from "react";
import { useList } from "@/api/context";
import { Pager, QueryState } from "@/components/shared";
import { t } from "@/i18n";
import {
  SESSION_FILTER_MAX_VALUES,
  useSessionsSidebar,
  type SessionFilters,
} from "@/state/sessions-sidebar";

type Resource = "teams" | "boards" | "agents";

export function SessionFilterSection({
  title,
  searchLabel,
  kind,
  resource,
}: {
  title: string;
  searchLabel: string;
  kind: keyof SessionFilters;
  resource: Resource;
}) {
  const selected = useSessionsSidebar((state) => state.filters[kind]);
  const toggle = useSessionsSidebar((state) => state.toggleFilter);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [offset, setOffset] = useState(0);
  const entries = useList(resource, "", {
    limit: 25,
    offset,
    sortBy: "name",
    archived,
    ...(search.trim() ? { name: search.trim() } : {}),
  });
  const options = entries.data?.items ?? [];
  const noBoard = t("sessions.noBoard");
  const limitReached = selected.length >= SESSION_FILTER_MAX_VALUES;
  return (
    <fieldset className="sessions-filter">
      <legend>{title}</legend>
      <input
        className="sessions-filter-search"
        type="search"
        maxLength={200}
        aria-label={searchLabel}
        placeholder={searchLabel}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setOffset(0);
        }}
      />
      <label className="sessions-filter-archived">
        <input
          type="checkbox"
          checked={archived}
          onChange={(event) => {
            setArchived(event.target.checked);
            setOffset(0);
          }}
        />
        <span>{t("sessions.archivedOnly")}</span>
      </label>
      <QueryState query={entries}>
        <div className="sessions-filter-options">
          {resource === "boards" &&
            (!search.trim() || noBoard.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) && (
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes("none")}
                  disabled={limitReached && !selected.includes("none")}
                  onChange={() => toggle(kind, "none")}
                />
                <span>{noBoard}</span>
              </label>
            )}
          {options.map((option) => (
            <label key={option.id}>
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                disabled={limitReached && !selected.includes(option.id)}
                onChange={() => toggle(kind, option.id)}
              />
              <span>{option.name}</span>
            </label>
          ))}
        </div>
        {entries.data && (entries.data.hasMore || entries.data.offset > 0) && (
          <Pager page={entries.data} onOffset={setOffset} />
        )}
      </QueryState>
      {limitReached && <p className="sessions-filter-limit">{t("sessions.filterLimit")}</p>}
    </fieldset>
  );
}
