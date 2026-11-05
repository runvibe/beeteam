import { it, expect } from "vitest";
import { teamSettingsPatch } from "./team-settings-patch";

it("keeps legacy metadata writes free of unsupported icon fields", () => {
  const draft = {
    name: "New name",
    purpose: "Purpose",
    context: "Draft context",
    leaderIconId: "bot",
    collaboratorIconId: "music",
  } as const;
  expect(teamSettingsPatch(draft, false)).toEqual({
    name: draft.name,
    purpose: draft.purpose,
    context: draft.context,
  });
  expect(teamSettingsPatch(draft, true)).toEqual(draft);
  expect(draft.leaderIconId).toBe("bot");
});
