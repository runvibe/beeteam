import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
// jsdom has no layout engine; Radix observes size for switch measurement.
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof window !== "undefined") window.ResizeObserver = TestResizeObserver;
