import { expect, it } from "vitest";
import { useChatPanel } from "./chat-panel";

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
  useChatPanel.getState().setWidth(10000);
  expect(useChatPanel.getState().width).toBe(720);
  useChatPanel.getState().setWidth(1);
  expect(useChatPanel.getState().width).toBe(320);
});
