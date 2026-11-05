import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { useList } from "@/api/context";
import { ApiVersionGate } from "./api-version-gate";
import { onlineManager } from "@tanstack/react-query";
import { setLocalePreference } from "@/i18n";
beforeEach(() =>
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline"))),
);
afterEach(() => vi.unstubAllGlobals());
it("discovers loopback and loads business data while the browser reports offline", async () => {
  onlineManager.setOnline(false);
  try {
    const api = createMockApi({ delay: 0 });
    api.info = vi.fn().mockResolvedValue(info("1.2.3"));
    const list = vi.spyOn(api, "list");
    render(
      <ApiProvider api={api}>
        <ApiVersionGate expectedVersion="1.2.3">
          <Business />
        </ApiVersionGate>
      </ApiProvider>,
    );
    await screen.findByText("Business panel");
    expect(list).toHaveBeenCalledTimes(1);
  } finally {
    onlineManager.setOnline(true);
  }
});

const info = (apiVersion: string) => ({
  apiVersion,
  supportedContractVersions: ["v2"],
  capabilities: ["roles.worker"],
});
function Business() {
  useList("boards");
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

it.each([
  ["en", "Install Bee Team", "Can't connect", ""],
  ["pt", "Instalar Bee Team", "Não consigo conectar", "/pt"],
] as const)("offers direct localized installation and connection help in %s", async (locale, installLabel, helpLabel, prefix) => {
  setLocalePreference(locale);
  const api = createMockApi({ delay: 0 });
  api.info = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  render(
    <ApiProvider api={api}>
      <ApiVersionGate expectedVersion="1.2.3"><Business /></ApiVersionGate>
    </ApiProvider>,
  );
  const install = await screen.findByRole("link", { name: installLabel });
  expect(install).toHaveAttribute("href", `https://getbee.team${prefix}/guide/installation`);
  expect(install).toHaveAttribute("data-slot", "button");
  expect(screen.getByRole("link", { name: helpLabel })).toHaveAttribute("href", `https://getbee.team${prefix}/guide/local-connection`);
  expect(screen.queryByText("Business panel")).toBeNull();
});
