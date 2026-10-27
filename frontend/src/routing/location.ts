import { useEffect, useSyncExternalStore } from "react";
const eventName = "beeteam:navigate";
export const currentUrl = () => location.pathname + location.search;
function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(eventName, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(eventName, notify);
  };
}
export function useLocation() {
  return useSyncExternalStore(subscribe, currentUrl, () => "/boards");
}
const positions = new Map<
  string,
  { x: number; y: number; column: number; panel: number }
>();
function savePosition(url: string) {
  positions.set(url, {
    x: window.scrollX,
    y: window.scrollY,
    column: document.querySelector(".kanban")?.scrollLeft ?? 0,
    panel: document.querySelector(".detail-scroll")?.scrollTop ?? 0,
  });
}
export function navigate(to: string, replace = false) {
  savePosition(currentUrl());
  const previous = currentUrl();
  if (to === previous) return;
  if (to.split("?")[0] === previous.split("?")[0])
    positions.set(to, positions.get(previous)!);
  let old = window.history.state;
  if (!old?.bee) {
    old = { bee: true, index: 0 };
    window.history.replaceState(old, "", previous);
  }

  const from = safeOrigin(new URLSearchParams(to.split("?")[1]).get("from"));
  const samePage =
    to.split("?")[0].replace(/\/settings$/, "") ===
      previous.split("?")[0].replace(/\/settings$/, "") &&
    from === (old.returnUrl ?? null);
  const next = {
    bee: true,
    index: old.index + (replace ? 0 : 1),
    returnIndex: samePage
      ? old.returnIndex
      : from === previous
        ? old.index
        : undefined,
    returnUrl: samePage ? old.returnUrl : from,
  };
  window.history[replace ? "replaceState" : "pushState"](next, "", to);
  window.dispatchEvent(new Event(eventName));
}
export function safeOrigin(value: string | null): string | null {
  if (
    !value ||
    !/^\/(boards|tasks|agents|teams)(\/|\?|$)/.test(value) ||
    value.startsWith("//")
  )
    return null;
  try {
    const url = new URL(value, location.origin);
    return url.origin === location.origin && isKnownRoute(url.pathname)
      ? url.pathname + url.search
      : null;
  } catch {
    return null;
  }
}
export function destination(path: string) {
  return `${path}?${new URLSearchParams({ from: currentUrl() })}`;
}
export function goBack(fallback = "/boards") {
  const from = safeOrigin(new URLSearchParams(location.search).get("from"));
  savePosition(currentUrl());
  const entry = window.history.state;
  if (
    from &&
    entry?.bee &&
    entry.returnUrl === from &&
    Number.isInteger(entry.returnIndex) &&
    entry.returnIndex < entry.index
  )
    window.history.go(entry.returnIndex - entry.index);
  else navigate(from ?? fallback, true);
}
export function useRestorePosition() {
  const url = useLocation();
  useEffect(() => {
    const position = positions.get(url);
    const save = () => savePosition(url);
    window.addEventListener("scroll", save, true);
    const frame = requestAnimationFrame(() => {
      window.scrollTo(position?.x ?? 0, position?.y ?? 0);
      const column = document.querySelector(".kanban");
      if (column) column.scrollLeft = position?.column ?? 0;
      const panel = document.querySelector(".detail-scroll");
      if (panel) panel.scrollTop = position?.panel ?? 0;
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", save, true);
    };
  }, [url]);
}

export function subroute(path: string) {
  const params = new URLSearchParams(location.search);
  params.set("from", currentUrl());
  return path + `?${params}`;
}
export function isKnownRoute(url: string) {
  return /^\/(?:boards(?:\/[^/]+(?:\/settings)?)?|tasks\/[^/]+|agents(?:\/[^/]+(?:\/settings)?)?|teams(?:\/[^/]+(?:\/settings)?)?)?\/?$/.test(
    url.split("?")[0],
  );
}
