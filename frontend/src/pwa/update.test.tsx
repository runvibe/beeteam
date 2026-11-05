import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PwaUpdate } from "./update";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ApiVersionGate } from "@/components/api-version-gate";
import { useQueryClient } from "@tanstack/react-query";
import { apiInfoKey } from "@/api/compatibility";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function waitingUpdate() {
  vi.stubEnv("PROD", true);
  const registration = Object.assign(new EventTarget(), {
    waiting: { state: "installed", postMessage: vi.fn() },
    installing: null,
  });
  const serviceWorker = Object.assign(new EventTarget(), {
    register: vi.fn().mockResolvedValue(registration),
  });
  vi.stubGlobal("navigator", { serviceWorker, onLine: true });
  return serviceWorker;
}

function Disconnect() {
  const client = useQueryClient();
  return <button onClick={() => void client.invalidateQueries({ queryKey: apiInfoKey })}>Disconnect</button>;
}

it("keeps update detection active while hiding the notice until allowed", async () => {
  const worker = waitingUpdate();
  const view = render(<PwaUpdate visible={false} />);
  await act(async () => { await Promise.resolve(); });
  expect(worker.register).toHaveBeenCalledOnce();
  expect(screen.queryByRole("region", { name: "Atualização do app pronta" })).toBeNull();
  view.rerender(<PwaUpdate visible />);
  expect(await screen.findByRole("region", { name: "Atualização do app pronta" })).toBeVisible();
  view.rerender(<PwaUpdate visible={false} />);
  expect(screen.queryByRole("region", { name: "Atualização do app pronta" })).toBeNull();
  expect(worker.register).toHaveBeenCalledOnce();
});

it("shows the update notice only after the local API connects with a matching version", async () => {
  const worker = waitingUpdate();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  const api = createMockApi({ delay: 0 });
  let resolveInfo!: (value: unknown) => void;
  api.info = vi.fn().mockImplementation(() => new Promise(resolve => { resolveInfo = resolve; }));
  render(<ApiProvider api={api}><ApiVersionGate expectedVersion="1.2.3"><p>Connected</p><Disconnect /></ApiVersionGate></ApiProvider>);
  await act(async () => { await Promise.resolve(); });
  expect(worker.register).toHaveBeenCalledOnce();
  expect(screen.queryByRole("region", { name: "Atualização do app pronta" })).toBeNull();
  await act(async () => resolveInfo({ apiVersion: "1.2.3", supportedContractVersions: ["v2"], capabilities: ["roles.worker"] }));
  expect(await screen.findByText("Connected")).toBeVisible();
  expect(await screen.findByRole("region", { name: "Atualização do app pronta" })).toBeVisible();
  vi.mocked(api.info).mockRejectedValue(new TypeError("connection lost"));
  fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
  await screen.findByText("Não foi possível verificar a aplicação local.");
  await waitFor(() => expect(screen.queryByRole("region", { name: "Atualização do app pronta" })).toBeNull());
  expect(worker.register).toHaveBeenCalledOnce();
});

it("hides a waiting PWA update when the local API needs a version update", async () => {
  const worker = waitingUpdate();
  const api = createMockApi({ delay: 0 });
  api.info = vi.fn().mockResolvedValue({ apiVersion: "1.2.2", supportedContractVersions: ["v2"], capabilities: ["roles.worker"] });
  render(<ApiProvider api={api}><ApiVersionGate expectedVersion="1.2.3"><p>Connected</p></ApiVersionGate></ApiProvider>);
  await act(async () => { await Promise.resolve(); });
  expect(worker.register).toHaveBeenCalledOnce();
  expect(screen.queryByText("Connected")).toBeNull();
  expect(screen.queryByRole("region", { name: "Atualização do app pronta" })).toBeNull();
});
