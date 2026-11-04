import { useLocale, t as tr } from "@/i18n";

import { useEntity } from "@/api/context";
import { useUi } from "@/state/ui";
import { AgentAvatar } from "./agent-avatar";
import { Button } from "./ui/button";
export function AgentName({
  id,
  avatar = false,
}: {
  id: string | null;
  avatar?: boolean;
}) {
  useLocale();
  const q = useEntity("agents", id ?? "");
  const open = useUi((s) => s.openAgent);
  return id ? (
    <Button
      variant="link"
      size="sm"
      className="agent-name max-w-full justify-start truncate p-0"
      onClick={() => open(id)}
    >
      {avatar && q.data && <AgentAvatar agent={q.data} />}
      <span className="agent-name-label">
        {q.data?.name ??
          (q.error ? tr("common.agentUnavailable") : tr("common.loading"))}
      </span>
    </Button>
  ) : (
    <span>{tr("common.localUser")}</span>
  );
}
export function BoardName({ id }: { id: string }) {
  useLocale();
  const q = useEntity("boards", id);
  return <span>{q.data?.name ?? tr("common.board")}</span>;
}
