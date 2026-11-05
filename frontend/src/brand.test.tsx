import { readFileSync } from "node:fs";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "./App";
import { ApiProvider } from "./api/context";
import { createMockApi } from "./api/mock";
import { makeSeed } from "./api/seed";
import { setLocalePreference } from "./i18n";

it.each(["en", "pt"] as const)(
  "uses the Get brand in %s while preserving authored names",
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
          ? "Get Bee Team - go to boards"
          : "Get Bee Team - ir para boards",
    });
    expect(brand).toHaveAttribute("title", "Get Bee Team");
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
          ? "Get Bee Team - Tasks and agents"
          : "Get Bee Team - Tarefas e agentes",
      ),
    );
  },
);

it("identifies the official domain in static metadata without redirecting this installation", () => {
  const html = new DOMParser().parseFromString(
    readFileSync("index.html", "utf8"),
    "text/html",
  );
  expect(html.title).toBe("Get Bee Team - Tasks and agents");
  expect(
    html
      .querySelector('meta[name="application-name"]')
      ?.getAttribute("content"),
  ).toBe("Get Bee Team");
  expect(
    html.querySelector('meta[name="description"]')?.getAttribute("content"),
  ).toContain("getbee.team");
  expect(html.querySelector('meta[http-equiv="refresh"]')).toBeNull();
});
