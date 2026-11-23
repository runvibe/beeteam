import { createRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ChatHistoryViewport,
  ChatPanelScrollArea,
  ChatPanelScrollbar,
} from "./chat-panel-scroll-area";
import { ManagedAgentHistory } from "./managed-agent-history";

const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
);
afterEach(() => {
  if (originalScrollIntoView)
    Object.defineProperty(
      Element.prototype,
      "scrollIntoView",
      originalScrollIntoView,
    );
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

it("keeps the panel root and composer outside the history viewport", () => {
  const viewport = createRef<HTMLDivElement>();
  const scroll = vi.fn();
  const view = render(
    <ChatPanelScrollArea>
      <aside className="chat-side-panel">
        <header>Chat</header>
        <ChatHistoryViewport ref={viewport} onScroll={scroll}>
          Messages
        </ChatHistoryViewport>
        <form aria-label="Composer">Draft</form>
        <ChatPanelScrollbar />
      </aside>
    </ChatPanelScrollArea>,
  );
  const panel = view.container.querySelector("aside")!;
  expect(view.container.firstElementChild).toBe(panel);
  expect(panel.style.position).toBe("");
  expect(viewport.current).toHaveAttribute("data-radix-scroll-area-viewport");
  expect(viewport.current).toHaveAttribute("tabindex", "0");
  expect(viewport.current?.contains(view.container.querySelector("form"))).toBe(
    false,
  );
  expect(viewport.current?.firstElementChild).toHaveClass(
    "assistant-thread-content",
  );
  fireEvent.scroll(viewport.current!);
  expect(scroll).toHaveBeenCalledOnce();
});

it("preserves an ordinary history element outside the docked panel", () => {
  const viewport = createRef<HTMLDivElement>();
  render(
    <ChatHistoryViewport ref={viewport} className="assistant-thread">
      History
    </ChatHistoryViewport>,
  );
  expect(viewport.current).toHaveClass("assistant-thread");
  expect(viewport.current).not.toHaveAttribute(
    "data-radix-scroll-area-viewport",
  );
  expect(viewport.current).not.toHaveAttribute("tabindex");
});

it("scrolls the Radix history viewport when voice activation requests the bottom", () => {
  const scrollIntoView = vi.fn();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  const props = {
    page: undefined,
    messages: [],
    current: undefined,
    approvals: [],
    busy: false,
    showWelcome: false,
    starters: false,
    empty: false,
    hasOlder: false,
    onOlder: vi.fn(),
    onPick: vi.fn(),
    onControl: vi.fn(),
    onDecide: vi.fn(),
    onRecover: vi.fn(),
  };
  const content = (request: number) => (
    <ChatPanelScrollArea>
      <aside>
        <ManagedAgentHistory {...props} scrollToBottomRequest={request} />
        <ChatPanelScrollbar />
      </aside>
    </ChatPanelScrollArea>
  );
  const view = render(content(0));
  const viewport = view.container.querySelector<HTMLElement>(
    "[data-radix-scroll-area-viewport]",
  )!;
  Object.defineProperty(viewport, "scrollHeight", {
    configurable: true,
    value: 900,
  });
  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    value: 200,
  });
  viewport.scrollTop = 100;
  fireEvent.scroll(viewport);
  view.rerender(content(1));
  expect(viewport.scrollTop).toBe(900);
});
