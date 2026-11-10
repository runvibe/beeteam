import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatPanel } from "./chat-panel";

beforeEach(() => vi.stubGlobal("innerWidth", 1600));
afterEach(() => vi.unstubAllGlobals());

it("keeps selected team when closing and changing side, and persists layout and selection", () => {
  useChatPanel.getState().openTeam("team-a");
  useChatPanel.getState().setSide("left");
  useChatPanel.getState().close();
  expect(useChatPanel.getState()).toMatchObject({
    teamId: "team-a",
    open: false,
    side: "left",
  });
  const saved = JSON.parse(localStorage.getItem("beeteam-chat-panel")!);
  expect(saved.state.side).toBe("left");
  expect(saved.state).toMatchObject({ teamId: "team-a", picking: false, open: false });
  useChatPanel.getState().chooseTeam();
  expect(useChatPanel.getState()).toMatchObject({ teamId: null, picking: true, open: true });
});

it.each([
  [1200, 960],
  [1600, 1280],
  [1920, 1536],
])("limits a %i px viewport to a %i px panel", (viewport, maximum) => {
  vi.stubGlobal("innerWidth", viewport);
  useChatPanel.getState().setWidth(10000);
  expect(useChatPanel.getState().width).toBe(maximum);
  expect(JSON.parse(localStorage.getItem("beeteam-chat-panel")!).state.width).toBe(maximum);

  useChatPanel.getState().setWidth(1);
  expect(useChatPanel.getState().width).toBe(320);
});

it("preserves widths above the old 720 px limit", async () => {
  useChatPanel.getState().setWidth(1100);
  expect(useChatPanel.getState().width).toBe(1100);

  useChatPanel.setState({ width: 440 });
  localStorage.setItem(
    "beeteam-chat-panel",
    JSON.stringify({ state: { width: 1100 }, version: 0 }),
  );
  await useChatPanel.persist.rehydrate();
  expect(useChatPanel.getState().width).toBe(1100);
});
