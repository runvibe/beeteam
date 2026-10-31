import { CornerUpLeft } from "lucide-react";
import type { Task } from "@/api/types";
import { destination } from "@/routing/location";
import { openCardLink } from "@/routing/card-navigation";
import "./task-parent-reference.css";

export function TaskParentReference({ task }: { task: Task }) {
  if (!task.parentId) return null;
  const parent =
    task.parentReference?.id === task.parentId ? task.parentReference : null;
  return (
    <div className="task-parent-reference">
      <span>
        <CornerUpLeft size={12} aria-hidden="true" /> Subtarefa
      </span>
      <a
        href={destination(`/tasks/${parent?.slug || task.parentId}`)}
        onClick={openCardLink}
      >
        {parent ? `Mãe: ${parent.title}` : "Tarefa mãe"}
      </a>
    </div>
  );
}
