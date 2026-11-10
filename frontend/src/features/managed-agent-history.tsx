import { useEffect, useRef } from "react";
import { CircleStop } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { components } from "@/api/generated/managed-agents";
import { t } from "@/i18n";
import {
  ApprovalCard,
  ChatMessage,
  ChatWelcome,
  RequestStatus,
} from "./managed-agent-chat-parts";

type S = components["schemas"];

export function ManagedAgentHistory({
  page,
  messages,
  current,
  approvals,
  busy,
  showWelcome,
  starters,
  empty,
  hasOlder,
  onOlder,
  onPick,
  onControl,
  onDecide,
}: {
  page: S["MessagePage"] | undefined;
  messages: S["Message"][];
  current: S["AgentRequest"] | undefined;
  approvals: S["Approval"][];
  busy: boolean;
  showWelcome: boolean;
  starters: boolean;
  empty: boolean;
  hasOlder: boolean;
  onOlder: () => void;
  onPick: (draft: string) => void;
  onControl: (request: S["AgentRequest"]) => void;
  onDecide: (approval: S["Approval"], decision: "accept" | "decline") => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  const scroll = useRef(true);
  useEffect(() => {
    if (scroll.current) bottom.current?.scrollIntoView({ block: "nearest" });
  }, [page]);
  const settled =
    !current || ["completed", "failed", "cancelled"].includes(current.state);
  return (
    <div
      className="assistant-thread"
      aria-live="polite"
      onScroll={(e) => {
        const el = e.currentTarget;
        scroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
    >
      {hasOlder && (
        <Button
          variant="ghost"
          size="sm"
          className="assistant-older"
          disabled={busy}
          onClick={onOlder}
        >
          {t("managed.older")}
        </Button>
      )}
      {showWelcome && <ChatWelcome starters={starters} onPick={onPick} />}
      {empty && (
        <p className="assistant-history-empty">{t("managed.noHistory")}</p>
      )}
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      {current && current.state !== "completed" && (
        <RequestStatus
          state={current.state}
          error={current.error?.message}
          action={
            !settled && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onControl(current)}
              >
                {current.state === "uncertain" ? (
                  t("managed.reconcile")
                ) : (
                  <>
                    <CircleStop aria-hidden="true" />
                    {t("managed.cancel")}
                  </>
                )}
              </Button>
            )
          }
        />
      )}
      {approvals.map((approval) => (
        <ApprovalCard
          key={approval.id}
          description={approval.description}
          disabled={busy}
          onDecide={(decision) => onDecide(approval, decision)}
        />
      ))}
      <div ref={bottom} />
    </div>
  );
}
