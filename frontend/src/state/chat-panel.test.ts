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

it("persists both panel widths and defaults older saved preferences to a 280 px sessions panel", async () => {
  useChatPanel.setState(useChatPanel.getInitialState());
  useChatPanel.getState().setLayoutWidths({ chat: 600, sessions: 370 });
  const saved = localStorage.getItem("beeteam-chat-panel")!;
  expect(JSON.parse(saved).state).toMatchObject({ width: 600, sessionsWidth: 370 });

  useChatPanel.setState(useChatPanel.getInitialState());
  localStorage.setItem("beeteam-chat-panel", saved);
  await useChatPanel.persist.rehydrate();
  expect(useChatPanel.getState()).toMatchObject({ width: 600, sessionsWidth: 370 });

  useChatPanel.setState(useChatPanel.getInitialState());
  localStorage.setItem(
    "beeteam-chat-panel",
    JSON.stringify({ state: { side: "right", width: 500 }, version: 0 }),
  );
  await useChatPanel.persist.rehydrate();
  expect(useChatPanel.getState()).toMatchObject({ width: 500, sessionsWidth: 280 });
});

it("rejects invalid resize values without changing saved widths", () => {
  useChatPanel.setState(useChatPanel.getInitialState());
  expect(() =>
    useChatPanel.getState().setLayoutWidths({ chat: 500, sessions: Number.NaN }),
  ).toThrow("Invalid workspace panel width");
  expect(useChatPanel.getState()).toMatchObject({ width: 440, sessionsWidth: 280 });
});

it("reports and replaces an invalid saved sessions width", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    useChatPanel.setState(useChatPanel.getInitialState());
    localStorage.setItem(
      "beeteam-chat-panel",
      JSON.stringify({ state: { sessionsWidth: -10 }, version: 0 }),
    );
    await useChatPanel.persist.rehydrate();
    expect(useChatPanel.getState().sessionsWidth).toBe(280);
    expect(warning).toHaveBeenCalledWith(
      "Invalid saved sessions panel width; using the default.",
    );
  } finally {
    warning.mockRestore();
  }
});

it("restores the original left-docked layout from older saved preferences", async () => {
  localStorage.setItem(
    "beeteam-chat-panel",
    JSON.stringify({ state: { side: "left", width: 500 }, version: 0 }),
  );
  await useChatPanel.persist.rehydrate();
  expect(useChatPanel.getState()).toMatchObject({
    side: "left",
    width: 500,
    panelOrder: ["sessions", "chat", "content"],
  });
});

it("moves the chat across the content when its appearance setting changes", async () => {
  localStorage.setItem(
    "beeteam-chat-panel",
    JSON.stringify({
      state: { side: "left", panelOrder: ["chat", "sessions", "content"] },
      version: 0,
    }),
  );
  await useChatPanel.persist.rehydrate();
  useChatPanel.getState().setSide("right");
  expect(useChatPanel.getState()).toMatchObject({
    side: "right",
    panelOrder: ["sessions", "content", "chat"],
  });
});

it("restores a saved panel arrangement and derives the current chat side", async () => {
  localStorage.setItem(
    "beeteam-chat-panel",
    JSON.stringify({
      state: { side: "right", panelOrder: ["chat", "content", "sessions"] },
      version: 0,
    }),
  );
  await useChatPanel.persist.rehydrate();
  expect(useChatPanel.getState()).toMatchObject({
    side: "left",
    panelOrder: ["chat", "content", "sessions"],
  });
});

it("falls back to the saved side when an arrangement is malformed", async () => {
  localStorage.setItem(
    "beeteam-chat-panel",
    JSON.stringify({ state: { side: "right", panelOrder: ["chat", "chat", "other"] }, version: 0 }),
  );
  await useChatPanel.persist.rehydrate();
  expect(useChatPanel.getState()).toMatchObject({
    side: "right",
    panelOrder: ["sessions", "content", "chat"],
  });
});
