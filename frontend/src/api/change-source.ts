import type { ChangeSource } from "./live-refresh";
/** Notifications invalidate snapshots; heartbeat detects proxies holding dead connections open. */
export function createChangeSource(baseUrl: string): ChangeSource {
  return (handlers) => {
    let stopped = false;
    let stream: EventSource;
    let watchdog: ReturnType<typeof setTimeout>;
    const detach = () => {
      stream.onopen = null;
      stream.onerror = null;
      stream.removeEventListener("invalidate", change);
      stream.removeEventListener("reset", change);
      stream.removeEventListener("heartbeat", alive);
      stream.close();
    };
    const alive = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        if (stopped) return;
        handlers.error();
        detach();
        connect();
      }, 45000);
    };
    const change = () => {
      alive();
      handlers.change();
    };
    const connect = () => {
      stream = new EventSource(`${baseUrl.replace(/\/$/, "")}/changes`);
      stream.onopen = () => {
        alive();
        handlers.open();
      };
      stream.onerror = handlers.error;
      stream.addEventListener("invalidate", change);
      stream.addEventListener("reset", change);
      stream.addEventListener("heartbeat", alive);
      alive();
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(watchdog);
      detach();
    };
  };
}
