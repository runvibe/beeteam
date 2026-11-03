import type { WorkProject } from "@/api/generated/kanban/WorkProject";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/components/shared";
const reasons = {
  path_unavailable: "Pasta inacessível.",
  git_unavailable: "Git indisponível para inspeção.",
  timeout: "Descoberta excedeu o tempo limite.",
  output_limit: "Descoberta excedeu o limite de saída.",
  inspection_failed: "Não foi possível inspecionar o Git.",
};
export function ProjectDiscovery({ project }: { project: WorkProject }) {
  const discovery = project.discovery;
  if (!discovery)
    return <p className="small-note">Descoberta Git ainda não registrada.</p>;
  const checked = Number.isFinite(Date.parse(discovery.checkedAt)) ? (
    <span className="small-note">
      Verificado em {formatDate(discovery.checkedAt)}
    </span>
  ) : null;
  if (discovery.status === "not_git")
    return (
      <>
        <p className="small-note">Sem Git nesta pasta.</p>
        {checked}
      </>
    );
  if (discovery.status === "unavailable")
    return (
      <>
        <p className="small-note">
          {discovery.reason
            ? reasons[discovery.reason]
            : "Descoberta indisponível."}
        </p>
        {checked}
      </>
    );
  return (
    <>
      <Badge variant="secondary" className="justify-self-start">
        {discovery.isWorktree ? "Worktree Git" : "Checkout Git"}
      </Badge>
      {discovery.checkoutRoot &&
        discovery.checkoutRoot !== project.rootPath && (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="small-note">Raiz do checkout usado</span>
            <code>{discovery.checkoutRoot}</code>
          </div>
        )}
      {discovery.branch && (
        <span className="small-note">
          {discovery.branch.state === "named"
            ? discovery.branch.name
            : discovery.branch.state === "detached"
              ? "Detached HEAD"
              : "Branch não identificada"}
        </span>
      )}
      {checked}
    </>
  );
}
