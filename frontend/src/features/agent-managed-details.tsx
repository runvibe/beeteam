import { useApi } from "@/api/context";
import { useLocale, t } from "@/i18n";
import { ManagedAgentChat } from "./managed-agent-chat";

export function AgentManagedDetails({ agentId }: { agentId: string }) {
  useLocale();
  const { managedAgents } = useApi();
  if (!managedAgents) return null;
  return (
    <section
      className="detail-section managed-agent-details"
      aria-label={t("managed.execution")}
    >
      <h3>{t("managed.execution")}</h3>
      <p className="small-note">{t("managed.executionHint")}</p>
      <ManagedAgentChat
        key={agentId}
        agentId={agentId}
        api={managedAgents}
        mode="management"
      />
    </section>
  );
}
