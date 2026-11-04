import { message } from "@/i18n";
import { ApiError } from "./types";
export type HttpOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};
export function createTransport(options: HttpOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const base = (options.baseUrl ?? "/api/v1").replace(/\/$/, "");
  return async function request<T>(
    path: string,
    init: RequestInit = {},
    binary = false,
  ): Promise<T> {
    const controller = new AbortController();
    const cancel = () => controller.abort(init.signal?.reason);
    if (init.signal?.aborted) cancel();
    else init.signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 30000,
    );
    try {
      const headers = new Headers(init.headers);
      if (init.body) headers.set("Content-Type", "application/json");
      if (init.method && init.method !== "GET")
        headers.set("X-Actor-Kind", "human");
      const response = await fetcher(base + path, {
        ...init,
        headers,
        signal: controller.signal,
        credentials: "omit",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiError(
          response.status,
          body?.code ?? "http_error",
          typeof body?.error === "string"
            ? body.error
            : message("errors.http", { status: response.status }),
        );
      }
      if (binary) return (await response.blob()) as T;
      try {
        return (await response.json()) as T;
      } catch {
        throw new ApiError(
          response.status,
          "invalid_response",
          message("errors.theApiReturnedAnInvalidResponse"),
        );
      }
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        0,
        "network_error",
        controller.signal.aborted
          ? message("errors.theApiTimedOutCheckTheResultBeforeRepeatingThe")
          : message("errors.couldNotConnectToTheApiTryAgain"),
      );
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", cancel);
    }
  };
}
