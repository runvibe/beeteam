import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { usePageSize, useUrlState } from "@/routing/query";
import { useLocation } from "@/routing/location";
import { nextPageOffset } from "@/api/page-continuation";

// Retain the initial window across tab unmounts; query cache owns loaded pages.
const starts = new Map<string, number>();
export function useTaskConversation(taskId: string) {
  const api = useApi();
  const location = useLocation();
  const limit = usePageSize("comments", 10);
  const [text, setText] = useUrlState<string>("comments.text", "");
  const [actorKind, setActorKind] = useUrlState<string>(
    "comments.actorKind",
    "",
    { values: ["", "human", "agent"] },
  );
  const authorFilters = {
    actorId: undefined as string | undefined,
    actorKind: (actorKind || undefined) as "human" | "agent" | undefined,
    text: text || undefined,
  };
  const [actorId, setActorId] = useUrlState<string>("comments.actorId", "", {
    validate: (value) =>
      !value ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  });
  const [offset] = useUrlState<number>("comments.offset", 0);
  const explicit = new URLSearchParams(location.split("?")[1]).has(
    "comments.offset",
  );
  const identity = JSON.stringify([
    taskId,
    actorId,
    actorKind,
    text,
    limit,
    explicit ? offset : "latest",
  ]);
  const [start, setStart] = useState<{
    identity: string;
    offset: number;
  } | null>(() => {
    const saved = starts.get(identity);
    return explicit || saved !== undefined
      ? { identity, offset: explicit ? offset : saved! }
      : null;
  });
  const metadata = useQuery({
    queryKey: ["comments", taskId, "latest-count", actorId, actorKind, text],
    queryFn: ({ signal }) =>
      api.list(
        "comments",
        taskId,
        {
          ...authorFilters,
          actorId: actorId || undefined,
          offset: 0,
          limit: 1,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
        signal,
      ),
    enabled: !explicit,
  });
  useEffect(() => {
    if (start?.identity === identity) return;
    const saved = starts.get(identity);
    if (!explicit && saved === undefined && !metadata.data) return;
    const initial = explicit
      ? offset
      : (saved ?? Math.max(0, (metadata.data?.total ?? 0) - limit));
    starts.set(identity, initial);
    if (starts.size > 128) starts.delete(starts.keys().next().value!);
    setStart({ identity, offset: initial });
  }, [identity, explicit, offset, limit, metadata.data, start]);
  const initial = start?.identity === identity ? start.offset : undefined;
  const query = useInfiniteQuery({
    queryKey: [
      "comments",
      taskId,
      "conversation",
      actorId,
      actorKind,
      text,
      limit,
      initial,
    ],
    enabled: initial !== undefined,
    initialPageParam: { offset: initial ?? 0, limit },
    queryFn: ({ pageParam, signal }) =>
      api.list(
        "comments",
        taskId,
        {
          ...pageParam,
          ...authorFilters,
          actorId: actorId || undefined,
          sortBy: "createdAt",
          sortOrder: "asc",
        },
        signal,
      ),
    getNextPageParam: (last, pages) => {
      const next = nextPageOffset(last, pages, (item) => item.id);
      return next === undefined ? undefined : { offset: next, limit };
    },
    getPreviousPageParam: (first) =>
      first.offset > 0
        ? {
            offset: Math.max(0, first.offset - limit),
            limit: Math.min(limit, first.offset),
          }
        : undefined,
  });
  const items = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]) ?? [],
    ).values(),
  ].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const last = query.data?.pages.at(-1);
  const following = !last
    ? 0
    : Math.max(
        0,
        (metadata.data?.total ?? last?.total ?? 0) -
          ((last?.offset ?? 0) + (last?.items.length ?? 0)),
      );
  return {
    query,
    metadata,
    items,
    identity,
    explicit,
    following,
    actorId,
    setActorId,
    actorKind,
    setActorKind,
    text,
    setText,
  };
}
