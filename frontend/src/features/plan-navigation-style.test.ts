import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

it("preserves title typography and spacing when a plan becomes current", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync("src/features/plan-navigation.css", "utf8");
  const nav = document.createElement("nav");
  nav.className = "task-plan-navigation";
  const button = document.createElement("button");
  button.textContent = "Plano ilustrativo · Definir paleta dos estados bloqueados";
  nav.append(button);
  document.head.append(style);
  document.body.append(nav);
  const metrics = () => {
    const css = getComputedStyle(button);
    return [css.fontWeight, css.fontSize, css.lineHeight, css.letterSpacing,
      css.padding, css.borderWidth, css.width, css.height, css.whiteSpace];
  };
  try {
    const inactive = metrics();
    button.setAttribute("aria-current", "page");
    expect(metrics()).toEqual(inactive);
    expect(getComputedStyle(button).fontWeight).toBe("500");
  } finally {
    nav.remove();
    style.remove();
  }
});
