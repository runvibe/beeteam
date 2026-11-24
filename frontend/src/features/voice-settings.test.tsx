import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { createManagedAgentApi } from "@/api/managed-agents";
import type { VoiceCatalog } from "@/api/voice";
import { i18n } from "@/i18n";
import { useVoicePreference } from "@/state/voice-preference";
import { VoiceSettings } from "./voice-settings";

const catalog: VoiceCatalog = {
  voices: [
    { id: "marin", name: "Marin" },
    { id: "cedar", name: "Cedar" },
  ],
  defaultVoice: null,
};
function mount(voices = vi.fn(async () => catalog)) {
  const managed = createManagedAgentApi();
  const api = {
    ...createMockApi({ delay: 0 }),
    managedAgents: { ...managed, voice: { ...managed.voice, voices } },
  };
  render(
    <ApiProvider api={api}>
      <VoiceSettings />
    </ApiProvider>,
  );
  return voices;
}
beforeEach(async () => {
  await i18n.changeLanguage("en");
  useVoicePreference.setState({ voiceId: null });
  Object.defineProperty(Element.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
});

it("discovers voices and saves a selection or the native default", async () => {
  mount();
  await userEvent.click(screen.getByRole("combobox", { name: "Voice" }));
  await userEvent.click(await screen.findByRole("option", { name: "Marin" }));
  expect(useVoicePreference.getState().voiceId).toBe("marin");
  await userEvent.click(screen.getByRole("combobox", { name: "Voice" }));
  await userEvent.click(screen.getByRole("option", { name: "Codex default" }));
  expect(useVoicePreference.getState().voiceId).toBeNull();
});

it("keeps the saved voice visible while loading and marks it unavailable when absent", async () => {
  useVoicePreference.getState().choose("older-voice");
  let resolve!: (value: VoiceCatalog) => void;
  mount(
    vi.fn(
      () =>
        new Promise<VoiceCatalog>((done) => {
          resolve = done;
        }),
    ),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Loading available voices",
  );
  expect(screen.getByRole("combobox", { name: "Voice" })).toHaveTextContent(
    "Saved voice — older-voice",
  );
  resolve(catalog);
  await screen.findByText(/The saved voice is unavailable/);
  expect(screen.getByRole("combobox", { name: "Voice" })).toHaveTextContent(
    "Unavailable — older-voice",
  );
  expect(useVoicePreference.getState().voiceId).toBe("older-voice");
});

it("offers retry after catalog failure without resetting the preference", async () => {
  useVoicePreference.getState().choose("marin");
  const voices = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(catalog);
  mount(voices);
  await screen.findByRole("alert");
  expect(useVoicePreference.getState().voiceId).toBe("marin");
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("combobox", { name: "Voice" })).toHaveTextContent(
    "Marin",
  );
  expect(voices).toHaveBeenCalledTimes(2);
});
