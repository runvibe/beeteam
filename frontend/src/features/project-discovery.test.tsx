import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TaskSpecification } from "./task-specification";
const discovery = {
  status: "detected" as const,
  reason: null,
  checkedAt: "2026-11-03T12:00:00Z",
  checkoutRoot: "C:/worktrees/used",
  gitDirectory: "C:/main/.git/worktrees/used",
  commonDirectory: "C:/main/.git",
  isWorktree: true,
  branch: { state: "named" as const, name: "feature/used" },
  headHash: "a".repeat(40),
  repositoryKey: "repo",
  remotes: [],
};
const project = {
  key: "app",
  name: "App",
  rootPath: "C:/worktrees/used/src",
  discovery,
};
it("shows only the registered project path without discovery details or unrelated repositories", () => {
  render(
    <TaskSpecification
      specification="Spec"
      scope={{
        status: "identified",
        projects: [project],
        repositories: [
          {
            key: "repo",
            name: "Repo",
            remoteUrl: null,
            webUrl: null,
            provider: "other",
            projectKeys: ["app"],
          },
          {
            key: "other",
            name: "Other worktree",
            remoteUrl: null,
            webUrl: null,
            provider: "other",
            projectKeys: ["not-declared"],
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("C:/worktrees/used/src")).toBeVisible();
  expect(screen.queryByText("C:/worktrees/used")).toBeNull();
  expect(screen.queryByText("feature/used")).toBeNull();
  expect(screen.queryByText("Worktree Git")).toBeNull();
  expect(screen.queryByText(/Verificado em/)).toBeNull();
  expect(screen.queryByText("C:/main/.git")).toBeNull();
  expect(screen.queryByText("Other worktree")).toBeNull();
});
it.each([
  ["not_git", null, "Sem Git nesta pasta."],
  ["unavailable", "path_unavailable", "Pasta inacessível."],
  ["unavailable", "git_unavailable", "Git indisponível para inspeção."],
  ["unavailable", "timeout", "Descoberta excedeu o tempo limite."],
] as const)(
  "keeps the registered path for %s/%s without auxiliary discovery text",
  (status, reason, label) => {
    render(
      <TaskSpecification
        specification=""
        scope={{
          status: "identified",
          projects: [
            {
              ...project,
              discovery: {
                ...discovery,
                status,
                reason,
                checkoutRoot: null,
                gitDirectory: null,
                commonDirectory: null,
                isWorktree: null,
                branch: null,
                headHash: null,
                repositoryKey: null,
              },
            },
          ],
          repositories: [],
        }}
      />,
    );
    expect(screen.queryByText(label)).toBeNull();
    expect(screen.getByText(project.rootPath)).toBeVisible();
    expect(screen.getByText("App")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Repositórios" })).toBeNull();
  },
);
it("shows the declared legacy project without inventing discovery information", () => {
  render(
    <TaskSpecification
      specification=""
      scope={{
        status: "identified",
        projects: [{ key: "app", name: "Legacy", rootPath: "C:/legacy" }],
        repositories: [],
      }}
    />,
  );
  expect(screen.queryByText("Descoberta Git ainda não registrada.")).toBeNull();
  expect(screen.getByText("C:/legacy")).toBeVisible();
  expect(screen.queryByText("Sem Git nesta pasta.")).toBeNull();
});
