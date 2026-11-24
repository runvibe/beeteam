import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi, useEntity } from "@/api/context";
import { ApiError } from "@/api/types";
import { t as tr, useLocale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Failure } from "@/components/shared";
import {
  mentionToken,
  selectedRecipients,
  type MentionSelection,
} from "./conversation-mentions";

export function ConversationComposer({ taskId }: { taskId: string }) {
  useLocale();
  const api = useApi(),
    client = useQueryClient();
  const task = useEntity("tasks", taskId);
  const board = useQuery({
    queryKey: ["boards", task.data?.boardId],
    enabled: !!task.data,
    queryFn: () => api.get("boards", task.data!.boardId),
  });
  const [body, setBody] = useState(""),
    [selections, setSelections] = useState<MentionSelection[]>([]),
    [sending, setSending] = useState(false),
    [error, setError] = useState<unknown>(null);
  const [offset, setOffset] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const query = body.match(/(?:^|\s)@([^\s@]*)$/)?.[1];
  const agents = useQuery({
    queryKey: [
      "conversation-mention-options",
      board.data?.teamId,
      query,
      offset,
    ],
    enabled: !!board.data && query !== undefined,
    queryFn: ({ signal }) =>
      api.list(
        "agents",
        "",
        {
          teamId: board.data!.teamId,
          name: query || undefined,
          limit: 20,
          offset,
        },
        signal,
      ),
  });
  const attempt = useRef<{
    key: string;
    version: number;
    input: { body: string; mentionedAgentIds: string[] };
  } | null>(null);
  const edit = (value: string) => {
    setBody(value);
    setError(null);
    attempt.current = null;
    setOffset(0);
  };
  const select = (agent: MentionSelection) => {
    edit(
      body.replace(
        /(^|\s)@([^\s@]*)$/,
        (_, prefix: string) => prefix + mentionToken(agent) + " ",
      ),
    );
    setSelections((previous) => [...previous, agent]);
    textarea.current?.focus();
  };
  const send = async () => {
    setSending(true);
    setError(null);
    try {
      if (!attempt.current) {
        const fresh = await api.get("tasks", taskId);
        attempt.current = {
          key: crypto.randomUUID(),
          version: fresh.version,
          input: {
            body,
            mentionedAgentIds: selectedRecipients(body, selections),
          },
        };
      }
      const current = attempt.current;
      await api.createComment(
        taskId,
        current.input,
        current.version,
        current.key,
      );
      setBody("");
      setSelections([]);
      attempt.current = null;
      await Promise.all([
        client.invalidateQueries({ queryKey: ["comments", taskId] }),
        client.invalidateQueries({ queryKey: ["tasks", taskId] }),
        client.invalidateQueries({ queryKey: ["session-deliveries", taskId] }),
      ]);
    } catch (failure) {
      // A confirmed precondition rejection did not create a comment. Refresh for
      // the next explicit send; unknown network outcomes retain their exact key.
      if (
        failure instanceof ApiError &&
        failure.status === 412 &&
        failure.code === "version_mismatch"
      ) {
        attempt.current = null;
      }
      setError(failure);
    } finally {
      setSending(false);
    }
  };
  return (
    <form
      className="conversation-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label htmlFor={`conversation-compose-${taskId}`}>
        {tr("tasks.writeConversation")}
      </label>
      <Textarea
        id={`conversation-compose-${taskId}`}
        ref={textarea}
        value={body}
        disabled={sending}
        onChange={(event) => edit(event.target.value)}
        placeholder={tr("tasks.mentionHint")}
      />
      {query !== undefined && (
        <div
          className="conversation-mention-options"
          aria-label={tr("tasks.chooseRecipient")}
        >
          {agents.error && (
            <Failure error={agents.error} retry={() => void agents.refetch()} />
          )}
          {agents.data?.items.map((agent) => (
            <Button
              key={agent.id}
              type="button"
              variant="ghost"
              onClick={() => select(agent)}
            >
              {agent.name}
            </Button>
          ))}
          {agents.data?.hasMore && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOffset(agents.data!.nextOffset!)}
            >
              {tr("common.loadMore")}
            </Button>
          )}
        </div>
      )}
      {error != null && <Failure error={error} retry={() => void send()} />}
      <Button
        type="submit"
        disabled={
          sending ||
          !body.trim() ||
          new TextEncoder().encode(body).length > 16384
        }
      >
        {tr(sending ? "tasks.sendingConversation" : "tasks.sendConversation")}
      </Button>
    </form>
  );
}
