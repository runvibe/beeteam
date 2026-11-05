export type AnalyticsProduct = "app" | "site";
export const areas = [
  "home", "boards", "tasks", "agents", "teams", "settings", "other", "landing",
  "guide_about", "guide_installation", "guide_connection", "guide_usage",
  "guide_reference", "guide_troubleshooting", "guide_updates", "guide_other", "privacy", "terms",
] as const;
export type UsageEvent = {
  name: "screen_view" | "ui_open";
  product: AnalyticsProduct;
  mode: "local" | "hosted";
  language: "en" | "pt";
  area: typeof areas[number];
};

export function isUsageEvent(value: unknown): value is UsageEvent {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 5) return false;
  const event = value as Record<string, unknown>;
  if (!Object.values(event).every((entry) => typeof entry === "string")) return false;
  return ["screen_view", "ui_open"].includes(String(event.name)) &&
    ["app", "site"].includes(String(event.product)) &&
    ["local", "hosted"].includes(String(event.mode)) &&
    ["en", "pt"].includes(String(event.language)) &&
    areas.includes(event.area as typeof areas[number]);
}

export function usageEvent(product: AnalyticsProduct, path: string, language: string, hostname: string): UsageEvent {
  const parts = path.split(/[?#]/)[0].replace(/^\/pt(?=\/|$)/, "").replace(/^\/app(?=\/|$)/, "").split("/").filter(Boolean);
  let area: UsageEvent["area"] = "other";
  if (product === "app") {
    const first = parts[0] ?? "home";
    if (["home", "boards", "tasks", "agents", "teams", "settings"].includes(first)) area = first as UsageEvent["area"];
  } else if (!parts.length) area = "landing";
  else if (parts[0] === "privacy" || parts[0] === "terms") area = parts[0];
  else if (parts[0] === "guide") {
    const topic = parts[1] ?? "about";
    area = topic === "reference" ? "guide_reference"
      : topic === "installation" ? "guide_installation"
      : ["connect", "local-connection"].includes(topic) ? "guide_connection"
      : ["first-team", "parallel-tasks", "review"].includes(topic) ? "guide_usage"
      : topic === "about" ? "guide_about"
      : topic === "updates" ? "guide_updates"
      : topic === "troubleshooting" ? "guide_troubleshooting" : "guide_other";
  }
  return { name: "screen_view", product, mode: ["localhost", "127.0.0.1", "[::1]"].includes(hostname) ? "local" : "hosted", language: language.startsWith("pt") ? "pt" : "en", area };
}
