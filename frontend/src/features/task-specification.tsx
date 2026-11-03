import type { TaskWorkScope } from "@/api/generated/kanban/TaskWorkScope";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { NoData } from "@/components/shared";
import { safeRepositoryUrl } from "./repository-links";
import "./task-specification.css";
export function TaskSpecification({
  specification,
  scope,
}: {
  specification: string;
  scope?: TaskWorkScope;
}) {
  const empty = !scope
    ? "Escopo não informado neste registro."
    : scope.status === "not_applicable"
      ? "Não se aplica."
      : scope.status === "to_identify"
        ? "A identificar."
        : "Nenhum registro declarado.";
  return (
    <div className="detail-section specification-layout">
      <div className="task-specification">
        {specification ? (
          <Markdown headingOffset={2} sectionDividers>
            {specification}
          </Markdown>
        ) : (
          <NoData
            title="Nenhuma especificação registrada"
            description="Os requisitos e critérios de aceite serão exibidos nesta seção quando registrados."
          />
        )}
      </div>
      <aside
        className="specification-scope"
        aria-label="Escopo técnico da tarefa"
      >
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Projetos</h2>
            </CardTitle>
            {scope?.status === "to_identify" && !!scope.projects.length && (
              <Badge variant="secondary">Identificação parcial</Badge>
            )}
          </CardHeader>
          <CardContent>
            {scope?.projects.length ? (
              <ul className="scope-records">
                {scope.projects.map((project) => (
                  <li key={project.key}>
                    <strong>{project.name}</strong>
                    <code>{project.rootPath}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small-note">{empty}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Repositórios</h2>
            </CardTitle>
            {scope?.status === "to_identify" && !!scope.repositories.length && (
              <Badge variant="secondary">Identificação parcial</Badge>
            )}
          </CardHeader>
          <CardContent>
            {scope?.repositories.length ? (
              <ul className="scope-records">
                {scope.repositories.map((repo) => {
                  const href = safeRepositoryUrl(repo.webUrl);
                  const projects = scope.projects.filter((project) =>
                    repo.projectKeys.includes(project.key),
                  );
                  return (
                    <li key={repo.key}>
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer">
                          {repo.name}
                        </a>
                      ) : (
                        <strong>{repo.name}</strong>
                      )}
                      {!!projects.length && (
                        <span className="small-note">
                          Projetos:{" "}
                          {projects.map((project) => project.name).join(", ")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="small-note">{empty}</p>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
