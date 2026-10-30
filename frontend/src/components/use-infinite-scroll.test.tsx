import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useInfiniteScroll } from "./use-infinite-scroll";

it("serializes intersections, fills after progress and stops on error/end/unmount", () => {
  let enter: IntersectionObserverCallback = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        enter = cb;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const sentinel = { current: document.createElement("div") };
  const loadMore = vi.fn();
  const options = {
    sentinel,
    getRoot: () => null,
    progress: "a",
    hasMore: true,
    fetching: false,
    error: null as unknown,
    loadMore,
  };
  const hook = renderHook((props) => useInfiniteScroll(props), {
    initialProps: options,
  });
  const intersect = () =>
    enter(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
  act(() => {
    intersect();
    intersect();
  });
  expect(loadMore).toHaveBeenCalledTimes(1);
  hook.rerender({ ...options, fetching: true });
  act(intersect);
  expect(loadMore).toHaveBeenCalledTimes(1);
  hook.rerender({ ...options, progress: "a,b" });
  act(intersect);
  expect(loadMore).toHaveBeenCalledTimes(2);
  hook.rerender({ ...options, progress: "a,b,c", error: new Error("offline") });
  act(intersect);
  expect(loadMore).toHaveBeenCalledTimes(2);
  hook.rerender({ ...options, progress: "a,b,c", hasMore: false });
  act(intersect);
  expect(loadMore).toHaveBeenCalledTimes(2);
  hook.unmount();
  act(intersect);
  expect(loadMore).toHaveBeenCalledTimes(2);
  expect(disconnect).toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it("autofills a visible sentinel across pages without another scroll, then stops outside the root", () => {
  const root = document.createElement("div");
  const target = document.createElement("div");
  root.append(target);
  let top = 100;
  root.getBoundingClientRect = () =>
    ({ top: 0, bottom: 600, height: 600 }) as DOMRect;
  target.getBoundingClientRect = () =>
    ({ top, bottom: top + 60, height: 60 }) as DOMRect;
  const loadMore = vi.fn();
  const options = {
    sentinel: { current: target },
    getRoot: () => root,
    progress: "1",
    hasMore: true,
    fetching: false,
    error: null,
    loadMore,
  };
  const hook = renderHook((props) => useInfiniteScroll(props), {
    initialProps: options,
  });
  expect(loadMore).toHaveBeenCalledTimes(1);
  hook.rerender({ ...options, fetching: true });
  expect(loadMore).toHaveBeenCalledTimes(1);
  hook.rerender({ ...options, progress: "1,2" });
  expect(loadMore).toHaveBeenCalledTimes(2);
  top = 800;
  hook.rerender({ ...options, progress: "1,2,3" });
  expect(loadMore).toHaveBeenCalledTimes(2);
  top = 100;
  act(() => window.dispatchEvent(new Event("resize")));
  expect(loadMore).toHaveBeenCalledTimes(3);
  hook.rerender({ ...options, progress: "1,2,3" });
  act(() => window.dispatchEvent(new Event("resize")));
  expect(loadMore).toHaveBeenCalledTimes(3);
});
