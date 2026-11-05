import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "./context";
import { createMockApi } from "./mock";
import { ApiError, type BeeApi } from "./types";
import { apiInfoKey, parseApiInfo } from "./compatibility";
import {
  ApiCompatibilityBanner,
  ApiCompatibilityDetails,
} from "@/components/api-compatibility";
import { TeamForm } from "@/features/teams";
import { makeSeed } from "./seed";
import { setLocalePreference } from "@/i18n";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
const info = {
  apiVersion: "0.0.1",
  supportedContractVersions: ["v1"],
  capabilities: ["teams.role-icons", "unknown.future"],
};
function setup(read: BeeApi["info"], locale: "en" | "pt" = "en") {
  setLocalePreference(locale);
  const seed = makeSeed();
  const api = createMockApi({ delay: 0, seed });
  api.info = read;
  const patch = vi.spyOn(api, "patch");
  let client!: QueryClient;
  function Capture() {
    client = useQueryClient();
    return null;
  }
  render(
    <ApiProvider api={api}>
      <Capture />
      <ApiCompatibilityBanner />
      <ApiCompatibilityDetails />
      <TeamForm team={seed.teams[0]} />
    </ApiProvider>,
  );
  return {
    api,
    patch,
    get client() {
      return client;
    },
  };
}
it("uses contract and capability identifiers independently of release numbers and shares discovery", async () => {
  const read = vi.fn().mockResolvedValue(info);
  setup(read);
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: "Leader icon" }),
    ).toBeEnabled(),
  );
  expect(read).toHaveBeenCalledTimes(1);
  expect(screen.getByText("0.0.1")).toBeInTheDocument();
  expect(
    screen.getByText("teams.role-icons, unknown.future"),
  ).toBeInTheDocument();
});
it.each(["en", "pt"] as const)(
  "isolates a missing optional capability and protects legacy metadata writes in %s",
  async (locale) => {
    const { patch } = setup(
      vi.fn().mockResolvedValue({
        ...info,
        apiVersion: "999.0.0",
        capabilities: [],
      }),
      locale,
    );
    await screen.findByText(
      locale === "en"
        ? /Update Get Bee Team to configure/
        : /Atualize o Get Bee Team para configurar/,
    );
    expect(
      screen.getByRole("combobox", {
        name: locale === "en" ? "Leader icon" : "Ícone do líder",
      }),
    ).toBeDisabled();
    const name = screen.getByRole("textbox", {
      name: locale === "en" ? "Name" : "Nome",
    });
    fireEvent.change(name, { target: { value: "Preserved metadata" } });
    fireEvent.blur(name);
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][2]).toEqual(
      expect.objectContaining({ name: "Preserved metadata" }),
    );
    expect(patch.mock.calls[0][2]).not.toHaveProperty("leaderIconId");
    expect(patch.mock.calls[0][2]).not.toHaveProperty("workerIconId");
  },
);
it.each([404, 503, 0])(
  "distinguishes discovery failure %s and recovers without losing draft or focus",
  async (status) => {
    const read = vi
      .fn()
      .mockRejectedValue(new ApiError(status, "test", "Failure"));
    const view = setup(read);
    await waitFor(() =>
      expect(
        screen.getAllByText(
          status === 404
            ? /verification is unavailable/
            : /Check the connection/,
        ).length,
      ).toBeGreaterThan(0),
    );
    const name = screen.getByRole("textbox", { name: "Name" });
    name.focus();
    fireEvent.change(name, { target: { value: "Unsaved draft" } });
    expect(
      screen.getByRole("combobox", { name: "Leader icon" }),
    ).toBeDisabled();
    read.mockResolvedValue(info);
    await act(async () => {
      await view.client.invalidateQueries({ queryKey: apiInfoKey });
    });
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Leader icon" }),
      ).toBeEnabled(),
    );
    expect(name).toHaveFocus();
    expect(name).toHaveValue("Unsaved draft");
    expect(view.patch).not.toHaveBeenCalled();
  },
);
it("warns about an unsupported contract without removing existing form data", async () => {
  setup(
    vi.fn().mockResolvedValue({ ...info, supportedContractVersions: ["v2"] }),
  );
  await waitFor(() =>
    expect(
      screen.getAllByText(/contract is incompatible/).length,
    ).toBeGreaterThan(0),
  );
  expect(screen.getByRole("textbox", { name: "Name" })).toBeEnabled();
  expect(
    screen.getByRole("combobox", { name: "Leader icon" }),
  ).toBeDisabled();
});
it("retains last verified support across transient refresh failures", async () => {
  const read = vi.fn().mockResolvedValue(info);
  const view = setup(read);
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: "Leader icon" }),
    ).toBeEnabled(),
  );
  read.mockRejectedValue(new ApiError(503, "unavailable", "Unavailable"));
  await act(async () => {
    await view.client.invalidateQueries({ queryKey: apiInfoKey });
  });
  await waitFor(() =>
    expect(
      screen.getAllByText(/Check the connection/).length,
    ).toBeGreaterThan(0),
  );
  expect(screen.getByRole("combobox", { name: "Leader icon" })).toBeEnabled();
});
it.each([
  null,
  {},
  { ...info, capabilities: null },
  { ...info, supportedContractVersions: [1] },
  { ...info, apiVersion: "" },
])(
  "rejects malformed discovery instead of announcing unsupported features",
  (value) => {
    expect(() => parseApiInfo(value)).toThrow();
  },
);
