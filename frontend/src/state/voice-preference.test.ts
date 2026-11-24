import { beforeEach, expect, it } from "vitest";
import { useVoicePreference } from "./voice-preference";

beforeEach(() => {
  useVoicePreference.setState({ voiceId: null });
  localStorage.removeItem("beeteam-voice-preference");
});

it("restores the selected voice after rehydration and can restore the native default", async () => {
  useVoicePreference.getState().choose("marin");
  const saved = localStorage.getItem("beeteam-voice-preference")!;
  useVoicePreference.setState({ voiceId: null });
  localStorage.setItem("beeteam-voice-preference", saved);
  await useVoicePreference.persist.rehydrate();
  expect(useVoicePreference.getState().voiceId).toBe("marin");
  useVoicePreference.getState().choose(null);
  await useVoicePreference.persist.rehydrate();
  expect(useVoicePreference.getState().voiceId).toBeNull();
});

it("keeps an unavailable saved ID for explicit correction instead of choosing an arbitrary voice", async () => {
  localStorage.setItem(
    "beeteam-voice-preference",
    JSON.stringify({
      state: { voiceId: "previous-provider-voice" },
      version: 0,
    }),
  );
  await useVoicePreference.persist.rehydrate();
  expect(useVoicePreference.getState().voiceId).toBe("previous-provider-voice");
});

it("ignores malformed saved preferences", async () => {
  localStorage.setItem(
    "beeteam-voice-preference",
    JSON.stringify({ state: { voiceId: { invalid: true } }, version: 0 }),
  );
  await useVoicePreference.persist.rehydrate();
  expect(useVoicePreference.getState().voiceId).toBeNull();
});
