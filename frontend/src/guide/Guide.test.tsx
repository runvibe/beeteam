import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Guide } from "./Guide";
import { setLocalePreference } from "@/i18n";

afterEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
});
it("uses a shared harness URL before a preference, keeps the step and updates commands in place", () => {
  setLocalePreference("en");
  localStorage.setItem("beeteam.guide.harness", "other");
  history.replaceState(
    null,
    "",
    "/guide/first-team?harness=codex#start-the-lead",
  );
  Element.prototype.scrollIntoView = () => {};
  render(<Guide />);
  expect(screen.getByRole("button", { name: "Codex" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText(/Use \$get-a-team-lead/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Claude Code" }));
  expect(location.hash).toBe("#start-the-lead");
  expect(location.search).toBe("?harness=claude-code");
  expect(screen.getByText(/Use Get a Team Lead/)).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Connect your harness" }),
  ).toHaveAttribute("href", "/guide/connect?harness=claude-code");
});
