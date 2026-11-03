import type { CommitReport } from "@/api/generated/kanban/CommitReport";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/components/shared";
import { safeCommitUrl } from "./repository-links";
export function SummaryCommits({ report }: { report?: CommitReport }) {
  if (!report?.hasCommits || !report.commits.length) return null;
  return (
    <section className="task-reading-block" aria-label="Commits registrados">
      <h4>Commits registrados</h4>
      <ul className="flex flex-col gap-4">
        {report.commits.map((commit) => {
          const href = safeCommitUrl(commit);
          const branch =
            commit.branch.state === "named"
              ? commit.branch.name
              : commit.branch.state === "detached"
                ? "Detached HEAD"
                : "Branch não identificada";
          return (
            <li
              key={`${commit.repositoryKey}:${commit.hash}`}
              className="flex min-w-0 flex-col gap-2"
            >
              <strong>{commit.repository.name}</strong>
              <span className="break-all">{branch}</span>
              <div className="flex flex-wrap items-center gap-2">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                    title={commit.hash}
                  >
                    {commit.hash.slice(0, 8)}
                  </a>
                ) : (
                  <code title={commit.hash}>{commit.hash.slice(0, 8)}</code>
                )}
                <Badge variant="secondary">
                  {commit.availability === "local"
                    ? "Somente local"
                    : commit.availability === "published"
                      ? "Publicação declarada"
                      : "Publicação não informada"}
                </Badge>
              </div>
              <Input
                readOnly
                aria-label={`Hash completo de ${commit.repository.name}`}
                value={commit.hash}
                onFocus={(event) => event.currentTarget.select()}
              />
              {commit.availability === "published" &&
                commit.remoteVerifiedAt &&
                Number.isFinite(Date.parse(commit.remoteVerifiedAt)) && (
                  <p className="small-note">
                    Confirmação remota declarada em{" "}
                    {formatDate(commit.remoteVerifiedAt)}.
                  </p>
                )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
