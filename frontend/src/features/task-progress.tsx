import {
  RecordedProgress,
  recordedPercent,
} from "@/components/recorded-progress";
import type { CSSProperties } from "react";

export function TaskProgress({ percent }: { percent?: number | null }) {
  const value = recordedPercent(percent);
  return (
    <div
      className="task-progress"
      style={{ "--task-progress": `${value ?? 0}%` } as CSSProperties}
    >
      <div className="task-progress-meter">
        <span className="task-progress-value" aria-hidden="true">
          {value === undefined ? "Sem dados" : `${value}%`}
        </span>
        <RecordedProgress
          percent={value}
          label="Progresso registrado"
          className="task-progress-track"
        />
      </div>
    </div>
  );
}
