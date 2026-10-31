import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useConversationAnchor } from "./conversation-anchor";

it.each([
  [true, 0],
  [true, 240],
  [false, 0],
  [false, 240],
] as const)(
  "preserves initial data and cached remount with desktop=%s at %s",
  (desktop, position) => {
    vi.stubGlobal("matchMedia", () => ({ matches: desktop }));
    const root = document.createElement("div");
    const originalScroller = Object.getOwnPropertyDescriptor(
      document,
      "scrollingElement",
    );
    if (!desktop)
      Object.defineProperty(document, "scrollingElement", {
        configurable: true,
        value: root,
      });
    root.dataset.detailScroll = "";
    const list = document.createElement("section");
    root.append(list);
    document.body.append(root);
    Object.defineProperties(root, {
      scrollHeight: { configurable: true, value: 3000 },
      clientHeight: { value: 600 },
    });
    root.scrollTop = position;
    const ref = { current: list };
    const identity = `initial-${position}`;
    const hook = renderHook(
      ({ version }) => useConversationAnchor(ref, identity, version),
      { initialProps: { version: 0 } },
    );
    const row = document.createElement("article");
    row.dataset.commentId = "first";
    row.getBoundingClientRect = () => ({ top: 300, bottom: 400 }) as DOMRect;
    list.append(row);
    hook.rerender({ version: 1 });
    expect(root.scrollTop).toBe(position);
    act(() => hook.result.current.followEnd());
    Object.defineProperty(root, "scrollHeight", { value: 4000 });
    hook.rerender({ version: 2 });
    expect(root.scrollTop).toBe(4000);
    act(() => hook.result.current.goToEnd());
    hook.unmount();
    root.scrollTop = position;
    const cached = renderHook(() => useConversationAnchor(ref, identity, 1));
    expect(root.scrollTop).toBe(position);
    cached.unmount();
    root.remove();
    if (!desktop) {
      if (originalScroller)
        Object.defineProperty(document, "scrollingElement", originalScroller);
      else Reflect.deleteProperty(document, "scrollingElement");
    }
    vi.unstubAllGlobals();
  },
);

it("keeps a visible message anchored during prepend and late layout changes", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const root = document.createElement("div");
  root.dataset.detailScroll = "";
  const list = document.createElement("section");
  root.append(list);
  document.body.append(root);
  const row = document.createElement("article");
  row.dataset.commentId = "anchor";
  list.append(row);
  let top = 80;
  root.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  row.getBoundingClientRect = () => ({ top, bottom: top + 100 }) as DOMRect;
  Object.defineProperties(root, {
    scrollHeight: { value: 3000 },
    clientHeight: { value: 600 },
  });
  root.scrollTop = 200;
  const ref = { current: list };
  const hook = renderHook(
    ({ version }) => useConversationAnchor(ref, "anchor-test", version),
    { initialProps: { version: 0 } },
  );
  act(() => hook.result.current.capture());
  top = 480;
  hook.rerender({ version: 1 });
  expect(root.scrollTop).toBe(600);
  expect(document.activeElement).not.toBe(row);
  hook.unmount();
  root.remove();
  vi.unstubAllGlobals();
});

it("does not pull the task header away when previous pages autofill below it", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const root = document.createElement("div");
  root.dataset.detailScroll = "";
  const list = document.createElement("section"),
    row = document.createElement("article");
  row.dataset.commentId = "autofill";
  list.append(row);
  root.append(list);
  document.body.append(root);
  list.getBoundingClientRect = () => ({ top: 350 }) as DOMRect;
  let top = 380;
  row.getBoundingClientRect = () => ({ top, bottom: top + 100 }) as DOMRect;
  Object.defineProperties(root, {
    scrollHeight: { value: 3000 },
    clientHeight: { value: 600 },
  });
  const hook = renderHook(
    ({ version }) =>
      useConversationAnchor({ current: list }, "autofill", version),
    { initialProps: { version: 0 } },
  );
  act(() => hook.result.current.capture());
  top = 1000;
  hook.rerender({ version: 1 });
  expect(root.scrollTop).toBe(0);
  // The explicit previous-page action anchors the visible message even while
  // sticky filters leave the list below the viewport's top edge.
  act(() => hook.result.current.capture(true));
  top = 1300;
  hook.rerender({ version: 2 });
  expect(root.scrollTop).toBe(300);
  hook.unmount();
  root.remove();
  vi.unstubAllGlobals();
});

it("rebinds anchor capture when the scroll root changes from mobile to desktop", () => {
  let desktop = false;
  vi.stubGlobal("matchMedia", () => ({ matches: desktop }));
  const root = document.createElement("div");
  root.dataset.detailScroll = "";
  const list = document.createElement("section"),
    row = document.createElement("article");
  row.dataset.commentId = "responsive";
  list.append(row);
  root.append(list);
  document.body.append(root);
  let top = 120;
  root.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  row.getBoundingClientRect = () => ({ top, bottom: top + 100 }) as DOMRect;
  Object.defineProperties(root, {
    scrollHeight: { value: 3000 },
    clientHeight: { value: 600 },
  });
  const hook = renderHook(
    ({ version }) =>
      useConversationAnchor({ current: list }, "responsive-anchor", version),
    { initialProps: { version: 0 } },
  );
  desktop = true;
  act(() => window.dispatchEvent(new Event("resize")));
  root.scrollTop = 500;
  top = 40;
  act(() => root.dispatchEvent(new Event("scroll")));
  top = 140;
  hook.rerender({ version: 1 });
  expect(root.scrollTop).toBe(600);
  hook.unmount();
  root.remove();
  vi.unstubAllGlobals();
});
