import { EntityFilter } from "@/components/entity-filter";
import { FilterSummary } from "@/components/filter-summary";
import { Tooltip } from "radix-ui";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { ApiError } from "@/api/types";
import { StatusSettings } from "@/features/status-settings";
import { DataTransferPanel } from "@/features/data-transfer";
import { LanguageControl } from "@/components/language-control";
import { Failure } from "@/components/shared";
import { CardSymbol } from "@/components/card-symbol";
import { RelativeTime } from "@/components/relative-time";
import { FilterPopover } from "@/components/filter-controls";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  localeStorageKey,
  message,
  setLocalePreference,
  t,
  useLocale,
} from "./index";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "hasPointerCapture");
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});
it("changes the actual Settings selector and persists its choice", async () => {
  setLocalePreference("en");
  Object.defineProperty(Element.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
  render(<LanguageControl />);
  await userEvent.click(screen.getByRole("combobox", { name: "Language" }));
  await userEvent.click(screen.getByRole("option", { name: "Português" }));
  expect(screen.getByRole("combobox", { name: "Idioma" })).toHaveTextContent(
    "Português",
  );
  expect(localStorage.getItem(localeStorageKey)).toBe("pt");
  expect(document.documentElement.lang).toBe("pt");
});
it("switches a mounted form with shared isDone labels, user draft, focus and URL intact", async () => {
  const api = createMockApi({ delay: 0 }),
    board = makeSeed().boards[0];
  const create = vi.spyOn(api, "createStatus");
  window.history.replaceState(
    {},
    "",
    "/boards/example/settings?boards.name=Plano&tab=children",
  );
  setLocalePreference("en");
  render(
    <ApiProvider api={api}>
      <StatusSettings board={board} />
    </ApiProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Add status" }));
  const input = screen.getByRole("textbox", { name: "New status" });
  await userEvent.type(input, "Revisão do usuário — do not translate");
  const url = window.location.href;
  expect(
    screen.getAllByRole("switch", { name: "Counts as completed" }).length,
  ).toBeGreaterThan(1);
  act(() => {
    localStorage.setItem(localeStorageKey, "pt");
    window.dispatchEvent(
      new StorageEvent("storage", { key: localeStorageKey, newValue: "pt" }),
    );
  });
  expect(screen.getByRole("textbox", { name: "Novo status" })).toBe(input);
  expect(input).toHaveValue("Revisão do usuário — do not translate");
  expect(input).toHaveFocus();
  expect(window.location.href).toBe(url);
  expect(
    screen.getAllByRole("switch", { name: "Conta como concluído" }).length,
  ).toBeGreaterThan(1);
  expect(
    screen.getAllByText("Tarefas neste status são consideradas concluídas.")
      .length,
  ).toBeGreaterThan(1);
  act(() => setLocalePreference("en"));
  expect(screen.getByRole("textbox", { name: "New status" })).toBe(input);
  expect(input).toHaveFocus();
  expect(create).not.toHaveBeenCalled();
});
it("refreshes cached application errors, constants, dates and icons while preserving external text", () => {
  setLocalePreference("en");
  const error = new ApiError(
    503,
    "network_error",
    message("errors.couldNotConnectToTheApiTryAgain"),
  );
  function Filter() {
    useLocale();
    return <FilterPopover label={t("files.fileType")}>content</FilterPopover>;
  }
  render(
    <>
      <Failure error={error} />
      <Failure error={new Error("Erro enviado pelo usuário")} />
      <CardSymbol kind="standard" />
      <RelativeTime value="2026-01-01T12:00:00Z" />
      <Tooltip.Provider>
        <Filter />
      </Tooltip.Provider>
    </>,
  );
  expect(
    screen.getByText("Could not connect to the API. Try again."),
  ).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Standard" })).toBeInTheDocument();
  const time = document.querySelector("time")!,
    englishTitle = time.title;
  expect(
    screen
      .getByRole("button", { name: "File type" })
      .querySelector(".lucide-file-type"),
  ).not.toBeNull();
  act(() => setLocalePreference("pt"));
  expect(
    screen.getByText("Não foi possível conectar à API. Tente novamente."),
  ).toBeInTheDocument();
  expect(screen.getByText("Erro enviado pelo usuário")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Padrão" })).toBeInTheDocument();
  expect(document.querySelector("time")).toBe(time);
  expect(time.title).not.toBe(englishTitle);
  expect(
    screen
      .getByRole("button", { name: "Tipo de arquivo" })
      .querySelector(".lucide-file-type"),
  ).not.toBeNull();
});
it("changes an in-flight transfer label without changing the operation or request", async () => {
  setLocalePreference("en");
  const fetcher = vi.fn((input: string) =>
    input.endsWith("/exports")
      ? new Promise(() => {})
      : Promise.resolve({
          ok: true,
          json: async () => ({
            enabled: true,
            limits: {
              compressed: 1000,
              expanded: 2000,
              entries: 100,
              line: 100,
              seconds: 60,
            },
            retentionSeconds: 3600,
          }),
        }),
  );
  vi.stubGlobal("fetch", fetcher);
  localStorage.removeItem("bee-transfer-job");
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <DataTransferPanel />
    </QueryClientProvider>,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Export data" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Starting export"),
  );
  act(() => setLocalePreference("pt"));
  expect(screen.getByRole("status")).toHaveTextContent("Iniciando exportação");
  expect(screen.getByRole("button", { name: "Exportar dados" })).toBeDisabled();
  expect(
    fetcher.mock.calls.filter(([input]) => input.endsWith("/exports")),
  ).toHaveLength(1);
});

it("preserves a selector query scope and focused search input across translated labels", async () => {
  window.history.replaceState(
    {},
    "",
    "/boards?selector-agents-Executor.name=Planner",
  );
  setLocalePreference("en");
  function Selector() {
    useLocale();
    return (
      <EntityFilter
        resource="agents"
        label={t("files.fileType")}
        value=""
        onChange={() => {}}
      />
    );
  }
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <Selector />
    </ApiProvider>,
  );
  const input = screen.getByRole("textbox", {
    name: "Search options for File type",
  });
  expect(input).toHaveValue("Planner");
  input.focus();
  const url = window.location.href;
  act(() => setLocalePreference("pt"));
  expect(
    screen.getByRole("textbox", { name: "Buscar opções de Tipo de arquivo" }),
  ).toBe(input);
  expect(input).toHaveValue("Planner");
  expect(input).toHaveFocus();
  expect(window.location.href).toBe(url);
});
it("keeps an active filter removal button mounted and focused when its label changes", async () => {
  setLocalePreference("en");
  function Filters() {
    useLocale();
    return (
      <FilterSummary
        filters={[
          { id: "search", label: t("common.search"), value: "User content" },
          {
            id: "block",
            label: t("boards.block"),
            value: "User content",
            onRemove: () => {},
          },
        ]}
      />
    );
  }
  render(<Filters />);
  await userEvent.click(
    screen.getByRole("button", { name: "Expand 2 active filters" }),
  );
  const remove = screen.getByRole("button", {
    name: "Remove filter Block: User content",
  });
  remove.focus();
  act(() => setLocalePreference("pt"));
  expect(
    screen.getByRole("button", {
      name: "Remover filtro Bloqueio: User content",
    }),
  ).toBe(remove);
  expect(remove).toHaveFocus();
});
