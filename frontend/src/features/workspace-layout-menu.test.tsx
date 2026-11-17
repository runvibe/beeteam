import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "radix-ui";
import { expect, it } from "vitest";
import { setLocalePreference } from "@/i18n";
import { WorkspaceLayoutMenu } from "./workspace-layout-menu";

it("shows icon-only layouts with accessible names and hover labels", async () => {
  setLocalePreference("en");
  render(
    <Tooltip.Provider>
      <WorkspaceLayoutMenu />
    </Tooltip.Provider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Panel layouts" }));
  const menu = screen.getByRole("dialog", { name: "Panel layouts" });
  expect(menu).not.toHaveTextContent(/\S/);

  const layouts = [
    ["Sessions, Content, Chat", ["sessions", "content", "chat"]],
    ["Sessions, Chat, Content", ["sessions", "chat", "content"]],
    ["Content, Sessions, Chat", ["content", "sessions", "chat"]],
    ["Content, Chat, Sessions", ["content", "chat", "sessions"]],
    ["Chat, Sessions, Content", ["chat", "sessions", "content"]],
    ["Chat, Content, Sessions", ["chat", "content", "sessions"]],
  ] as const;
  for (const [name, order] of layouts) {
    const option = within(menu).getByRole("radio", { name });
    expect(option).toHaveAttribute("title", name);
    const preview = option.querySelector(".workspace-layout-preview");
    expect(preview).toHaveAttribute("aria-hidden", "true");
    expect(preview?.querySelectorAll("svg")).toHaveLength(3);
    expect(
      Array.from(preview?.querySelectorAll("[data-panel]") ?? [])
        .map((panel) => panel.getAttribute("data-panel")),
    ).toEqual(order);
  }
});

it("keeps all six layout previews compact and selectable", async () => {
  setLocalePreference("en");
  const style = document.createElement("style");
  style.textContent = readFileSync("src/features/workspace-layout-menu.css", "utf8");
  document.head.append(style);
  try {
    render(
      <Tooltip.Provider>
        <WorkspaceLayoutMenu />
      </Tooltip.Provider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Panel layouts" }));
    const options = within(screen.getByRole("radiogroup", { name: "Panel layouts" }))
      .getAllByRole("radio");
    expect(options).toHaveLength(6);
    for (const option of options) {
      const preview = option.querySelector<HTMLElement>(".workspace-layout-preview");
      expect(preview).not.toBeNull();
      expect(parseFloat(getComputedStyle(preview!).height)).toBeLessThanOrEqual(32);
    }
    const indicator = options.find((option) => option.getAttribute("aria-checked") === "true")
      ?.querySelector<HTMLElement>(".workspace-layout-check");
    expect(indicator).toBeTruthy();
    expect(parseFloat(getComputedStyle(indicator!).width)).toBeLessThanOrEqual(14);
    await userEvent.click(options[1]);
    expect(options[1]).toBeChecked();
  } finally {
    style.remove();
  }
});
