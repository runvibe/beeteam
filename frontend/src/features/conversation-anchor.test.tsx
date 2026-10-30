import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useConversationAnchor } from "./conversation-anchor";

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
    ({ version }) => useConversationAnchor(ref, "anchor-test", version, false),
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
      useConversationAnchor(
        { current: list },
        "responsive-anchor",
        version,
        false,
      ),
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
