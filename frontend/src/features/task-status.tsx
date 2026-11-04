import { useLocale, t as tr } from "@/i18n";

import { useList } from "@/api/context";
import type { Task } from "@/api/types";
import { Badge } from "@/components/ui/badge";

export function TaskStatus({ task }: { task: Task }) {
  useLocale();
  const q = useList("statuses", task.boardId, {
    limit: 100,
    includeArchived: true,
  });
  return (
    <Badge variant="outline">
      {q.data?.items.find((s) => s.id === task.statusId)?.name ??
        tr("common.loading")}
    </Badge>
  );
}
