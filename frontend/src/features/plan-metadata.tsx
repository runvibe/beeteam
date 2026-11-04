import { useLocale, t as tr } from "@/i18n";

import type { PlanRevision } from "@/api/types";
import { AgentName } from "@/components/names";
import { formatDate } from "@/components/shared";
export function Metadata({ item }: { item: PlanRevision }) {
  useLocale();
  return (
    <div className="record-author">
      <span>
        {item.actorKind === "human" ? tr("tasks.person") : tr("agents.agent")} ·{" "}
        <AgentName id={item.actorId} />
      </span>
      <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
    </div>
  );
}
