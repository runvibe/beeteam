import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatPanel } from "@/state/chat-panel";
import { setLocalePreference } from "@/i18n";
import { ChatWorkspace } from "./chat-side-panel";

vi.mock("@/api/context", () => ({
  useApi: () => ({
    list: async () => ({ items: [], total: 0, offset: 0, limit: 20 }),
  }),
  useEntity: (resource: string) => ({
    data:
      resource === "teams"
        ? { name: "Team A", leaderId: "leader", system: false }
        : { version: 1 },
  }),
}));
vi.mock("@/components/shared", () => ({
  QueryState: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("./leader-chat", () => ({
  LeaderChat: () => <textarea aria-label="Draft" defaultValue="" />,
}));

let narrow = false;
beforeEach(() => {
  narrow = false;
  setLocalePreference("en");
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width") ? narrow : false,
    addEventListener() {},
    removeEventListener() {},
  }));
  useChatPanel.setState({ teamId: "team-a", open: true, side: "right", width: 440 });
});
afterEach(() => vi.unstubAllGlobals());

function renderPanel() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatWorkspace>
        <main>Boards</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
}
const heading = () => document.querySelector(".chat-panel-heading")!;
const preview = () => document.querySelector(".chat-dock-preview");

function drag(fromX: number, toX: number) {
  fireEvent.pointerDown(heading(), { clientX: fromX, clientY: 20, button: 0, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: (fromX + toX) / 2, clientY: 40, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: toX, clientY: 60, pointerId: 1 });
}

it("shows a snap preview on the target side while dragging the header", () => {
  renderPanel();
  drag(1000, 150);
  expect(preview()).toHaveAttribute("data-side", "left");
  expect(document.querySelector(".chat-side-panel")).toHaveAttribute("data-dragging", "true");
  fireEvent.pointerUp(window, { clientX: 150, clientY: 60, pointerId: 1 });
  expect(preview()).toBeNull();
  expect(useChatPanel.getState().side).toBe("left");
});

it("docks to the side nearest to the pointer when dropped mid-screen", () => {
  useChatPanel.setState({ side: "left" });
  renderPanel();
  drag(100, 700);
  expect(preview()).toHaveAttribute("data-side", "right");
  fireEvent.pointerUp(window, { clientX: 700, clientY: 60, pointerId: 1 });
  expect(useChatPanel.getState().side).toBe("right");
});

it("cancels the drag with Escape without changing side", () => {
  renderPanel();
  drag(1000, 150);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(preview()).toBeNull();
  fireEvent.pointerUp(window, { clientX: 150, clientY: 60, pointerId: 1 });
  expect(useChatPanel.getState().side).toBe("right");
});

it("ignores tiny movements and clicks on header buttons", async () => {
  renderPanel();
  fireEvent.pointerDown(heading(), { clientX: 1000, clientY: 20, button: 0, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: 997, clientY: 21, pointerId: 1 });
  expect(preview()).toBeNull();
  fireEvent.pointerUp(window, { clientX: 997, clientY: 21, pointerId: 1 });
  const close = screen.getByRole("button", { name: "Close chat panel" });
  fireEvent.pointerDown(close, { clientX: 1000, clientY: 20, button: 0, pointerId: 2 });
  fireEvent.pointerMove(window, { clientX: 100, clientY: 20, pointerId: 2 });
  expect(preview()).toBeNull();
  fireEvent.pointerUp(window, { clientX: 100, clientY: 20, pointerId: 2 });
  expect(useChatPanel.getState().side).toBe("right");
});

it("disables header dragging on narrow screens", () => {
  narrow = true;
  renderPanel();
  drag(800, 100);
  expect(preview()).toBeNull();
  fireEvent.pointerUp(window, { clientX: 100, clientY: 60, pointerId: 1 });
  expect(useChatPanel.getState().side).toBe("right");
});

it("moves the panel to the other side from the keyboard and announces it", async () => {
  renderPanel();
  await userEvent.click(screen.getByRole("button", { name: "Move chat to the left" }));
  expect(useChatPanel.getState().side).toBe("left");
  expect(screen.getByRole("status")).toHaveTextContent("Chat docked on the left");
  expect(screen.getByRole("button", { name: "Move chat to the right" })).toBeVisible();
  act(() => useChatPanel.getState().setSide("right"));
});
