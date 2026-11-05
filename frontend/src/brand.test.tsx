import { readFileSync } from "node:fs";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "./App";
import { ApiProvider } from "./api/context";
import { createMockApi } from "./api/mock";
import { makeSeed } from "./api/seed";
import { setLocalePreference } from "./i18n";

it.each(["en", "pt"] as const)(
  "uses the Bee Team brand in %s while preserving authored names",
  async (locale) => {
    setLocalePreference(locale);
    const seed = makeSeed();
    seed.boards[0].name = "Bee Team";
    seed.boards[1].name = "Get Bee Team";
    render(
      <ApiProvider api={createMockApi({ delay: 0, seed })}>
        <App />
      </ApiProvider>,
    );
    const brand = screen.getByRole("link", {
      name:
        locale === "en"
          ? "Bee Team - go to boards"
          : "Bee Team - ir para boards",
    });
    expect(brand).toHaveAttribute("title", "Bee Team");
    expect(brand).toHaveAttribute("href", "/boards");
    expect(
      await screen.findByRole("link", { name: "Bee Team" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("link", { name: "Get Bee Team" }),
    ).toBeVisible();
    expect(screen.queryByText(/Get Get Bee Team/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe(
        locale === "en"
          ? "Bee Team - Tasks and agents"
          : "Bee Team - Tarefas e agentes",
      ),
    );
  },
);

it("identifies the official domain in static metadata without redirecting this installation", () => {
  const html = new DOMParser().parseFromString(
    readFileSync("index.html", "utf8"),
    "text/html",
  );
  expect(html.title).toBe("Bee Team | Have your own team of agentic bees.");
  expect(
    html
      .querySelector('meta[name="application-name"]')
      ?.getAttribute("content"),
  ).toBe("Bee Team");
  expect(
    html.querySelector('meta[name="description"]')?.getAttribute("content"),
  ).toContain("getbee.team");
  expect(html.querySelector('meta[http-equiv="refresh"]')).toBeNull();
});
