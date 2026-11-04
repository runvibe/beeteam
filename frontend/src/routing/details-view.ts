import { currentUrl, navigate } from "./location";
export function isDetailsView(url: string, key: string) {
  return new URLSearchParams(url.split("?")[1]).get(key) === "details";
}
export function mainDetailsUrl(key: string, url = currentUrl()) {
  const [path, search] = url.split("?");
  const query = new URLSearchParams(search);
  query.delete(key);
  return path + (query.size ? `?${query}` : "");
}
export function openDetails(key: string) {
  const previous = currentUrl();
  if (isDetailsView(previous, key)) return;
  const [path, search] = previous.split("?");
  const query = new URLSearchParams(search);
  query.set(key, "details");
  navigate(`${path}?${query}`);
  window.history.replaceState(
    {
      ...window.history.state,
      detailReturn: {
        key,
        url: previous,
        index: window.history.state.index - 1,
      },
    },
    "",
  );
}
export function closeDetails(key: string) {
  const fallback = mainDetailsUrl(key);
  const state = window.history.state;
  const origin = state?.detailReturn;
  if (
    state?.bee &&
    origin?.key === key &&
    Number.isInteger(origin.index) &&
    origin.index >= 0 &&
    origin.index < state.index &&
    typeof origin.url === "string" &&
    mainDetailsUrl(key, origin.url) === fallback
  ) {
    const distance = origin.index - state.index;
    if (distance === -1) window.history.back();
    else window.history.go(distance);
  } else navigate(fallback, true);
}
