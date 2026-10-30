import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { App } from "@/App";
import { ProfileForm } from "./profile-form";
import { BoardSettings } from "./settings";

it.each([
  ["boards", 0],
  ["boards", 80],
  ["agents", 0],
  ["agents", 80],
  ["teams", 0],
  ["teams", 80],
] as const)(
  "silently saves %s with %sms latency and retains failed edits for retry",
  async (resource, delay) => {
    const seed = makeSeed(),
      record = seed[resource][0];
    const api = createMockApi({ seed, delay });
    const patch = vi.spyOn(api, "patch");
    if (resource === "teams")
      window.history.replaceState({}, "", `/teams/${seed.teams[0].slug}/settings`);
    render(
      <ApiProvider api={api}>
        {resource === "boards" ? (
          <BoardSettings board={seed.boards[0]} open onOpenChange={() => {}} />
        ) : resource === "agents" ? (
          <ProfileForm agent={seed.agents[0]} />
        ) : (
          <App />
        )}
      </ApiProvider>,
    );
    const name = await screen.findByLabelText("Nome");
    const form = name.closest("form")!;
    const silent = () => {
      expect(
        within(form).queryByText(
          /Salvando|Alterações salvas|Alterações ainda não salvas/,
        ),
      ).toBeNull();
      expect(form.querySelector('p[role="status"]:empty')).toBeNull();
    };
    silent();
    fireEvent.change(name, { target: { value: "Nome editado" } });
    fireEvent.blur(name);
    silent();
    await waitFor(async () =>
      expect((await api.get(resource, record.id)).name).toBe("Nome editado"),
    );
    silent();
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.calls[0][3]).toBe(record.version);
    patch.mockRejectedValueOnce(new Error("Gravação indisponível"));
    fireEvent.change(name, { target: { value: "Rascunho preservado" } });
    fireEvent.blur(name);
    await within(form).findByText("Gravação indisponível");
    expect(name).toHaveValue("Rascunho preservado");
    fireEvent.click(
      within(form).getByRole("button", { name: "Tentar salvar novamente" }),
    );
    silent();
    await waitFor(async () =>
      expect((await api.get(resource, record.id)).name).toBe(
        "Rascunho preservado",
      ),
    );
    expect(patch).toHaveBeenCalledTimes(3);
    silent();
  },
);

