import { useLocale, t as tr } from "@/i18n";

import { CornerUpLeft } from "lucide-react";
import type { Task } from "@/api/types";
import { destination } from "@/routing/location";
import { openCardLink } from "@/routing/card-navigation";
import "./task-parent-reference.css";

export function TaskParentReference({ task }: { task: Task }) {
  useLocale();
  if (!task.parentId) return null;
  const parent =
    task.parentReference?.id === task.parentId ? task.parentReference : null;
  return (
    <div className="task-parent-reference">
      <a
        href={destination(`/tasks/${parent?.slug || task.parentId}`)}
        onClick={openCardLink}
        title={
          parent
            ? tr("tasks.openNamedParent", { title: parent.title })
            : tr("tasks.openParentTask")
        }
        aria-label={
          parent
            ? tr("tasks.subtaskOpenParent", { title: parent.title })
            : tr("tasks.subtaskOpenParentTask")
        }
      >
        <CornerUpLeft size={12} aria-hidden="true" /> {tr("tasks.subtask")}
      </a>
    </div>
  );
}
