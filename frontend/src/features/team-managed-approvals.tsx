import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ManagedAgentApi } from "@/api/managed-agents";
import type { BeeApi } from "@/api/types";
import { useApi } from "@/api/context";
import type { components } from "@/api/generated/managed-agents";
import { Button } from "@/components/ui/button";
import { useLocale, t } from "@/i18n";
import { useUi } from "@/state/ui";
import { useManagedActions } from "./use-managed-actions";
import "./team-managed-approvals.css";

type TeamApproval = components["schemas"]["TeamManagedApproval"];

async function loadWorkers(api: BeeApi, teamId: string) {
  const members = new Map<string, string>();
  let offset = 0;
  while (true) {
    const page = await api.list("members", teamId, {
      role: "worker",
      limit: 100,
      offset,
    });
    for (const member of page.items) {
      if (member.role === "worker") members.set(member.agentId, member.name);
    }
    if (!page.hasMore) return members;
    if (page.nextOffset == null || page.nextOffset <= offset) {
      throw new Error(t("managed.invalidMemberPagination"));
    }
    offset = page.nextOffset;
  }
}

export function TeamManagedApprovals({
  api,
  teamId,
}: {
  api: ManagedAgentApi;
  teamId: string;
}) {
  useLocale();
  const [error, setError] = useState<unknown>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const actions = useManagedActions();
  const resourceApi = useApi();
  const retryable = actions.actions.filter(
    (action) => action.signature.startsWith("decision:") && !action.running,
  );
  const membership = useQuery({
    queryKey: ["team-managed-retry-members", teamId],
    enabled: retryable.length > 0,
    refetchInterval: 3000,
    queryFn: () => loadWorkers(resourceApi, teamId),
  });
  const query = useInfiniteQuery({
    queryKey: ["team-managed-approvals", teamId],
    queryFn: ({ pageParam }) => api.teamApprovals(teamId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 3000,
  });
  const unique = new Map<string, TeamApproval>();
  for (const page of query.isError ? [] : (query.data?.pages ?? [])) {
    for (const item of page.items) unique.set(item.approval.id, item);
  }
  const pendingActions = retryable.filter(
    (action) => !membership.isError && membership.data?.has(action.agentId),
  );
  const failure =
    error || query.error || (retryable.length > 0 && membership.error);
  if (
    !query.isPending &&
    !(retryable.length > 0 && membership.isPending) &&
    !failure &&
    unique.size === 0 &&
    pendingActions.length === 0
  )
    return null;

  async function decide(item: TeamApproval, decision: "accept" | "decline") {
    setError(null);
    setChecking(item.agent.id);
    try {
      if (!(await loadWorkers(resourceApi, teamId)).has(item.agent.id)) {
        await query.refetch();
        throw new Error(t("managed.notCurrentWorker"));
      }
      await actions.run(
        item.agent.id,
        `decision:${item.approval.id}:${decision}`,
        (key) =>
          api.decide(
            item.approval.id,
            item.approval.version,
            decision,
            key,
            teamId,
          ),
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setChecking(null);
    }
  }
  async function retry(action: (typeof pendingActions)[number]) {
    setError(null);
    setChecking(action.agentId);
    try {
      if (!(await loadWorkers(resourceApi, teamId)).has(action.agentId)) {
        await membership.refetch();
        throw new Error(t("managed.notCurrentWorker"));
      }
      await actions.run(action.agentId, action.signature, action.run);
    } catch (cause) {
      setError(cause);
    } finally {
      setChecking(null);
    }
  }
  return (
    <section
      className="team-managed-approvals"
      aria-label={t("managed.teamApprovals")}
    >
      <h3>{t("managed.teamApprovals")}</h3>
      {(query.isPending || (retryable.length > 0 && membership.isPending)) && (
        <p role="status">{t("managed.loadingApprovals")}</p>
      )}
      {failure && (
        <div role="alert" className="assistant-alert">
          {t("managed.error")}
          <details>
            <summary>{t("chat.errorDetails")}</summary>
            {String(failure)}
          </details>
        </div>
      )}
      {pendingActions.map((action) => (
        <div className="team-managed-retry" key={action.agentId}>
          <span>{membership.data?.get(action.agentId)}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={checking === action.agentId}
            onClick={() => void retry(action)}
          >
            {t("managed.retryActionButton")}
          </Button>
        </div>
      ))}
      <div className="team-managed-approval-list">
        {[...unique.values()].map((item) => {
          const blocked =
            checking === item.agent.id ||
            actions.actions.some((action) => action.agentId === item.agent.id);
          return (
            <article
              key={item.approval.id}
              className="assistant-approval team-managed-approval"
            >
              <header>
                <strong>{item.agent.name}</strong>
              </header>
              <p>{item.approval.description}</p>
              <p className="team-managed-approval-reference">
                {t("managed.request")}: {item.request.id}
              </p>
              {item.request.taskId && (
                <TeamApprovalTaskLink id={item.request.taskId} />
              )}
              <div className="assistant-approval-actions">
                <Button
                  size="sm"
                  disabled={blocked}
                  onClick={() => void decide(item, "accept")}
                >
                  {t("managed.accept")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={blocked}
                  onClick={() => void decide(item, "decline")}
                >
                  {t("managed.decline")}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {query.hasNextPage && (
        <Button
          size="sm"
          variant="ghost"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t("managed.moreApprovals")}
        </Button>
      )}
    </section>
  );
}

function TeamApprovalTaskLink({ id }: { id: string }) {
  const openTask = useUi((state) => state.openTask);
  return (
    <Button variant="link" size="sm" onClick={() => openTask(id)}>
      {t("chat.task")}: {id}
    </Button>
  );
}
