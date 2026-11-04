import { currentUrl, navigate } from "@/routing/location";
import { useId } from "react";
import { ExternalLink } from "lucide-react";
import { useLocale, t as tr } from "@/i18n";
import { usePageSize, useUrlState } from "@/routing/query";
import { FilterBar } from "@/components/filter-bar";
import { FilterPopover } from "@/components/filter-controls";
import { Choice, Search, formatDate, safeUrl } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { DetailRecordList } from "./detail-record-list";
import { chatDateRange } from "./chat-date-range";
export function AgentChats({ agentId }: { agentId: string }) {
  useLocale();
  const [label, setLabel] = useUrlState<string>("chats.label", "");
  const [harness, setHarness] = useUrlState<string>("chats.harness", "");
  const [archived, setArchived] = useUrlState<string>(
    "chats.archived",
    "false",
    {
      values: ["false", "true"],
    },
  );
  const [from, setFrom] = useUrlState<string>("chats.createdFrom", "");
  const [until, setUntil] = useUrlState<string>("chats.createdUntil", "");
  const harnessId = useId();
  const range = chatDateRange(from, until);
  const active = !!(label || harness || archived !== "false" || from || until);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const clearKeys = (keys: string[]) => {
    const [path, query] = currentUrl().split("?");
    const params = new URLSearchParams(query);
    for (const key of [...keys, "offset", "window"])
      params.delete(`chats.${key}`);
    navigate(path + (params.size ? `?${params}` : ""));
  };
  const clear = () =>
    clearKeys(["label", "harness", "archived", "createdFrom", "createdUntil"]);
  const limit = usePageSize("chats", 10);
  return (
    <div className="detail-section">
      <p className="muted-copy">
        {tr(
          "agents.recordedExternalReferencesTheyDoNotIndicateRunningSessions",
        )}
      </p>
      <FilterBar
        search={
          <Search
            label={tr("agents.chatName")}
            value={label}
            onChange={setLabel}
          />
        }
        active={active}
        onClear={clear}
      >
        <FilterPopover
          label={tr("agents.chatHarness")}
          active={!!harness}
          summary={harness}
          onClear={() => setHarness("")}
        >
          <label htmlFor={harnessId}>{tr("agents.chatHarness")}</label>
          <Input
            id={harnessId}
            value={harness}
            maxLength={100}
            onChange={(e) => setHarness(e.target.value)}
          />
          <p className="small-note">{tr("agents.chatHarnessExact")}</p>
        </FilterPopover>
        <Choice
          label={tr("agents.chatRegistry")}
          value={archived}
          onChange={setArchived}
          options={[
            { value: "false", label: tr("agents.active") },
            { value: "true", label: tr("common.archived") },
          ]}
        />
        <FilterPopover
          label={tr("agents.chatCreatedPeriod")}
          active={!!(from || until)}
          summary={[from, until].filter(Boolean).join(" – ")}
          onClear={() => clearKeys(["createdFrom", "createdUntil"])}
        >
          <label className="date-filter">
            {tr("agents.chatCreatedFrom")}
            <input
              type="date"
              aria-label={tr("agents.chatCreatedFrom")}
              value={from}
              max={until || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="date-filter">
            {tr("agents.chatCreatedUntil")}
            <input
              type="date"
              aria-label={tr("agents.chatCreatedUntil")}
              value={until}
              min={from || undefined}
              onChange={(e) => setUntil(e.target.value)}
            />
          </label>
          <p className="small-note">
            {tr("agents.chatDateTimezone", { timezone })}
          </p>
        </FilterPopover>
      </FilterBar>
      {!range.valid ? (
        <p role="alert">{tr("agents.chatInvalidPeriod")}</p>
      ) : (
        <DetailRecordList
          resource="chats"
          scope={agentId}
          filters={{
            limit,
            label: label || undefined,
            harness: harness || undefined,
            archived: archived === "true",
            createdFrom: range.createdFrom,
            createdBefore: range.createdBefore,
          }}
          empty={tr(
            active ? "agents.noChatsMatchFilters" : "agents.noChatReferences",
          )}
          countLabel={tr("agents.chats")}
        >
          {(c) => (
            <article className="record" key={c.id}>
              <h3>{c.label}</h3>
              <p className="small-note">
                {c.harness} · {c.externalId} · {formatDate(c.updatedAt)}
              </p>
              {safeUrl(c.url) && (
                <a href={safeUrl(c.url)} target="_blank" rel="noreferrer">
                  {tr("agents.openReference")} <ExternalLink size={14} />
                </a>
              )}
            </article>
          )}
        </DetailRecordList>
      )}
    </div>
  );
}
