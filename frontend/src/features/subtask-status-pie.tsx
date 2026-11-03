import type { TaskOverviewData } from "@/api/task-overview";
export function SubtaskStatusPie({data, onSelect}: {data: TaskOverviewData["directSubtasks"]; onSelect: (id: string) => void}) {
  let offset = -Math.PI / 2;
  return <svg className="subtask-status-pie" viewBox="0 0 200 200" aria-label="Distribuição de subtarefas por status">
    {!data.total && <circle cx="100" cy="100" r="90" fill="var(--muted)" />}
    {data.byStatus.map((status, index) => {
      if (!data.total || status.total <= 0) return null;
      const angle = status.total / data.total * Math.PI * 2;
      const start = offset; offset += angle;
      const path = `M 100 100 L ${100 + 90 * Math.cos(start)} ${100 + 90 * Math.sin(start)} A 90 90 0 ${angle > Math.PI ? 1 : 0} 1 ${100 + 90 * Math.cos(offset)} ${100 + 90 * Math.sin(offset)} Z`;
      const props = {fill: `var(--chart-${(index % 5) + 1})`, role: "button", tabIndex: 0,
        "aria-label": `Filtrar status ${status.statusName}: ${status.total} subtarefas`,
        onClick: () => onSelect(status.statusId),
        onKeyDown: (e: React.KeyboardEvent<SVGElement>) => {if(e.key === "Enter" || e.key === " ") {e.preventDefault();onSelect(status.statusId);}}};
      return status.total === data.total ? <circle key={status.statusId} cx="100" cy="100" r="90" {...props} /> : <path key={status.statusId} d={path} {...props} />;
    })}
  </svg>;
}
