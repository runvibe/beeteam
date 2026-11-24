import { useEffect, useRef, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useApi, useEntity } from "@/api/context";
import { Button } from "@/components/ui/button";
import { t, useLocale } from "@/i18n";
import "./chat-session-information.css";

export function sessionInformationMode(
  panelWidth: number,
  windowWidth: number,
) {
  // A phone can occupy the whole window and still lack room for two columns.
  return panelWidth >= 640 && panelWidth > windowWidth / 2
    ? "docked"
    : "floating";
}

export function ChatSessionInformation({
  teamId,
  conversationId,
  mode,
  onClose,
}: {
  teamId: string | null;
  conversationId: string | null;
  mode: "floating" | "docked" | "external";
  onClose: () => void;
}) {
  useLocale();
  const api = useApi();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
  }, []);
  const system = useQuery({
    queryKey: ["chat-system-team"],
    queryFn: () => api.list("teams", "", { system: true, limit: 1 }),
    enabled: !teamId,
  });
  const team = useEntity("teams", teamId ?? system.data?.items[0]?.id ?? "");
  const session = useQuery({
    queryKey: ["managed-conversation", conversationId],
    queryFn: () => api.managedAgents!.conversation(conversationId!),
    enabled: !!conversationId && !!api.managedAgents,
  });
  const leader = useEntity("agents", team.data?.leaderId ?? "");
  const agent = useEntity(
    "agents",
    session.data?.agentId ?? team.data?.leaderId ?? "",
  );
  const board = useEntity("boards", session.data?.boardId ?? "");
  const value = (name?: string) => name ?? t("common.loading");
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }
  return (
    <aside
      id="chat-session-information"
      className="chat-session-information"
      data-mode={mode}
      aria-label={t("chat.sessionInfo")}
      onKeyDown={handleKeyDown}
    >
      <header>
        <strong>{t("chat.sessionInfo")}</strong>
        <Button
          ref={close}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("chat.closeSessionInfo")}
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      <div className="chat-session-information-content">
        {[
          system.error,
          team.error,
          session.error,
          leader.error,
          agent.error,
          board.error,
        ].some(Boolean) && <p role="alert">{t("chat.sessionInfoError")}</p>}
        <dl>
          <dt>{t("chat.sessionName")}</dt>
          <dd>
            {conversationId ? value(session.data?.title) : t("managed.new")}
          </dd>
          <dt>{t("sessions.team")}</dt>
          <dd>{value(team.data?.name)}</dd>
          <dt>{t("chat.agent")}</dt>
          <dd>{value(agent.data?.name)}</dd>
          <dt>{t("common.leader")}</dt>
          <dd>{value(leader.data?.name)}</dd>
          <dt>{t("common.board")}</dt>
          <dd>
            {session.data?.boardId
              ? value(board.data?.name)
              : conversationId && !session.data
                ? t("common.loading")
                : t("sessions.noBoard")}
          </dd>
          {session.data && (
            <>
              <dt>{t("chat.sessionCreated")}</dt>
              <dd>{new Date(session.data.createdAt).toLocaleString()}</dd>
              <dt>{t("chat.sessionUpdated")}</dt>
              <dd>{new Date(session.data.updatedAt).toLocaleString()}</dd>
              {session.data.readOnly && (
                <>
                  <dt>{t("chat.sessionAccess")}</dt>
                  <dd>{t("managed.readonly")}</dd>
                </>
              )}
            </>
          )}
        </dl>
      </div>
    </aside>
  );
}
