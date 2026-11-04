import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { setLocalePreference } from "@/i18n";
import { TeamForm } from "./teams";
import { TeamCardLinks } from "@/components/team-card-links";
import {
  AgentRoleSymbol,
  TeamRoleIcon,
  roleIconId,
  teamRoleIcons,
} from "@/components/team-role-icon";
import { Crown } from "lucide-react";
beforeEach(() => {
  Object.defineProperty(Element.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  Reflect.deleteProperty(Element.prototype, "hasPointerCapture");
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

it.each([
  ["en", "Leader icon", "Collaborator icon", "Rocket", "Shield"],
  ["pt", "Ícone do líder", "Ícone do colaborador", "Foguete", "Escudo"],
] as const)(
  "autosaves independent icon selections and restores on reopen in %s",
  async (locale, leaderLabel, collaboratorLabel, rocket, shield) => {
    setLocalePreference(locale);
    const seed = makeSeed();
    const team = seed.teams[0];
    const api = createMockApi({ delay: 0, seed });
    const patch = vi.spyOn(api, "patch");
    const view = render(
      <ApiProvider api={api}>
        <TeamForm team={team} />
      </ApiProvider>,
    );
    await userEvent.click(screen.getByRole("combobox", { name: leaderLabel }));
    await userEvent.click(
      await screen.findByRole("option", { name: `${rocket} 🚀` }),
    );
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(patch.mock.results[0].type).toBe("return"));
    await userEvent.click(
      screen.getByRole("combobox", { name: collaboratorLabel }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: `${shield} 🛡️` }),
    );
    await waitFor(async () => {
      const saved = await api.get("teams", team.id);
      expect(saved.leaderIconId).toBe("rocket");
      expect(saved.collaboratorIconId).toBe("shield");
    });
    const saved = await api.get("teams", team.id);
    view.unmount();
    render(
      <ApiProvider api={api}>
        <TeamForm team={saved} />
      </ApiProvider>,
    );
    expect(
      screen.getByRole("combobox", { name: leaderLabel }),
    ).toHaveTextContent(rocket);
    expect(
      screen.getByRole("combobox", { name: collaboratorLabel }),
    ).toHaveTextContent(shield);
    expect(patch).toHaveBeenCalledTimes(2);
  },
);

it("renders team context and each agent binding using that team's configured icon", async () => {
  setLocalePreference("en");
  const seed = makeSeed();
  const team = seed.teams[0];
  team.leaderIconId = "compass";
  team.collaboratorIconId = "wrench";
  const api = createMockApi({ delay: 0, seed });
  const { container } = render(
    <ApiProvider api={api}>
      <TeamCardLinks team={team} />
      <AgentRoleSymbol teamId={team.id} role="leader" />
      <AgentRoleSymbol teamId={team.id} role="collaborator" />
    </ApiProvider>,
  );
  await waitFor(() =>
    expect(
      within(screen.getByRole("img", { name: "Leader" })).getByText("", {
        selector: '[data-role-icon="compass"]',
      }),
    ).toBeInTheDocument(),
  );
  expect(container.querySelectorAll('[data-role-icon="compass"]')).toHaveLength(
    2,
  );
  expect(container.querySelectorAll('[data-role-icon="wrench"]')).toHaveLength(
    2,
  );
});

it("uses local trusted assets and stable defaults for older API responses", () => {
  expect(roleIconId(undefined, "leader")).toBe("crown");
  expect(roleIconId(undefined, "collaborator")).toBe("user-round");
  const { container } = render(
    <TeamRoleIcon id={'<svg onload="alert(1)" />'} />,
  );
  expect(container.innerHTML).toBe("");
  const ids = teamRoleIcons.map((icon) => icon.id);
  expect(new Set(ids).size).toBe(ids.length);
  const crownSvg = new DOMParser().parseFromString(
    teamRoleIcons[0].svg,
    "image/svg+xml",
  );
  const official = render(<Crown />);
  expect(
    Array.from(crownSvg.querySelectorAll("path")).map((node) =>
      node.getAttribute("d"),
    ),
  ).toEqual(
    Array.from(official.container.querySelectorAll("path")).map((node) =>
      node.getAttribute("d"),
    ),
  );
});

it.each(["en", "pt"] as const)(
  "offers 24 translated icons and saves new choices in %s",
  async (locale) => {
    setLocalePreference(locale);
    const seed = makeSeed();
    const team = seed.teams[0];
    const api = createMockApi({ delay: 0, seed });
    const patch = vi.spyOn(api, "patch");
    render(
      <ApiProvider api={api}>
        <TeamForm team={team} />
      </ApiProvider>,
    );
    expect(patch).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("combobox", {
        name: locale === "en" ? "Leader icon" : "Ícone do líder",
      }),
    );
    expect(await screen.findAllByRole("option")).toHaveLength(24);
    for (const option of screen.getAllByRole("option"))
      expect(option).not.toHaveTextContent("teams.icons.");
    await userEvent.click(
      screen.getByRole("option", {
        name: locale === "en" ? "Robot 🤖" : "Robô 🤖",
      }),
    );
    await waitFor(async () =>
      expect((await api.get("teams", team.id)).leaderIconId).toBe("bot"),
    );
    await userEvent.click(
      screen.getByRole("combobox", {
        name: locale === "en" ? "Collaborator icon" : "Ícone do colaborador",
      }),
    );
    await userEvent.keyboard("{End}{Enter}");
    await waitFor(async () => {
      const saved = await api.get("teams", team.id);
      expect(saved.leaderIconId).toBe("bot");
      expect(saved.collaboratorIconId).toBe("music");
    });
  },
);
