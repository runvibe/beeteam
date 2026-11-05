import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { useEffect } from "react";
import { useApi } from "@/api/context";
import { ApiVersionGate } from "./api-version-gate";
beforeEach(() =>
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline"))),
);
afterEach(() => vi.unstubAllGlobals());

const info = (apiVersion: string) => ({
  apiVersion,
  supportedContractVersions: ["v2"],
  capabilities: ["roles.worker"],
});
function Business() {
  const api = useApi();
  useEffect(() => {
    void api.list("boards");
  }, [api]);
  return <p>Business panel</p>;
}
it.each(["1.2.2", "1.2.4", "invalid"])(
  "blocks the panel and live source for %s",
  async (version) => {
    const api = createMockApi({ delay: 0 });
    api.info = vi.fn().mockResolvedValue(info(version));
    const list = vi.spyOn(api, "list");
    const source = vi.fn(() => () => {});
    render(
      <ApiProvider api={api}>
        <ApiVersionGate expectedVersion="1.2.3" changes={source}>
          <Business />
        </ApiVersionGate>
      </ApiProvider>,
    );
    await waitFor(() => expect(api.info).toHaveBeenCalled());
    expect(screen.queryByText("Business panel")).toBeNull();
    expect(list).not.toHaveBeenCalled();
    expect(source).not.toHaveBeenCalled();
  },
);
it("recovers from discovery failure only after exact equality", async () => {
  const api = createMockApi({ delay: 0 });
  api.info = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("fetch failed"))
    .mockResolvedValue(info("1.2.3"));
  const list = vi.spyOn(api, "list");
  render(
    <ApiProvider api={api}>
      <ApiVersionGate expectedVersion="1.2.3">
        <Business />
      </ApiVersionGate>
    </ApiProvider>,
  );
  await screen.findByText("Não foi possível verificar a aplicação local.");
  expect(list).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Verificar conexão novamente" }),
  );
  await screen.findByText("Business panel");
  expect(list).toHaveBeenCalledTimes(1);
});
