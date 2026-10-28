import { it, expect, vi } from "vitest";
import { createChangeSource } from "./change-source";
it("reopens a silent connection and keeps heartbeat separate from invalidation", () => {
  vi.useFakeTimers();
  const streams: any[] = [];
  vi.stubGlobal(
    "EventSource",
    vi.fn(function () {
      const stream = {
        onopen: null,
        onerror: null,
        listeners: new Map(),
        addEventListener(name: string, fn: () => void) {
          this.listeners.set(name, fn);
        },
        removeEventListener: vi.fn(),
        close: vi.fn(),
      };
      streams.push(stream);
      return stream;
    }),
  );
  try {
    const handlers = { open: vi.fn(), change: vi.fn(), error: vi.fn() };
    const close = createChangeSource("/api/v1/")(handlers);
    streams[0].onopen();
    vi.advanceTimersByTime(30000);
    streams[0].listeners.get("heartbeat")();
    vi.advanceTimersByTime(30000);
    expect(streams).toHaveLength(1);
    expect(handlers.change).not.toHaveBeenCalled();
    vi.advanceTimersByTime(15000);
    expect(handlers.error).toHaveBeenCalledOnce();
    expect(streams[0].close).toHaveBeenCalledOnce();
    expect(streams).toHaveLength(2);
    streams[1].onopen();
    streams[1].listeners.get("reset")();
    expect(handlers.open).toHaveBeenCalledTimes(2);
    expect(handlers.change).toHaveBeenCalledOnce();
    close();
    vi.advanceTimersByTime(90000);
    expect(streams).toHaveLength(2);
    expect(streams[1].close).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
