export type ChangeSource = (handlers: {
  open: () => void;
  change: () => void;
  error: () => void;
}) => () => void;
export type LiveStatus = "connecting" | "connected" | "reconnecting";
/** Notifications are hints; the API remains authoritative. At most one refresh runs at a time. */
export function startLiveRefresh({
  source,
  refresh,
  status,
  document: doc,
}: {
  source: ChangeSource;
  refresh: () => Promise<unknown>;
  status: (value: LiveStatus) => void;
  document: Document;
}) {
  let stopped = false,
    pending = false,
    running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let polling: ReturnType<typeof setInterval> | undefined;
  const visible = () => doc.visibilityState !== "hidden";
  const schedule = () => {
    if (stopped) return;
    pending = true;
    if (!timer && !running && visible()) timer = setTimeout(run, 150);
  };
  const run = async () => {
    timer = undefined;
    if (stopped || running || !visible()) return;
    pending = false;
    running = true;
    try {
      await refresh();
    } catch {
      /* Query errors are surfaced by their owning views. */
    } finally {
      running = false;
      if (pending && !stopped) schedule();
    }
  };
  const disconnected = () => {
    if (stopped) return;
    status("reconnecting");
    polling ??= setInterval(() => {
      if (visible()) schedule();
    }, 15000);
  };
  status("connecting");
  // A stalled initial connection also enters bounded fallback polling.
  const initial = setTimeout(disconnected, 10000);
  let close = () => {};
  try {
    close = source({
      open: () => {
        if (stopped) return;
        clearTimeout(initial);
        clearInterval(polling);
        polling = undefined;
        status("connected");
        schedule();
      },
      change: schedule,
      error: disconnected,
    });
  } catch {
    disconnected();
  }
  const resume = () => {
    if (visible()) schedule();
  };
  doc.addEventListener("visibilitychange", resume);
  return () => {
    stopped = true;
    clearTimeout(initial);
    clearTimeout(timer);
    clearInterval(polling);
    doc.removeEventListener("visibilitychange", resume);
    close();
  };
}
