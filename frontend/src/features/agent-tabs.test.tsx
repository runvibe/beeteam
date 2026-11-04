import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, ids } from "@/api/seed";
import { setLocalePreference } from "@/i18n";
it.each([
  ["pt", "agent.tab"],
  ["en", "agent.tab"],
  ["pt", "tab"],
  ["en", "tab"],
] as const)(
  "falls back from legacy Resume links without removing profile content in %s",
  async (locale, tabKey) => {
    setLocalePreference(locale);
    const seed = makeSeed();
    seed.agents.find((a) => a.id === ids.agent)!.contextSummary =
      "Contexto preservado do agente";
    const api = createMockApi({ delay: 0, seed });
    const agent = await api.get("agents", ids.agent);
    window.history.replaceState(
      {},
      "",
      `/agents/${agent.slug}?${tabKey}=resume&from=%2Fagents%3Fagents.name%3DLia&chats.limit=1`,
    );
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    );
    const profile = await screen.findByRole("tab", {
      name: locale === "pt" ? "Perfil" : "Profile",
    });
    expect(profile).toHaveAttribute("data-state", "active");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(
      screen.queryByRole("tab", { name: /^(Resume|Retomada)$/ }),
    ).toBeNull();
    expect(api).not.toHaveProperty("resume");
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText(agent.workInstructions)).toBeVisible();
    expect(within(panel).getByText(agent.contextSummary)).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "Chats" }));
    expect(new URLSearchParams(location.search).get("agent.tab")).toBe("chats");
    expect(new URLSearchParams(location.search).get("from")).toBe(
      "/agents?agents.name=Lia",
    );
    expect(new URLSearchParams(location.search).get("chats.limit")).toBe("1");
  },
);
