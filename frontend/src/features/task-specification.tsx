import { useLocale, t as tr } from "@/i18n";

import type { TaskWorkScope } from "@/api/generated/kanban/TaskWorkScope";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { NoData } from "@/components/shared";
import { safeRepositoryUrl } from "./repository-links";
import "./task-specification.css";
import { TaskProjectActions } from "./project-actions";
export function TaskSpecification({
  specification,
  scope,
  taskId,
}: {
  specification: string;
  scope?: TaskWorkScope;
  taskId?: string;
}) {
  useLocale();
  const repositories =
    scope?.repositories.filter((repo) =>
      scope.projects.some((project) => repo.projectKeys.includes(project.key)),
    ) ?? [];
  const empty = !scope
    ? tr("tasks.scopeNotProvidedInThisRecord")
    : scope.status === "not_applicable"
      ? tr("tasks.notApplicable")
      : scope.status === "to_identify"
        ? tr("tasks.toBeIdentified")
        : tr("tasks.noRecordsDeclared");
  return (
    <div className="detail-section specification-layout">
      <div className="task-specification">
        {specification ? (
          <Markdown headingOffset={2} sectionDividers>
            {specification}
          </Markdown>
        ) : (
          <NoData
            title={tr("tasks.noSpecificationRecorded")}
            description={tr(
              "tasks.requirementsAndAcceptanceCriteriaWillAppearInThisSectionWhen",
            )}
          />
        )}
      </div>
      <aside
        className="specification-scope"
        aria-label={tr("tasks.taskTechnicalScope")}
      >
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{tr("tasks.projects")}</h2>
            </CardTitle>
            {scope?.status === "to_identify" && !!scope.projects.length && (
              <Badge variant="secondary">
                {tr("tasks.partiallyIdentified")}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {scope?.projects.length ? (
              <ul className="scope-records">
                {scope.projects.map((project) => (
                  <li key={project.key}>
                    <strong>{project.name}</strong>
                    <code>{project.rootPath}</code>
                    {taskId && (
                      <TaskProjectActions
                        key={`${taskId}/${project.key}/${project.rootPath}`}
                        taskId={taskId}
                        projectKey={project.key}
                        projectName={project.name}
                      />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small-note">{empty}</p>
            )}
          </CardContent>
        </Card>
        {!!scope && !!repositories.length && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{tr("tasks.repositories")}</h2>
              </CardTitle>
              {scope?.status === "to_identify" && !!repositories.length && (
                <Badge variant="secondary">
                  {tr("tasks.partiallyIdentified")}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {repositories.length ? (
                <ul className="scope-records">
                  {repositories.map((repo) => {
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
                            {tr("tasks.projects2")}{" "}
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
        )}
      </aside>
    </div>
  );
}
