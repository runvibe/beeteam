import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { AutosaveFeedback, useSettingsAutosave } from "./settings-autosave";

const initial = { id: "test", version: 1, name: "Original", enabled: false };
type Record = typeof initial;
function Harness({
  save,
  latest = initial,
}: {
  save: (
    draft: Omit<Record, "id" | "version">,
    version: number,
  ) => Promise<Record>;
  latest?: Record;
}) {
  const state = useSettingsAutosave({
    resource: "settings-test",
    latest,
    values: (record: Record) => ({
      name: record.name,
      enabled: record.enabled,
    }),
    save,
  });
  return (
    <form {...state.formProps}>
      <input
        aria-label="Name"
        required
        value={state.draft.name}
        onChange={(e) => state.change("name", e.target.value)}
      />
      <input
        aria-label="Enabled"
        type="checkbox"
        checked={state.draft.enabled}
        onChange={(e) => state.change("enabled", e.target.checked, true)}
      />
      <AutosaveFeedback state={state} />
    </form>
  );
}
it("saves text only on blur, skips unchanged/invalid values and saves options immediately", async () => {
  const save = vi.fn(async (draft, version) => ({
    ...initial,
    ...draft,
    version: version + 1,
  }));
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <Harness save={save} />
    </ApiProvider>,
  );
  const input = screen.getByLabelText("Name");
  await userEvent.clear(input);
  await userEvent.type(input, "Edited");
  expect(save).not.toHaveBeenCalled();
  await userEvent.tab();
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenLastCalledWith({ name: "Edited", enabled: false }, 1);
  await userEvent.click(input);
  await userEvent.tab();
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).toBeNull();
  await userEvent.click(screen.getByLabelText("Enabled"));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenLastCalledWith({ name: "Edited", enabled: true }, 2);
  await userEvent.clear(input);
  await userEvent.tab();
  expect(save).toHaveBeenCalledTimes(2);
});
it("serializes and coalesces blurred edits while preserving edits made during a request", async () => {
  const resolvers: ((record: Record) => void)[] = [];
  const save = vi.fn(
    () => new Promise<Record>((resolve) => resolvers.push(resolve)),
  );
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <Harness save={save} />
    </ApiProvider>,
  );
  const input = screen.getByLabelText("Name");
  fireEvent.change(input, { target: { value: "First" } });
  fireEvent.blur(input);
  fireEvent.change(input, { target: { value: "Second" } });
  fireEvent.blur(input);
  fireEvent.change(input, { target: { value: "Third" } });
  fireEvent.blur(input);
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () =>
    resolvers[0]({ ...initial, name: "First", version: 2 }),
  );
  expect(input).toHaveValue("Third");
  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith({ name: "Third", enabled: false }, 2);
  await act(async () =>
    resolvers[1]({ ...initial, name: "Third", version: 3 }),
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByText("Alterações salvas.")).toBeNull();
});
it("flushes a focused field on close and retains a failed draft for reopening and retry", async () => {
  const api = createMockApi({ delay: 0 });
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementation(async (draft, version) => ({
      ...initial,
      ...draft,
      version: version + 1,
    }));
  const view = render(
    <ApiProvider api={api}>
      <Harness save={save} />
    </ApiProvider>,
  );
  const input = screen.getByLabelText("Name");
  await userEvent.clear(input);
  await userEvent.type(input, "Retained");
  view.unmount();
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  render(
    <ApiProvider api={api}>
      <Harness save={save} />
    </ApiProvider>,
  );
  expect(screen.getByLabelText("Name")).toHaveValue("Retained");
  await userEvent.click(
    await screen.findByRole("button", { name: "Tentar salvar novamente" }),
  );
  await waitFor(() => expect(screen.queryByText("offline")).toBeNull());
  expect(screen.queryByRole("status")).toBeNull();
  expect(save).toHaveBeenCalledTimes(2);
});
it("does not silently adopt a remote metadata version over a local draft", async () => {
  const api = createMockApi({ delay: 0 });
  const save = vi.fn(async (draft, version) => ({
    ...initial,
    ...draft,
    version: version + 1,
  }));
  const view = render(
    <ApiProvider api={api}>
      <Harness save={save} />
    </ApiProvider>,
  );
  const input = screen.getByLabelText("Name");
  await userEvent.clear(input);
  await userEvent.type(input, "Local");
  view.rerender(
    <ApiProvider api={api}>
      <Harness
        save={save}
        latest={{ ...initial, version: 2, name: "Remote" }}
      />
    </ApiProvider>,
  );
  expect(input).toHaveValue("Local");
  expect(input).toHaveFocus();
  await userEvent.tab();
  expect(save).toHaveBeenLastCalledWith({ name: "Local", enabled: false }, 1);
});
