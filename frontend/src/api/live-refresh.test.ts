import { describe, it, expect, vi, afterEach } from "vitest";
import { startLiveRefresh, type ChangeSource } from "./live-refresh";
afterEach(() => vi.useRealTimers());
describe("live refresh lifecycle", () => {
  it("coalesces changes, refreshes reconnect, polls only while disconnected and cleans up", async () => {
    vi.useFakeTimers();
    let handlers!: Parameters<ChangeSource>[0];
    const close = vi.fn();
    const source: ChangeSource = (h) => {
      handlers = h;
      return close;
    };
    const refresh = vi.fn(async () => {});
    const status = vi.fn();
    const stop = startLiveRefresh({ source, refresh, status, document });
    handlers.open();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    handlers.change();
    handlers.change();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(2);
    handlers.error();
    await vi.advanceTimersByTimeAsync(15200);
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(status).toHaveBeenLastCalledWith("reconnecting");
    handlers.open();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(15000);
    expect(refresh).toHaveBeenCalledTimes(4);
    stop();
    handlers.change();
    await vi.advanceTimersByTimeAsync(30000);
    expect(refresh).toHaveBeenCalledTimes(4);
    expect(close).toHaveBeenCalledOnce();
  });
  it("does not lose an event received during a fetch", async () => {
    vi.useFakeTimers();
    let handlers!: Parameters<ChangeSource>[0];
    let release!: () => void;
    const refresh = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => (release = r)))
      .mockResolvedValue(undefined);
    const stop = startLiveRefresh({
      source: (h) => {
        handlers = h;
        return () => {};
      },
      refresh,
      status: () => {},
      document,
    });
    handlers.open();
    await vi.advanceTimersByTimeAsync(200);
    handlers.change();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
  });
});
it("pauses hidden-tab refreshes and reconciles on visibility return", async () => {
  vi.useFakeTimers();
  let handlers!: Parameters<ChangeSource>[0];
  const refresh = vi.fn(async () => {});
  const state = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  const stop = startLiveRefresh({
    source: (h) => {
      handlers = h;
      return () => {};
    },
    refresh,
    status: () => {},
    document,
  });
  handlers.change();
  handlers.error();
  await vi.advanceTimersByTimeAsync(31000);
  expect(refresh).not.toHaveBeenCalled();
  state.mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(200);
  expect(refresh).toHaveBeenCalledOnce();
  stop();
  state.mockRestore();
});
