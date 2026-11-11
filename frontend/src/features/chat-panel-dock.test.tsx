import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatPanel } from "@/state/chat-panel";
import { setLocalePreference } from "@/i18n";
import { ChatWorkspace } from "./chat-side-panel";

vi.mock("@/api/context", () => ({
  useList: () => ({ data: undefined }),
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
  useChatPanel.setState(useChatPanel.getInitialState());
  useChatPanel.setState({ teamId: "team-a", open: true, width: 440 });
});
afterEach(() => vi.unstubAllGlobals());

function renderPanel() {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatWorkspace>
        <main>Boards</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  const workspace = view.container.querySelector<HTMLElement>(".chat-workspace")!;
  const content = view.container.querySelector<HTMLElement>("main")!;
  const chat = view.container.querySelector<HTMLElement>(".chat-side-panel")!;
  const chatOnLeft = useChatPanel.getState().side === "left";
  const contentWidth = window.innerWidth - 68 - 440;
  vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue(
    new DOMRect(68, 0, window.innerWidth - 68, 900),
  );
  vi.spyOn(content, "getBoundingClientRect").mockReturnValue(
    new DOMRect(chatOnLeft ? 508 : 68, 0, contentWidth, 900),
  );
  vi.spyOn(chat, "getBoundingClientRect").mockReturnValue(
    new DOMRect(chatOnLeft ? 68 : window.innerWidth - 440, 0, 440, 900),
  );
  return view;
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
  useChatPanel.getState().setSide("left");
  renderPanel();
  drag(100, 700);
  expect(preview()).toHaveAttribute("data-side", "right");
  fireEvent.pointerUp(window, { clientX: 700, clientY: 60, pointerId: 1 });
  expect(useChatPanel.getState().side).toBe("right");
});

it.each([
  ["left", 620, "right"],
  ["right", 580, "left"],
] as const)(
  "keeps the nearest-side rule from %s when dropped at %s (to %s)",
  (initialSide, dropX, expectedSide) => {
    useChatPanel.getState().setSide(initialSide);
    renderPanel();
    drag(initialSide === "left" ? 100 : 1000, dropX);
    expect(preview()).toHaveAttribute("data-side", expectedSide);
    fireEvent.pointerUp(window, { clientX: dropX, pointerId: 1 });
    expect(useChatPanel.getState().side).toBe(expectedSide);
  },
);

it("does not guess a drop position when panel bounds are unavailable", () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const { container } = renderPanel();
    vi.spyOn(container.querySelector("main")!, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 0, 0),
    );
    drag(1000, 150);
    expect(preview()).toBeNull();
    expect(warning).toHaveBeenCalled();
    fireEvent.pointerUp(window, { clientX: 150, pointerId: 1 });
    expect(useChatPanel.getState().side).toBe("right");
  } finally {
    warning.mockRestore();
  }
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

it("announces the panel's new position after dragging", () => {
  renderPanel();
  drag(1000, 150);
  fireEvent.pointerUp(window, { clientX: 150, clientY: 60, pointerId: 1 });
  expect(useChatPanel.getState().side).toBe("left");
  expect(screen.getByRole("status")).toHaveTextContent("Chat docked on the left");
  act(() => useChatPanel.getState().setSide("right"));
});

it.each(["left", "right"] as const)(
  "resizes the %s panel beyond 720 px and stops at 80% of the viewport",
  (side) => {
    vi.stubGlobal("innerWidth", 1600);
    useChatPanel.getState().setSide(side);
    renderPanel();
    const resizer = screen.getByRole("separator", { name: "Resize chat panel" });
    const panel = resizer.parentElement!;
    const left = side === "left" ? 68 : 1160;
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(
      new DOMRect(left, 0, 440, 900),
    );
    resizer.setPointerCapture = vi.fn();
    resizer.hasPointerCapture = vi.fn(() => true);
    resizer.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(resizer, { pointerId: 1, button: 0 });
    fireEvent.pointerMove(resizer, {
      pointerId: 1,
      clientX: side === "left" ? left + 1100 : 1600 - 1100,
    });
    expect(useChatPanel.getState().width).toBe(1100);
    fireEvent.pointerMove(resizer, {
      pointerId: 1,
      clientX: side === "left" ? left + 1600 : 0,
    });
    expect(useChatPanel.getState().width).toBe(1280);
    expect(resizer).toHaveAttribute("aria-valuemax", "1280");
    expect(resizer).toHaveAttribute("aria-valuenow", "1280");
    fireEvent.pointerUp(resizer, { pointerId: 1 });
  },
);

it("resizes with the keyboard up to 80% and back again", () => {
  useChatPanel.setState({ width: 940 });
  renderPanel();
  const resizer = screen.getByRole("separator", { name: "Resize chat panel" });
  fireEvent.keyDown(resizer, { key: "ArrowLeft" });
  expect(useChatPanel.getState().width).toBe(960);
  fireEvent.keyDown(resizer, { key: "ArrowLeft" });
  expect(useChatPanel.getState().width).toBe(960);
  fireEvent.keyDown(resizer, { key: "ArrowRight" });
  expect(useChatPanel.getState().width).toBe(940);
});

it("updates the accessible range and resizes from the visible width after a window resize", () => {
  vi.stubGlobal("innerWidth", 1600);
  useChatPanel.setState({ width: 1200 });
  renderPanel();
  const resizer = screen.getByRole("separator", { name: "Resize chat panel" });
  expect(resizer).toHaveAttribute("aria-valuemax", "1280");
  expect(resizer).toHaveAttribute("aria-valuenow", "1200");

  vi.stubGlobal("innerWidth", 1000);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(resizer).toHaveAttribute("aria-valuemax", "800");
  expect(resizer).toHaveAttribute("aria-valuenow", "800");
  expect(useChatPanel.getState().width).toBe(1200);
  fireEvent.keyDown(resizer, { key: "ArrowRight" });
  expect(useChatPanel.getState().width).toBe(780);
  expect(resizer).toHaveAttribute("aria-valuenow", "780");
});
