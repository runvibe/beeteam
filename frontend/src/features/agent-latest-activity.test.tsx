import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, ids } from "@/api/seed";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { setLocalePreference } from "@/i18n";
import { AgentLatestActivityView } from "./agent-latest-activity";
it.each(["pt", "en"] as const)(
  "shows attributed activity with exact timestamp and target in %s",
  (locale) => {
    setLocalePreference(locale);
    render(
      <AgentLatestActivityView
        pending={false}
        error={null}
        retry={() => {}}
        activity={{
          label: "Comment recorded",
          occurredAt: "2026-10-27T12:30:00Z",
          taskTitle: "Preserved task title",
          href: "/tasks/example?tab=timeline&timeline.selected=event",
        }}
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: locale === "pt" ? "Última atividade" : "Latest activity",
      }),
    ).toBeVisible();
    const time = document.querySelector("time")!;
    expect(time).toHaveAttribute("datetime", "2026-10-27T12:30:00.000Z");
    expect(time.getAttribute("title")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Preserved task title" }),
    ).toHaveAttribute(
      "href",
      "/tasks/example?tab=timeline&timeline.selected=event",
    );
    expect(screen.queryByText(/online/i)).toBeNull();
  },
);
it("keeps absence, loading and errors distinct and supports retry", async () => {
  const retry = vi.fn();
  const view = render(
    <AgentLatestActivityView
      pending
      activity={null}
      error={null}
      retry={retry}
    />,
  );
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  expect(screen.queryByText("Nenhuma atividade registrada.")).toBeNull();
  view.rerender(
    <AgentLatestActivityView
      pending={false}
      activity={null}
      error={new Error("Failed")}
      retry={retry}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Failed");
  expect(screen.queryByText("Nenhuma atividade registrada.")).toBeNull();
  await userEvent.click(
    screen.getByRole("button", { name: /Tentar novamente/i }),
  );
  expect(retry).toHaveBeenCalledOnce();
  view.rerender(
    <AgentLatestActivityView
      pending={false}
      activity={null}
      error={null}
      retry={retry}
    />,
  );
  expect(screen.getByText("Nenhuma atividade registrada.")).toBeVisible();
});

it("links the explicit event with the agent origin and restores Profile on back", async () => {
  const seed = makeSeed(),
    api = createMockApi({ delay: 0, seed }),
    latest = vi.spyOn(api, "agentLatestActivity");
  history.replaceState(
    {},
    "",
    `/agents/${seed.agents[0].slug}?from=%2Fagents%3Fagents.name%3DLia`,
  );
  render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>,
  );
  const link = await screen.findByRole("link", { name: seed.tasks[0].title });
  const url = new URL(link.getAttribute("href")!, location.origin);
  expect(url.searchParams.get("tab")).toBe("timeline");
  expect(url.searchParams.get("timeline.selected")).toBe(seed.timeline[1].id);
  expect(url.searchParams.get("from")).toContain(
    `/agents/${seed.agents[0].slug}`,
  );
  expect(latest).toHaveBeenCalledWith(ids.agent, expect.any(AbortSignal));
  await userEvent.click(link);
  await waitFor(() =>
    expect(location.pathname).toBe(`/tasks/${seed.tasks[0].slug}`),
  );
  history.back();
  await screen.findByRole("tab", { name: "Perfil" });
  expect(new URLSearchParams(location.search).get("from")).toBe(
    "/agents?agents.name=Lia",
  );
});
