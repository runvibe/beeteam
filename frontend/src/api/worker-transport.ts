import { createTransport, type HttpOptions } from "./http-transport";
import { parseApiInfo, supportsWorkerContract } from "./api-info";
import type { ApiInfo } from "./generated/system/ApiInfo";
import { ApiError } from "./types";
import { fromLegacyWorker, toLegacyWorker } from "./legacy-worker";
import { assessApiVersion } from "./version-policy";

/** Cancel one consumer without aborting discovery shared by other requests. */
function withSignal<T>(
  promise: Promise<T>,
  signal?: AbortSignal | null,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
export function createWorkerTransport(options: HttpOptions) {
  const base = (options.baseUrl ?? "/api/v1").replace(/\/$/, "");
  const legacy = createTransport({
    ...options,
    baseUrl: base.replace(/\/v2$/, "/v1"),
  });
  const worker = createTransport({
    ...options,
    baseUrl: base.replace(/\/v1$/, "/v2"),
  });
  const discovery = options.expectedAppVersion
    ? createTransport({
        ...options,
        baseUrl: base.replace(/\/v2$/, "/v1"),
        timeoutMs: 3000,
      })
    : legacy;
  let verified: ApiInfo | undefined;
  let attempted = false;
  let pending: Promise<ApiInfo> | undefined;
  function info(signal?: AbortSignal) {
    if (!pending) {
      pending = discovery<unknown>("/info")
        .then(parseApiInfo)
        .then((value) => {
          verified = value;
          return value;
        })
        .catch((error: unknown) => {
          if (
            options.expectedAppVersion ||
            (error instanceof ApiError && error.status === 404)
          )
            verified = undefined;
          throw error;
        })
        .finally(() => {
          attempted = true;
          pending = undefined;
        });
    }
    return withSignal(pending, signal);
  }
  async function request<T>(
    path: string,
    init: RequestInit = {},
    binary = false,
  ): Promise<T> {
    if (!attempted || pending) {
      // Discovery failure leaves legacy reading available; info() still reports the error to the UI.
      await withSignal(
        (pending ?? info()).catch(() => undefined),
        init.signal,
      );
    }
    if (init.signal?.aborted) throw init.signal.reason;
    if (
      options.expectedAppVersion &&
      (!verified ||
        assessApiVersion(options.expectedAppVersion, verified) !== "compatible")
    )
      throw new ApiError(
        409,
        "frontend_api_version_mismatch",
        "frontend_api_version_mismatch",
      );
    if (supportsWorkerContract(verified)) return worker<T>(path, init, binary);
    const adapted = toLegacyWorker(path, init);
    const value = await legacy<unknown>(adapted.path, adapted.init, binary);
    return (binary ? value : fromLegacyWorker(path, value)) as T;
  }
  async function auxiliary<T>(
    path: string,
    init: RequestInit = {},
    binary = false,
  ): Promise<T> {
    if (options.expectedAppVersion) {
      await withSignal(pending ?? info(), init.signal);
      if (
        !verified ||
        assessApiVersion(options.expectedAppVersion, verified) !== "compatible"
      )
        throw new ApiError(
          409,
          "frontend_api_version_mismatch",
          "frontend_api_version_mismatch",
        );
    }
    return legacy<T>(path, init, binary);
  }
  return { info, request, auxiliary };
}
