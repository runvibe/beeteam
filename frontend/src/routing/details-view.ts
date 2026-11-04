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
    { ...window.history.state, [key === "task.view" ? "taskDetailsReturnUrl" : `${key}.returnUrl`]: previous },
    "",
  );
}
export function closeDetails(key: string) {
  const fallback = mainDetailsUrl(key);
  const state = window.history.state;
  if (state?.bee && state.index > 0 && typeof state[key === "task.view" ? "taskDetailsReturnUrl" : `${key}.returnUrl`] === "string" && mainDetailsUrl(key, state[key === "task.view" ? "taskDetailsReturnUrl" : `${key}.returnUrl`]) === fallback)
    window.history.back();
  else navigate(fallback, true);
}
