import { useMemo, useState, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Popover } from "radix-ui";
import {
  ArrowDown,
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpNarrowWide,
  ChevronRight,
  Filter,
  History,
  Layers,
  MessageSquare,
  Plus,
  Search,
  SquarePen,
  X,
} from "lucide-react";
import { useApi, useList } from "@/api/context";
import type { ManagedAgentApi, ManagedConversation } from "@/api/managed-agents";
import { useLocale, t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/relative-time";
import { useChatPanel } from "@/state/chat-panel";
import {
  SESSION_GROUP_KEYS,
  SESSION_GROUP_MAX_DEPTH,
  useSessionsSidebar,
  type SessionFilters,
  type SessionGroupKey,
} from "@/state/sessions-sidebar";
import {
  groupSessions,
  matchesSearch,
  type SessionGroup,
  type SessionNames,
} from "./session-grouping";
import "./sessions-sidebar.css";

const NARROW_QUERY = "(max-width: 850px)";
const isNarrow = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(NARROW_QUERY).matches;
const PAGE_SIZE = 50;
const groupLabel = (key: SessionGroupKey) => t(`sessions.${key}`);

export function SessionsToggle({ className }: { className?: string }) {
  useLocale();
  const api = useApi();
  const open = useSessionsSidebar((s) => s.open),
    drawer = useSessionsSidebar((s) => s.drawer),
    toggle = useSessionsSidebar((s) => s.toggle);
  if (!api.managedAgents) return null;
  return (
    <Button
      className={className}
      variant="ghost"
      size="icon"
      aria-label={t("sessions.toggle")}
      title={t("sessions.toggle")}
      aria-controls="sessions-sidebar"
      aria-expanded={isNarrow() ? drawer : open}
      onClick={() => toggle(isNarrow())}
    >
      <History aria-hidden="true" />
    </Button>
  );
}

export function SessionsSidebar() {
  const api = useApi();
  if (!api.managedAgents) return null;
  return <SessionsSidebarContent api={api.managedAgents} />;
}

function SessionsSidebarContent({ api }: { api: ManagedAgentApi }) {
  useLocale();
  const state = useSessionsSidebar();
  const { open, drawer, search, sort, groupBy, filters } = state;
  const activeId = useChatPanel((s) => s.conversationId);
  const sessions = useInfiniteQuery({
    queryKey: ["managed-sessions", filters, sort],
    queryFn: ({ pageParam }) =>
      api.sessions({
        ...filters,
        sort,
        cursor: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 5000,
    enabled: open || drawer,
  });
  const teams = useList("teams", "", { limit: 100 });
  const agents = useList("agents", "", { limit: 100 });
  const boards = useList("boards", "", { limit: 100 });
  const names = useMemo<SessionNames>(() => {
    const find = (items: { id: string; name: string }[] | undefined, id: string) =>
      items?.find((item) => item.id === id)?.name ?? t("sessions.unknown");
    return {
      team: (id) => find(teams.data?.items, id),
      agent: (id) => find(agents.data?.items, id),
      board: (id) => (id ? find(boards.data?.items, id) : t("sessions.noBoard")),
    };
  }, [teams.data, agents.data, boards.data]);
  const items = (sessions.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (item) => matchesSearch(item, search),
  );
  const tree = groupSessions(items, groupBy, names);
  const filtered =
    !!search.trim() || Object.values(filters).some((ids) => ids.length > 0);
  const choose = (item: ManagedConversation) => {
    if (!item.teamId) return;
    useChatPanel.getState().openConversation(item.teamId, item.id);
    if (isNarrow()) state.setDrawer(false);
  };
  const startNew = () => {
    const chat = useChatPanel.getState();
    const team = filters.teamIds.length === 1 ? filters.teamIds[0] : chat.teamId;
    if (team) chat.openTeam(team);
    else {
      chat.setConversation(null);
      chat.show();
    }
    if (isNarrow()) state.setDrawer(false);
  };
  const leaders = (teams.data?.items ?? [])
    .map((team) => team.leaderId)
    .filter((id, index, all) => id && all.indexOf(id) === index);
  const boardChoices = (boards.data?.items ?? []).filter(
    (board) =>
      !filters.teamIds.length ||
      (board.teamId && filters.teamIds.includes(board.teamId)),
  );
  return (
    <>
      {drawer && (
        <div
          className="sessions-backdrop"
          aria-hidden
          onClick={() => state.setDrawer(false)}
        />
      )}
      <aside
        id="sessions-sidebar"
        className="sessions-sidebar"
        aria-label={t("sessions.title")}
        data-open={open}
        data-drawer={drawer}
      >
        <header className="sessions-heading">
          <strong>{t("sessions.title")}</strong>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("sessions.newSession")}
            title={t("sessions.newSession")}
            onClick={startNew}
          >
            <SquarePen />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="sessions-close"
            aria-label={t("sessions.close")}
            title={t("sessions.close")}
            onClick={() =>
              isNarrow() ? state.setDrawer(false) : state.setOpen(false)
            }
          >
            <X />
          </Button>
        </header>
        <div className="sessions-tools">
          <label className="sessions-search">
            <Search aria-hidden />
            <input
              type="search"
              value={search}
              placeholder={t("sessions.search")}
              aria-label={t("sessions.search")}
              onChange={(event) => state.setSearch(event.target.value)}
            />
          </label>
          <div className="sessions-actions">
            <Menu
              label={t("sessions.filters")}
              icon={<Filter />}
              active={Object.values(filters).some((ids) => ids.length > 0)}
            >
              <FilterSection
                title={t("sessions.filterTeams")}
                kind="teamIds"
                options={(teams.data?.items ?? []).map((team) => ({
                  id: team.id,
                  name: team.name,
                }))}
              />
              <FilterSection
                title={t("sessions.filterBoards")}
                kind="boardIds"
                options={[
                  { id: "none", name: t("sessions.noBoard") },
                  ...boardChoices.map((board) => ({
                    id: board.id,
                    name: board.name,
                  })),
                ]}
              />
              <FilterSection
                title={t("sessions.filterAgents")}
                kind="agentIds"
                options={leaders.map((id) => ({ id, name: names.agent(id) }))}
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={!Object.values(filters).some((ids) => ids.length)}
                onClick={state.clearFilters}
              >
                {t("sessions.clearFilters")}
              </Button>
            </Menu>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${t("sessions.sort")}: ${t(sort === "updated_desc" ? "sessions.newest" : "sessions.oldest")}`}
              title={t(sort === "updated_desc" ? "sessions.newest" : "sessions.oldest")}
              onClick={() =>
                state.setSort(sort === "updated_desc" ? "updated_asc" : "updated_desc")
              }
            >
              {sort === "updated_desc" ? <ArrowDownWideNarrow /> : <ArrowUpNarrowWide />}
            </Button>
            <Menu
              label={t("sessions.groupBy")}
              icon={<Layers />}
              active={groupBy.length > 0}
            >
              <GroupingEditor value={groupBy} onChange={state.setGroupBy} />
            </Menu>
          </div>
        </div>
        <nav className="sessions-list" aria-label={t("sessions.title")}>
          {sessions.isPending && <p role="status">{t("sessions.loading")}</p>}
          {sessions.error && (
            <div role="alert" className="sessions-message">
              {t("sessions.error")}
              <Button variant="ghost" size="sm" onClick={() => void sessions.refetch()}>
                {t("sessions.retry")}
              </Button>
            </div>
          )}
          {sessions.isSuccess && items.length === 0 && (
            <p className="sessions-message">
              {t(filtered ? "sessions.noMatches" : "sessions.empty")}
            </p>
          )}
          {groupBy.length ? (
            <GroupList
              groups={tree}
              names={names}
              activeId={activeId}
              onChoose={choose}
            />
          ) : (
            <SessionItems
              items={items}
              names={names}
              activeId={activeId}
              onChoose={choose}
            />
          )}
          {sessions.hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              className="sessions-more"
              disabled={sessions.isFetchingNextPage}
              onClick={() => void sessions.fetchNextPage()}
            >
              {t("sessions.loadMore")}
            </Button>
          )}
        </nav>
      </aside>
    </>
  );
}

function Menu({
  label,
  icon,
  active,
  children,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          variant={active ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label={label}
          title={label}
          data-active={active || undefined}
        >
          {icon}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="sessions-popover"
          side="bottom"
          align="start"
          sideOffset={6}
          aria-label={label}
        >
          <h2 className="sessions-popover-title">{label}</h2>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FilterSection({
  title,
  kind,
  options,
}: {
  title: string;
  kind: keyof SessionFilters;
  options: { id: string; name: string }[];
}) {
  const selected = useSessionsSidebar((s) => s.filters[kind]);
  const toggle = useSessionsSidebar((s) => s.toggleFilter);
  if (!options.length) return null;
  return (
    <fieldset className="sessions-filter">
      <legend>{title}</legend>
      {options.map((option) => (
        <label key={option.id}>
          <input
            type="checkbox"
            checked={selected.includes(option.id)}
            onChange={() => toggle(kind, option.id)}
          />
          <span>{option.name}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function GroupingEditor({
  value,
  onChange,
}: {
  value: SessionGroupKey[];
  onChange: (value: SessionGroupKey[]) => void;
}) {
  useLocale();
  const remaining = SESSION_GROUP_KEYS.filter((key) => !value.includes(key));
  const move = (index: number, delta: number) => {
    const next = [...value];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return (
    <div className="sessions-grouping">
      {value.length === 0 && <p>{t("sessions.noGrouping")}</p>}
      <ol>
        {value.map((key, index) => {
          const name = groupLabel(key);
          return (
            <li key={key}>
              <span className="sessions-level">{index + 1}</span>
              <span>{name}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("sessions.moveUp", { name })}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("sessions.moveDown", { name })}
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("sessions.removeLevel", { name })}
                onClick={() => onChange(value.filter((item) => item !== key))}
              >
                <X />
              </Button>
            </li>
          );
        })}
      </ol>
      {value.length < SESSION_GROUP_MAX_DEPTH && remaining.length > 0 && (
        <div className="sessions-add-level">
          <Plus aria-hidden />
          <select
            aria-label={t("sessions.addLevel")}
            value=""
            onChange={(event) =>
              onChange([...value, event.target.value as SessionGroupKey])
            }
          >
            <option value="">{t("sessions.addLevel")}</option>
            {remaining.map((key) => (
              <option key={key} value={key}>
                {groupLabel(key)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

type ListProps = {
  names: SessionNames;
  activeId: string | null;
  onChoose: (item: ManagedConversation) => void;
};

function GroupList({ groups, ...props }: ListProps & { groups: SessionGroup[] }) {
  return (
    <ul className="sessions-groups" role="list">
      {groups.map((group) => (
        <GroupNode key={group.key} group={group} {...props} />
      ))}
    </ul>
  );
}

function GroupNode({ group, ...props }: ListProps & { group: SessionGroup }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <li className="sessions-group" data-kind={group.kind}>
      <button
        type="button"
        className="sessions-group-heading"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronRight aria-hidden className="sessions-chevron" />
        <span className="sessions-group-kind">{groupLabel(group.kind)}</span>
        <span className="sessions-group-name" title={group.label}>
          {group.label}
        </span>
        <span className="sessions-count">{group.count}</span>
      </button>
      {!collapsed &&
        (group.groups.length ? (
          <GroupList groups={group.groups} {...props} />
        ) : (
          <SessionItems items={group.items} {...props} />
        ))}
    </li>
  );
}

function SessionItems({
  items,
  names,
  activeId,
  onChoose,
}: ListProps & { items: ManagedConversation[] }) {
  return (
    <ul className="sessions-items" role="list">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="sessions-item"
            aria-current={item.id === activeId ? "true" : undefined}
            onClick={() => onChoose(item)}
          >
            <MessageSquare aria-hidden className="sessions-item-icon" />
            <span className="sessions-item-title" title={item.title}>
              {item.title}
            </span>
            <span className="sessions-item-meta">
              <span>{names.agent(item.agentId)}</span>
              <span aria-hidden>·</span>
              <span>{names.board(item.boardId)}</span>
              <span aria-hidden>·</span>
              <RelativeTime value={item.updatedAt} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
