import { currentUrl, navigate } from "./location";
export function isTaskDetailsView(url: string) {
  return new URLSearchParams(url.split("?")[1]).get("task.view") === "details";
}
export function taskMainUrl(url = currentUrl()) {
  const [path, search] = url.split("?");
  const query = new URLSearchParams(search);
  query.delete("task.view");
  return path + (query.size ? `?${query}` : "");
}
export function openTaskDetails() {
  const previous = currentUrl();
  if (isTaskDetailsView(previous)) return;
  const [path, search] = previous.split("?");
  const query = new URLSearchParams(search);
  query.set("task.view", "details");
  navigate(`${path}?${query}`);
  window.history.replaceState(
    { ...window.history.state, taskDetailsReturnUrl: previous },
    "",
  );
}
export function closeTaskDetails() {
  const fallback = taskMainUrl();
  const state = window.history.state;
  if (state?.bee && state.index > 0 && typeof state.taskDetailsReturnUrl === "string" && taskMainUrl(state.taskDetailsReturnUrl) === fallback)
    window.history.back();
  else navigate(fallback, true);
}
