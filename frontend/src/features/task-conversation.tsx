import { FilterBar } from "@/components/filter-bar";
import { EntityFilter } from "@/components/entity-filter";
import { useRef } from "react";
import { useEntity } from "@/api/context";
import type { Resources } from "@/api/types";
import { AgentAvatar } from "@/components/agent-avatar";
import { Markdown } from "@/components/markdown";
import { LoadingIndicator } from "@/components/loading-indicator";
import {
  Failure,
  NoData,
  formatDate,
  Search,
  Choice,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useInfiniteScroll } from "@/components/use-infinite-scroll";
import { useUi } from "@/state/ui";
import { useTaskConversation } from "./use-task-conversation";
import { conversationAuthor } from "./task-conversation-author";
import { useConversationAnchor } from "./conversation-anchor";
import "./task-conversation.css";

export function TaskConversation({ taskId }: { taskId: string }) {
  const state = useTaskConversation(taskId);
  const clear = () => {
    state.setActorId("");
    state.setActorKind("");
    state.setText("");
  };
  return (
    <>
      <FilterBar
        active={!!(state.actorId || state.actorKind || state.text)}
        onClear={clear}
        search={
          <Search
            label="Buscar texto na conversa"
            value={state.text}
            onChange={state.setText}
          />
        }
      >
        <Choice
          all="Todos"
          label="Tipo de autor"
          value={state.actorKind}
          onChange={(value) => {
            state.setActorKind(value);
            if (value !== "agent") state.setActorId("");
          }}
          options={[
            { value: "agent", label: "Agentes" },
            { value: "human", label: "Pessoas" },
          ]}
        />
        {state.actorKind !== "human" && (
          <EntityFilter
            resource="agents"
            label="Autor da fala"
            value={state.actorId}
            onChange={(value) => {
              state.setActorId(value);
            }}
          />
        )}
      </FilterBar>
      {!!state.text && (
        <p className="small-note">
          Trecho literal no texto completo; diferencia mai�sculas e min�sculas.
        </p>
      )}
      <ConversationWindow key={state.identity} state={state} />
    </>
  );
}
function ConversationWindow({
  state,
}: {
  state: ReturnType<typeof useTaskConversation>;
}) {
  const { query, metadata, items, identity, explicit, following } = state;
  const list = useRef<HTMLElement>(null),
    before = useRef<HTMLDivElement>(null),
    after = useRef<HTMLDivElement>(null);
  const anchor = useConversationAnchor(list, identity, query.data, !explicit);
  const previous = () => {
    anchor.capture();
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
      aria-label="Conversa da tarefa"
    >
      <div ref={before} className="conversation-page-slot">
        {query.hasPreviousPage && (
          <Button
            variant="ghost"
            disabled={query.isFetching}
            onClick={() => void previous()}
          >
            Carregar anteriores
          </Button>
        )}
        {(query.isFetchingPreviousPage ||
          query.isPending ||
          (metadata.isFetching && !items.length)) && (
          <LoadingIndicator label="Carregando conversa" compact />
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
        <NoData title="Nenhum comentário registrado" />
      )}
      {items.map((item) => (
        <ConversationMessage key={item.id} item={item} />
      ))}
      <div ref={after} className="conversation-page-slot">
        {query.isFetchingNextPage && (
          <LoadingIndicator label="Carregando mensagens seguintes" compact />
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
            {explicit ? "Ver mensagens seguintes" : "Novas mensagens"}
            {following > 0 ? ` (${following})` : ""}
          </Button>
        )}
      </div>
      <span className="sr-only" role="status">
        {following > 0 ? `${following} mensagens seguintes disponíveis` : ""}
      </span>
    </section>
  );
}
function ConversationMessage({ item }: { item: Resources["comments"] }) {
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
        <time dateTime={item.createdAt} title={formatDate(item.createdAt)}>
          {formatDate(item.createdAt)}
        </time>
      </header>
      <Markdown headingOffset={2}>{item.body}</Markdown>
    </article>
  );
}
