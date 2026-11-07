import { useLocale, t as tr } from "@/i18n";

import { TaskFilters } from "./task-filter-layout";
import { FilterBar } from "@/components/filter-bar";
import { TaskParticipantFilter } from "./task-participant-filter";
import { useLayoutEffect, useRef } from "react";
import { useEntity } from "@/api/context";
import type { Resources } from "@/api/types";
import { AgentAvatar } from "@/components/agent-avatar";
import { Markdown } from "@/components/markdown";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Failure, NoData, Search, Choice } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useInfiniteScroll } from "@/components/use-infinite-scroll";
import { useUi } from "@/state/ui";
import { useTaskConversation } from "./use-task-conversation";
import { conversationAuthor } from "./task-conversation-author";
import { useConversationAnchor } from "./conversation-anchor";
import { ConversationTimestamp } from "./conversation-timestamp";
import "./task-conversation.css";
import { ConversationComposer } from "./conversation-composer";
import { ConversationDeliveryState } from "./conversation-delivery-state";

export function TaskConversation({
  taskId,
  onReady,
}: {
  taskId: string;
  onReady?: () => void;
}) {
  useLocale();
  const state = useTaskConversation(taskId);
  useLayoutEffect(() => {
    if (state.query.data || state.query.error || state.metadata.error)
      onReady?.();
  }, [state.query.data, state.query.error, state.metadata.error, onReady]);
  const clear = () => {
    state.setActorId("");
    state.setActorKind("");
    state.setText("");
  };
  return (
    <>
      <TaskFilters active={!!(state.actorId || state.actorKind || state.text)}>
        <FilterBar
          active={!!(state.actorId || state.actorKind || state.text)}
          onClear={clear}
          search={
            <Search
              label={tr("tasks.searchConversationText")}
              value={state.text}
              onChange={state.setText}
            />
          }
        >
          <Choice
            all={tr("common.all")}
            label={tr("tasks.authorType")}
            value={state.actorKind}
            onChange={(value) => {
              state.setActorKind(value);
              if (value !== "agent") state.setActorId("");
            }}
            options={[
              { value: "agent", label: tr("common.agents") },
              { value: "human", label: tr("tasks.people") },
            ]}
          />
          <TaskParticipantFilter
            taskId={taskId}
            actorId={state.actorId}
            actorKind={state.actorKind}
            onChange={(id, kind) => {
              state.setActorId(id);
              state.setActorKind(kind);
            }}
          />
        </FilterBar>
      </TaskFilters>
      {!!state.text && (
        <p className="small-note">
          {tr("tasks.literalMatchInTheFullTextCaseSensitive")}
        </p>
      )}
      <ConversationWindow key={state.identity} state={state} />
      <ConversationComposer key={taskId} taskId={taskId} />
    </>
  );
}
function ConversationWindow({
  state,
}: {
  state: ReturnType<typeof useTaskConversation>;
}) {
  useLocale();
  const { query, metadata, items, identity, explicit, following } = state;
  const list = useRef<HTMLElement>(null),
    before = useRef<HTMLDivElement>(null),
    after = useRef<HTMLDivElement>(null);
  const anchor = useConversationAnchor(list, identity, query.data);
  const previous = (explicitRequest = false) => {
    anchor.capture(explicitRequest);
    return query.fetchPreviousPage({ cancelRefetch: false });
  };
  const next = () => {
    anchor.capture();
    return query.fetchNextPage({ cancelRefetch: false });
  };
  useInfiniteScroll({
    sentinel: before,
    getRoot: () =>
      anchor.root() === document.scrollingElement ? null : anchor.root(),
    identity,
    progress: items[0]?.id ?? "",
    hasMore: !!query.hasPreviousPage,
    fetching: query.isFetching,
    error: query.error,
    loadMore: previous,
  });
  useInfiniteScroll({
    sentinel: after,
    getRoot: () =>
      anchor.root() === document.scrollingElement ? null : anchor.root(),
    identity,
    progress: items.at(-1)?.id ?? "",
    hasMore: !!query.hasNextPage,
    fetching: query.isFetching,
    error: query.error,
    loadMore: next,
  });
  const error = query.error ?? metadata.error;
  return (
    <section
      ref={list}
      className="task-conversation"
      aria-label={tr("tasks.taskConversation")}
    >
      <div ref={before} className="conversation-page-slot">
        {query.hasPreviousPage && (
          <Button
            variant="ghost"
            disabled={query.isFetching}
            onClick={() => void previous(true)}
          >
            {tr("tasks.loadEarlier")}
          </Button>
        )}
        {(query.isFetchingPreviousPage ||
          query.isPending ||
          (metadata.isFetching && !items.length)) && (
          <LoadingIndicator label={tr("tasks.loadingConversation")} compact />
        )}
      </div>
      {!!error && (
        <Failure
          error={error}
          retry={() =>
            void (query.isFetchPreviousPageError
              ? previous()
              : query.isFetchNextPageError
                ? next()
                : metadata.error
                  ? metadata.refetch()
                  : query.refetch())
          }
        />
      )}
      {!query.isPending && !error && !items.length && (
        <NoData title={tr("tasks.noCommentsRecorded")} />
      )}
      {items.map((item) => (
        <ConversationMessage key={item.id} item={item} />
      ))}
      <div ref={after} className="conversation-page-slot">
        {query.isFetchingNextPage && (
          <LoadingIndicator label={tr("tasks.loadingNextMessages")} compact />
        )}
        {(query.hasNextPage || following > 0) && (
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => {
              anchor.capture();
              if (!explicit) anchor.followEnd();
              void query.fetchNextPage({ cancelRefetch: false });
            }}
          >
            {explicit ? tr("tasks.viewNextMessages") : tr("tasks.newMessages")}
            {following > 0 ? ` (${following})` : ""}
          </Button>
        )}
      </div>
      <span className="sr-only" role="status">
        {following > 0
          ? tr("tasks.followingMessages", { count: following })
          : ""}
      </span>
    </section>
  );
}
function ConversationMessage({ item }: { item: Resources["comments"] }) {
  useLocale();
  const profile = useEntity(
    "agents",
    item.actorKind === "agent" ? (item.actorId ?? "") : "",
  );
  const author = conversationAuthor(item, profile.data);
  const open = useUi((state) => state.openAgent);
  // Keep the row unpositioned until its cached author resolves; never animate a side swap.
  const pending =
    item.actorKind === "agent" && !!item.actorId && profile.isPending;
  return (
    <article
      data-comment-id={item.id}
      data-side={author.leader ? "right" : "left"}
      className="conversation-message"
      style={pending ? { visibility: "hidden" } : undefined}
    >
      <header>
        {profile.data && !profile.data.deletedAt ? (
          <AgentAvatar agent={profile.data} />
        ) : (
          <span className="conversation-avatar" aria-hidden="true">
            {item.actorKind === "human" ? "P" : "?"}
          </span>
        )}
        <div className="conversation-author">
          {profile.data && !profile.data.deletedAt ? (
            <button onClick={() => open(profile.data!.id)}>
              {author.name}
            </button>
          ) : (
            <strong>{author.name}</strong>
          )}
          <span>{author.role}</span>
        </div>
        <ConversationTimestamp value={item.createdAt} />
      </header>
      <Markdown headingOffset={2}>{item.body}</Markdown>
      <ConversationDeliveryState taskId={item.taskId} commentId={item.id}/>
    </article>
  );
}
