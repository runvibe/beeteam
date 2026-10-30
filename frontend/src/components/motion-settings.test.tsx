import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  reduced: false,
  controls: { stop: vi.fn(), set: vi.fn(), start: vi.fn(async () => {}) },
}));
vi.mock("motion/react", () => ({
  useAnimationControls: () => state.controls,
  useReducedMotion: () => state.reduced,
}));
import { usePageEntrance } from "./motion-settings";
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  state.reduced = false;
});

it("reuses the page fade only when panel identity changes and cancels on unmount", () => {
  vi.useFakeTimers();
  const view = renderHook(
    ({ tab, query }) => {
      void query;
      return usePageEntrance(tab);
    },
    { initialProps: { tab: "plans", query: "offset=0" } },
  );
  expect(state.controls.set).toHaveBeenLastCalledWith({ opacity: 0.72 });
  act(() => vi.advanceTimersByTime(20));
  expect(state.controls.start).toHaveBeenLastCalledWith({
    opacity: 1,
    transition: { duration: 0.18, ease: "easeOut" },
  });
  view.rerender({ tab: "plans", query: "offset=5" });
  expect(state.controls.set).toHaveBeenCalledTimes(1);
  view.rerender({ tab: "overview", query: "offset=5" });
  expect(state.controls.set).toHaveBeenCalledTimes(2);
  view.unmount();
  act(() => vi.advanceTimersByTime(20));
  expect(state.controls.start).toHaveBeenCalledTimes(1);
});

it("keeps the panel fully opaque immediately for reduced motion", () => {
  vi.useFakeTimers();
  state.reduced = true;
  renderHook(() => usePageEntrance("plans"));
  expect(state.controls.set).toHaveBeenLastCalledWith({ opacity: 1 });
  act(() => vi.advanceTimersByTime(20));
  expect(state.controls.start).toHaveBeenLastCalledWith({
    opacity: 1,
    transition: { duration: 0, ease: "easeOut" },
  });
});
