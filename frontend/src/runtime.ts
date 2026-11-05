export function apiBaseForHost(hostname: string, configured?: string) {
  if (configured) return configured;
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
    ? "/api/v1"
    : "http://127.0.0.1:59865/api/v1";
}
export const runtimeConfig = {
  mock: import.meta.env.VITE_API_MODE === "mock",
  apiBaseUrl: apiBaseForHost(
    location.hostname,
    import.meta.env.VITE_API_BASE_URL,
  ),
};
