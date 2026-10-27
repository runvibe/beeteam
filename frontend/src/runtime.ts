export const runtimeConfig = {
  mock: import.meta.env.VITE_API_MODE === "mock",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
};
