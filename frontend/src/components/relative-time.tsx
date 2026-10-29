import { useSyncExternalStore } from "react";

let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, 60000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const snapshot = () => now;
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "always" });
const absolute = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
});
export function RelativeTime({ value }: { value?: string | null }) {
  const current = useSyncExternalStore(subscribe, snapshot);
  const timestamp = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(timestamp)) return <span>Data indisponível</span>;
  const delta = (timestamp - current) / 1000;
  const magnitude = Math.abs(delta);
  const unit = magnitude < 3600 ? "minute" : magnitude < 86400 ? "hour" : "day";
  const divisor = unit === "minute" ? 60 : unit === "hour" ? 3600 : 86400;
  const label =
    magnitude < 60
      ? "agora"
      : relative.format(Math.trunc(delta / divisor), unit);
  return (
    <time
      dateTime={new Date(timestamp).toISOString()}
      title={absolute.format(timestamp)}
    >
      {label}
    </time>
  );
}
