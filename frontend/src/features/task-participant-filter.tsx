import { message, useLocale, t as tr } from "@/i18n";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { ApiError, type TaskParticipant } from "@/api/types";
import { FilterPopover, FilterOptions } from "@/components/filter-controls";
import { Input } from "@/components/ui/input";
import { Failure } from "@/components/shared";
import { LoadingIndicator } from "@/components/loading-indicator";

export function TaskParticipantFilter({
  taskId,
  actorId,
  actorKind,
  onChange,
}: {
  taskId: string;
  actorId: string;
  actorKind: string;
  onChange: (id: string, kind: "" | "human" | "agent") => void;
}) {
  useLocale();
  const api = useApi();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["task-participants", taskId],
    queryFn: async ({ signal }) => {
      const all = new Map<string, TaskParticipant>();
      let offset = 0;
      while (true) {
        const page = await api.participants(
          taskId,
          { offset, limit: 100 },
          signal,
        );
        for (const item of page.items)
          all.set(`${item.actorKind}:${item.actorId}`, item);
        if (!page.hasMore) return [...all.values()];
        if (
          page.nextOffset === null ||
          page.nextOffset <= offset ||
          !page.items.length
        )
          throw new ApiError(
            502,
            "invalid_pagination",
            message("tasks.theParticipantListReturnedInvalidPagination"),
          );
        offset = page.nextOffset;
      }
    },
  });
  const options = (query.data ?? [])
    .filter((item) => !actorKind || item.actorKind === actorKind)
    .map((item) => ({
      value: item.actorKind === "human" ? "human" : item.actorId!,
      label:
        item.actorKind === "human"
          ? tr("tasks.peopleWithoutIndividualIdentification")
          : `${item.agentName || tr("agents.unnamedAgent", { id: item.actorId })} ${item.agentDeleted ? tr("tasks.deleted") : item.agentArchived ? tr("tasks.archived2") : ""}`.trim(),
    }));
  const value = actorKind === "human" ? "human" : actorId;
  const selected = options.find((item) => item.value === value)?.label;
  const visible = options.filter((item) =>
    item.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <FilterPopover
      label={tr("tasks.speaker")}
      active={!!value}
      summary={
        selected || (value ? tr("tasks.selectedParticipant") : tr("common.all"))
      }
      onClear={() =>
        onChange("", actorKind === "human" ? "" : (actorKind as "" | "agent"))
      }
    >
      <Input
        aria-label={tr("tasks.searchParticipantsInThisTask")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={tr("tasks.filterParticipants")}
      />
      {query.isPending && (
        <LoadingIndicator label={tr("tasks.loadingParticipants")} />
      )}
      {query.error ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <FilterOptions
            label={tr("tasks.speaker")}
            value={value}
            all={tr("common.all")}
            options={visible}
            onChange={(id) =>
              onChange(
                id === "human" ? "" : id,
                id === "human"
                  ? "human"
                  : id
                    ? "agent"
                    : actorKind === "human"
                      ? ""
                      : (actorKind as "" | "agent"),
              )
            }
          />
          {!query.isPending && !visible.length && (
            <p className="small-note">
              {tr("tasks.noParticipantsMatchTheSearch")}
            </p>
          )}
        </>
      )}
    </FilterPopover>
  );
}
