import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TaskSpecification } from "./task-specification";
import { SummaryCommits } from "./summary-commits";
import { safeCommitUrl, safeRepositoryUrl } from "./repository-links";
import type { WorkRepository } from "@/api/generated/kanban/WorkRepository";
import type { CommitReference } from "@/api/generated/kanban/CommitReference";
const repo: WorkRepository = {
  key: "repo",
  name: "Repo histórico",
  remoteUrl: "git@github.com:org/repo.git",
  webUrl: "https://github.com/org/repo",
  provider: "github",
  projectKeys: ["app"],
};
const commit: CommitReference = {
  repositoryKey: "repo",
  repository: repo,
  branch: { state: "named", name: "feature/one" },
  hash: "a".repeat(40),
  availability: "published",
  remoteVerifiedAt: "2026-11-03T12:00:00Z",
  commitUrl: `https://github.com/org/repo/commit/${"a".repeat(40)}`,
};
it("keeps Markdown separate from explicit projects and repositories", () => {
  render(
    <TaskSpecification
      specification={"# Requisitos\nNão extrair /fake/repo"}
      scope={{
        status: "identified",
        projects: [
          { key: "app", name: "Aplicativo", rootPath: "C:\\worktrees\\app" },
        ],
        repositories: [repo],
      }}
    />,
  );
  expect(screen.getByRole("heading", { name: "Requisitos" })).toBeVisible();
  expect(screen.getByText("C:\\worktrees\\app")).toBeVisible();
  expect(screen.getByRole("link", { name: "Repo histórico" })).toHaveAttribute(
    "href",
    repo.webUrl,
  );
  expect(screen.queryByText("/fake/repo", { exact: true })).toBeNull();
});
it.each([undefined, "to_identify", "not_applicable"] as const)(
  "shows explicit scope state %s without inventing projects",
  (status) => {
    render(
      <TaskSpecification
        specification=""
        scope={status ? { status, projects: [], repositories: [] } : undefined}
      />,
    );
    expect(screen.getByRole("heading", { name: "Projetos" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Repositórios" })).toBeNull();
    expect(
      screen.getAllByText(
        status === "not_applicable"
          ? "Não se aplica."
          : status === "to_identify"
            ? "A identificar."
            : "Escopo não informado neste registro.",
      ),
    ).toHaveLength(1);
  },
);
it("preserves historical commits, named/detached/unknown branches and full hashes", () => {
  render(
    <SummaryCommits
      report={{
        hasCommits: true,
        commits: [
          commit,
          {
            ...commit,
            hash: "b".repeat(64),
            branch: { state: "detached", name: null },
            availability: "local",
            remoteVerifiedAt: null,
            commitUrl: null,
          },
          {
            ...commit,
            hash: "c".repeat(40),
            branch: { state: "unknown", name: null },
            availability: "unknown",
            remoteVerifiedAt: null,
            commitUrl: null,
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole("link", { name: /aaaaaaa/ })).toHaveAttribute(
    "href",
    commit.commitUrl,
  );
  expect(screen.getByText("feature/one")).toBeVisible();
  expect(screen.getByText("Detached HEAD")).toBeVisible();
  expect(screen.getByText("Branch não identificada")).toBeVisible();
  expect(screen.getByDisplayValue("b".repeat(64))).toHaveAttribute("readonly");
  expect(screen.getAllByRole("link")).toHaveLength(1);
});
it.each([undefined, { hasCommits: false, commits: [] }])(
  "does not render a commit section for absent/false declaration",
  (report) => {
    const { container } = render(<SummaryCommits report={report} />);
    expect(container).toBeEmptyDOMElement();
  },
);
it("permits only declared published provider/hash URLs without credentials or guessing SSH", () => {
  expect(safeCommitUrl(commit)).toBe(commit.commitUrl);
  expect(safeRepositoryUrl("git@github.com:org/repo.git")).toBeUndefined();
  for (const url of [
    "javascript:alert(1)",
    "https://user:secret@example.com/repo",
    "https://example.com/repo?token=secret",
    "https://example.com/repo#token",
  ])
    expect(safeRepositoryUrl(url)).toBeUndefined();
  expect(safeCommitUrl({ ...commit, availability: "local" })).toBeUndefined();
  expect(
    safeCommitUrl({
      ...commit,
      commitUrl: "https://other.com/commit/" + commit.hash,
    }),
  ).toBeUndefined();
  expect(safeCommitUrl({ ...commit, remoteVerifiedAt: null })).toBeUndefined();
  const gitlab = {
    ...commit,
    repository: {
      ...repo,
      provider: "gitlab" as const,
      webUrl: "https://git.example.org/group/sub/repo",
    },
    commitUrl: "https://git.example.org/group/sub/repo/-/commit/" + commit.hash,
  };
  expect(safeCommitUrl(gitlab)).toBe(gitlab.commitUrl);
  expect(
    safeCommitUrl({ ...gitlab, commitUrl: gitlab.commitUrl + "0" }),
  ).toBeUndefined();
});

it("keeps declared projects when there are no repositories", () => {
  render(
    <TaskSpecification
      specification="Pesquisa independente de Git"
      scope={{
        status: "identified",
        projects: [
          { key: "research", name: "Pesquisa", rootPath: "C:/research" },
        ],
        repositories: [],
      }}
    />,
  );
  expect(screen.getByText("Pesquisa")).toBeVisible();
  expect(screen.getByText("C:/research")).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Repositórios" })).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
});
