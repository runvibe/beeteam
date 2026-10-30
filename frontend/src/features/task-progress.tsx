import type { CSSProperties } from "react";

export function TaskProgress({ percent }: { percent: number }) {
  const value = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="task-progress"
      style={{ "--task-progress": `${value}%` } as CSSProperties}
    >
      <div className="task-progress-meter">
        <span className="task-progress-value" aria-hidden="true">
          {value}%
        </span>
        <div
          className="task-progress-track"
          role="progressbar"
          aria-label="Progresso registrado"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="task-progress-fill" />
        </div>
      </div>
    </div>
  );
}
