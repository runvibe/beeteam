import { expect, it, vi } from "vitest";
import { createHttpApi } from "./http";
const info = (apiVersion: string) => ({
  apiVersion,
  supportedContractVersions: ["v1", "v2"],
  capabilities: ["roles.worker"],
});
it.each(["1.2.2", "1.2.4", "1.2", "1.2.3+other"])(
  "sends no business requests for %s",
  async (version) => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(info(version))),
    );
    const api = createHttpApi({
      fetch: fetcher as typeof fetch,
      expectedAppVersion: "1.2.3",
    });
    await expect(api.list("boards")).rejects.toMatchObject({
      code: "frontend_api_version_mismatch",
    });
    expect(fetcher.mock.calls).toHaveLength(1);
  },
);
it("clears verified version on discovery failure and recovers on valid discovery", async () => {
  let version = "1.2.3",
    offline = false;
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/info")) {
      if (offline) throw new TypeError("offline");
      return new Response(JSON.stringify(info(version)));
    }
    return new Response(JSON.stringify({ items: [] }));
  });
  const api = createHttpApi({
    fetch: fetcher as typeof fetch,
    expectedAppVersion: version,
  });
  await api.list("boards");
  offline = true;
  await expect(api.info()).rejects.toMatchObject({ code: "network_error" });
  const boundary = fetcher.mock.calls.length;
  await expect(api.list("boards")).rejects.toMatchObject({
    code: "frontend_api_version_mismatch",
  });
  expect(fetcher.mock.calls).toHaveLength(boundary);
  offline = false;
  version = "1.2.4";
  await api.info();
  await expect(api.list("boards")).rejects.toMatchObject({
    code: "frontend_api_version_mismatch",
  });
  version = "1.2.3";
  await api.info();
  await api.list("boards");
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe("/api/v2/boards");
});
