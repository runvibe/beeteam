import { useLocale, t as tr } from "@/i18n";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { nextPageOffset } from "@/api/page-continuation";
import { categories } from "./attachment-item";
import { attachmentCategory } from "./attachment-presentation";
import type { Resources } from "@/api/types";
import { useUrlState, booleanValues } from "@/routing/query";
import { FilterBar } from "@/components/filter-bar";
import { FilterPopover } from "@/components/filter-controls";
import { Choice, Search } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { TaskFilters } from "./task-filter-layout";
import { TaskRecordList } from "./task-record-list";

export function AttachmentRecords({
  taskId,
  children,
}: {
  taskId: string;
  children: (row: Resources["attachments"]) => ReactNode;
}) {
  useLocale();
  const [fileName, setName] = useUrlState<string>("attachments.fileName", "");
  const [mediaType, setType] = useUrlState<string>("attachments.mediaType", "");
  const [includeRemoved, setRemoved] = useUrlState<string>(
    "attachments.includeRemoved",
    "false",
    { values: booleanValues },
  );
  const active = !!fileName || !!mediaType || includeRemoved === "true";
  return (
    <div className="detail-section">
      <TaskFilters active={active}>
        <FilterBar
          active={active}
          onClear={() => {
            setName("");
            setType("");
            setRemoved("false");
          }}
          search={
            <Search
              label={tr("files.fileName")}
              value={fileName}
              onChange={setName}
            />
          }
        >
          <FilterPopover
            label={tr("files.fileType")}
            summary={mediaType || tr("files.allTypes")}
            active={!!mediaType}
            onClear={() => setType("")}
          >
            <MediaTypeInput
              taskId={taskId}
              includeRemoved={includeRemoved === "true"}
              value={mediaType}
              onApply={setType}
            />
          </FilterPopover>
          <Choice
            label={tr("files.removedFiles")}
            value={includeRemoved}
            onChange={setRemoved}
            options={[
              { value: "false", label: tr("files.availableOnly") },
              { value: "true", label: tr("files.includeRemoved") },
            ]}
          />
        </FilterBar>
      </TaskFilters>
      <TaskRecordList
        resource="attachments"
        scope={taskId}
        filters={{
          limit: 10,
          fileName: fileName || undefined,
          mediaType: mediaType || undefined,
          includeRemoved: includeRemoved === "true",
        }}
        empty={tr("files.noFilesFound")}
        emptyDescription={tr("files.adjustFiltersOrWaitForFilesToBeRecordedOn")}
      >
        {children}
      </TaskRecordList>
    </div>
  );
}
function MediaTypeInput({
  taskId,
  includeRemoved,
  value,
  onApply,
}: {
  taskId: string;
  includeRemoved: boolean;
  value: string;
  onApply: (value: string) => void;
}) {
  useLocale();
  const id = useId();
  const [draft, setDraft] = useState(value);
  const api = useApi();
  const types = useQuery({
    queryKey: ["attachments", taskId, "mime-choices", includeRemoved],
    queryFn: async ({ signal }) => {
      const pages = [];
      const found = new Map<string, string>();
      let offset: number | undefined = 0;
      while (offset !== undefined) {
        const page = await api.list(
          "attachments",
          taskId,
          { offset, limit: 100, includeRemoved },
          signal,
        );
        pages.push(page);
        for (const row of page.items)
          found.set(row.mediaType, row.originalName);
        offset = nextPageOffset(page, pages, (row) => row.id);
      }
      return [...found].sort(([a], [b]) => a.localeCompare(b));
    },
  });
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    const next = draft.trim();
    if (
      next === value ||
      (next &&
        !next
          .split(",")
          .every((mime) => /^[^\s/,;]+\/[^\s/,;]+$/.test(mime.trim())))
    )
      return;
    const timer = setTimeout(() => onApply(next), 300);
    return () => clearTimeout(timer);
  }, [draft, value, onApply]);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft.trim());
      }}
    >
      {!!types.data?.length && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={tr("files.typesPresentInFiles")}
        >
          {types.data.map(([mime, name]) => {
            const Icon = categories[attachmentCategory(mime, name)].icon;
            return (
              <Button
                key={mime}
                type="button"
                size="sm"
                variant={
                  value
                    .split(",")
                    .map((v) => v.trim().toLowerCase())
                    .includes(mime.toLowerCase())
                    ? "secondary"
                    : "outline"
                }
                aria-label={tr("files.filterMime", { mime: mime })}
                title={mime}
                aria-pressed={value
                  .split(",")
                  .map((v) => v.trim().toLowerCase())
                  .includes(mime.toLowerCase())}
                onClick={() => {
                  const selected = value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                  const next = selected.some(
                    (v) => v.toLowerCase() === mime.toLowerCase(),
                  )
                    ? selected.filter(
                        (v) => v.toLowerCase() !== mime.toLowerCase(),
                      )
                    : [...selected, mime];
                  const text = next.join(", ");
                  setDraft(text);
                  onApply(text);
                }}
              >
                <Icon aria-hidden="true" />
                <span>
                  {name.includes(".")
                    ? name.split(".").at(-1)!.toUpperCase()
                    : mime.split("/").at(-1)}
                </span>
              </Button>
            );
          })}
        </div>
      )}
      {types.isPending && <span role="status">{tr("files.loadingTypes")}</span>}
      {types.isError && (
        <span role="status">
          {tr("files.couldNotLoadTypesEnterTheMimeTypeBelow")}
        </span>
      )}
      <Field>
        <FieldLabel htmlFor={id}>{tr("files.exactMimeType")}</FieldLabel>
        <Input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={200}
          pattern={String.raw`[^\s\/,;]+/[^\s\/,;]+(\s*,\s*[^\s\/,;]+/[^\s\/,;]+)*`}
          placeholder="application/pdf"
        />
        <FieldDescription>
          {tr("files.separateTypesWithCommasForExampleApplicationPdfImagePng")}
        </FieldDescription>
      </Field>
    </form>
  );
}
