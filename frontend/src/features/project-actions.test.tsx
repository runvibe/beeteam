import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ProjectActions } from "./project-actions";
import { TaskSpecification } from "./task-specification";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";

it("opens only on explicit click and prevents overlapping launches", async () => {
  let complete!: () => void;
  const open = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  render(<ProjectActions projectName="App" onOpen={open} />);
  expect(open).not.toHaveBeenCalled();
  const group = screen.getByRole("group", { name: "Ações do projeto App" });
  await userEvent.click(
    within(group).getByRole("button", { name: "Abrir no Explorer" }),
  );
  expect(open).toHaveBeenCalledExactlyOnceWith("explorer");
  expect(
    within(group).getByRole("button", { name: "Abrir no VS Code" }),
  ).toBeDisabled();
  await userEvent.click(
    within(group).getByRole("button", { name: "Abrir no VS Code" }),
  );
  expect(open).toHaveBeenCalledTimes(1);
  await act(async () => complete());
  expect(screen.queryByRole("status")).toBeNull();
});

it("reports an unavailable application without claiming it opened and allows retry", async () => {
  const open = vi
    .fn()
    .mockRejectedValueOnce(new Error("VS Code não está instalado."));
  render(<ProjectActions projectName="App" onOpen={open} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Abrir no VS Code" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "VS Code não está instalado.",
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Abrir no Explorer" }),
  ).toBeEnabled();
});

it("connects the project card to its task/key and clears feedback when navigating to another task", async () => {
  const api = createMockApi({ delay: 0 });
  api.openProject = vi
    .fn()
    .mockResolvedValue({
      projectKey: "app",
      application: "explorer",
      outcome: "requested",
    });
  const View = ({ taskId }: { taskId: string }) => (
    <ApiProvider api={api}>
      <TaskSpecification
        taskId={taskId}
        specification=""
        scope={{
          status: "identified",
          projects: [{ key: "app", name: "App", rootPath: "C:/projects/app" }],
          repositories: [],
        }}
      />
    </ApiProvider>
  );
  const view = render(<View taskId="019a0000-0000-7000-8000-000000000001" />);
  expect(api.openProject).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Abrir no Explorer" }),
  );
  expect(api.openProject).toHaveBeenCalledExactlyOnceWith(
    "019a0000-0000-7000-8000-000000000001",
    "app",
    "explorer",
  );
  expect(screen.queryByRole("status")).toBeNull();
  view.rerender(<View taskId="019a0000-0000-7000-8000-000000000002" />);
  expect(screen.queryByRole("status")).toBeNull();
});
