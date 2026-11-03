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
it("shows only the explicitly used checkout and branch, without promoting common directory to a project", () => {
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
  expect(screen.getByText("C:/worktrees/used")).toBeVisible();
  expect(screen.getByText("feature/used")).toBeVisible();
  expect(screen.getByText("Worktree Git")).toBeVisible();
  expect(screen.queryByText("C:/main/.git")).toBeNull();
  expect(screen.queryByText("Other worktree")).toBeNull();
});
it.each([
  ["not_git", null, "Sem Git nesta pasta."],
  ["unavailable", "path_unavailable", "Pasta inacessível."],
  ["unavailable", "git_unavailable", "Git indisponível para inspeção."],
  ["unavailable", "timeout", "Descoberta excedeu o tempo limite."],
] as const)(
  "distinguishes %s/%s beside the project and hides repositories",
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
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText("App")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Repositórios" })).toBeNull();
  },
);
it("distinguishes legacy discovery from a confirmed absence of Git", () => {
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
  expect(
    screen.getByText("Descoberta Git ainda não registrada."),
  ).toBeVisible();
  expect(screen.queryByText("Sem Git nesta pasta.")).toBeNull();
});
