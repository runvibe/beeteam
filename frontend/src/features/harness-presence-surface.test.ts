import { afterEach, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("src/features/overview-usage-cards.css", "utf8");

afterEach(() => {
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.palette;
  document.querySelectorAll("[data-surface-test]").forEach((node) => node.remove());
});

it.each(["default", "codex", "claude-code", "copilot"])(
  "keeps harness buttons transparent in both %s modes",
  (palette) => {
    const style = document.createElement("style");
    style.dataset.surfaceTest = "";
    style.textContent = css;
    document.head.append(style);
    const button = document.createElement("button");
    button.dataset.surfaceTest = "";
    button.className = "harness-presence-icon";
    document.body.append(button);
    document.documentElement.dataset.palette = palette;
    for (const dark of [false, true]) {
      document.documentElement.classList.toggle("dark", dark);
      expect(getComputedStyle(button).backgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(getComputedStyle(button).width).toBe("48px");
    }
  },
);
