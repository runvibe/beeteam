import type { PlanRevision } from "@/api/types";
import { AgentName } from "@/components/names";
import { formatDate } from "@/components/shared";
export function Metadata({ item }: { item: PlanRevision }) {
  return (
    <div className="record-author">
      <span>
        {item.actorKind === "human" ? "Pessoa" : "Agente"} ·{" "}
        <AgentName id={item.actorId} />
      </span>
      <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
    </div>
  );
}
